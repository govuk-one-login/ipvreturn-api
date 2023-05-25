import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { KmsJwtAdapter } from "../utils/KmsJwtAdapter";
import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { APIGatewayProxyEvent } from "aws-lambda";
import { Response } from "../utils/Response";
import { absoluteTimeNow } from "../utils/DateTimeUtils";
import { randomUUID } from "crypto";
import axios from "axios";
import { AppError } from "../utils/AppError";
import { createDynamoDbClientWithCreds } from "../utils/DynamoDBFactory";
import { IPRService } from "./IPRService";
import { EnvironmentVariables } from "./EnvironmentVariables";
import { ServicesEnum } from "../models/enums/ServicesEnum";
import { ValidationHelper } from "../utils/ValidationHelper";
import { Jwt, JwtPayload } from "../utils/IVeriCredential";
import { Constants } from "../utils/Constants";
import { SessionEventStatusEnum } from "../models/enums/SessionEventStatusEnum";
import { stsClient } from "../utils/StsClient";

export class SessionProcessor {
	private static instance: SessionProcessor;

	private readonly logger: Logger;

	private readonly metrics: Metrics;

	private readonly kmsJwtAdapter: KmsJwtAdapter;

	private readonly environmentVariables: EnvironmentVariables;

	private readonly validationHelper: ValidationHelper;

	constructor(logger: Logger, metrics: Metrics) {
		this.logger = logger;
		this.environmentVariables = new EnvironmentVariables(logger, ServicesEnum.GET_SESSION_EVENT_DATA_SERVICE);
		this.kmsJwtAdapter = new KmsJwtAdapter(this.environmentVariables.kmsKeyArn());
		this.metrics = metrics;
		this.validationHelper = new ValidationHelper();
	}

	static getInstance(logger: Logger, metrics: Metrics): SessionProcessor {
		if (!SessionProcessor.instance) {
			SessionProcessor.instance = new SessionProcessor(logger, metrics);
		}
		return SessionProcessor.instance;
	}

	async processRequest(event: APIGatewayProxyEvent): Promise<Response> {
		let issuer, jwksEndpoint;
		try {
			const authCode = event.queryStringParameters?.code;
			// Get OpenId configuration to extract the jwks_uri
			const openIdConfigEndpoint = `${this.environmentVariables.oidcUrl()}${Constants.OIDC_OPENID_CONFIG_ENDPOINT}`;
			const openIdConfiguration = (await axios.get(openIdConfigEndpoint)).data;
			if (openIdConfiguration.issuer == null || openIdConfiguration.jwks_uri == null ) {
				this.logger.error("Missing openIdConfiguration values.");
				return new Response(HttpCodesEnum.UNAUTHORIZED, "Missing openIdConfiguration values.");
			}
			this.logger.debug("OpenId Configuration data: ", { openIdConfiguration });
			issuer = openIdConfiguration.issuer;
			jwksEndpoint = openIdConfiguration.jwks_uri;

			// Generate id_token
			if (authCode == null || authCode.length <= 0) {
				this.logger.error("Missing authCode to generate id_token");
				return new Response(HttpCodesEnum.UNAUTHORIZED, "Missing authCode to generate id_token");
			}
			const idToken = await this.generateIdToken(authCode);

			let parsedIdTokenJwt: Jwt;
			try {
				parsedIdTokenJwt = this.kmsJwtAdapter.decode(idToken);
			} catch (error) {
				this.logger.error("FAILED_DECODING_JWT", { error });
				return new Response(HttpCodesEnum.UNAUTHORIZED, "Invalid request: Rejected jwt");
			}
			const jwtIdTokenPayload: JwtPayload = parsedIdTokenJwt.payload;

			// idToken Validation
			try {
				const payload = await this.kmsJwtAdapter.verifyWithJwks(idToken, jwksEndpoint);
				if (!payload) {
					this.logger.error("JWT verification failed");
					return new Response(HttpCodesEnum.UNAUTHORIZED, "JWT verification failed");
				}
			} catch (error) {
				this.logger.debug("UNEXPECTED_ERROR_VERIFYING_JWT", { error });
				return new Response(HttpCodesEnum.UNAUTHORIZED, "Invalid request: Could not verify jwt");
			}

			// Verify Jwt claims
			const jwtErrors = this.validationHelper.isJwtValid(jwtIdTokenPayload, this.environmentVariables.clientId(), issuer);
			if (jwtErrors.length > 0) {
				this.logger.error(jwtErrors);
				return new Response(HttpCodesEnum.UNAUTHORIZED, "JWT validation/verification failed");
			}

			// Call AssumeRoleWithWebIdentity using the id_token
			let assumedRole;
			try {
				assumedRole = await stsClient.assumeRoleWithWebIdentity({
					RoleSessionName: Constants.ROLE_SESSION_NAME,
					WebIdentityToken: idToken,
					RoleArn: this.environmentVariables.assumeRoleWithWebIdentityArn(),
				});
			} catch (err: any) {
				this.logger.error({ message: "An error occurred while assuming the role with WebIdentity ", err });
				return new Response(HttpCodesEnum.UNAUTHORIZED, err.message);
			}

			// Dynamo access using the temporary credentials
			// from the ID token
			const iprService = IPRService.getInstance(this.environmentVariables.sessionEventsTable(), this.logger, createDynamoDbClientWithCreds(assumedRole.Credentials));

			// The assumed role only allows access
			// to rows where the leading key (partition key)
			// is equal to the sub of the ID.
			//
			let session;
			const sub = jwtIdTokenPayload.sub!;
			try {
				session = await iprService.getSessionBySub(sub);
				this.logger.debug("Session retrieved from DB: ", { session });
				if (!session) {
					this.logger.error(`No session event found with the userId: ${sub}`);
					return new Response(HttpCodesEnum.UNAUTHORIZED, `No session event found with the userId: ${sub}`);
				}

			} catch (error) {
				this.logger.error({ message: "getSessionByUserId - failed executing get from dynamodb:", error });
				throw new AppError(HttpCodesEnum.UNAUTHORIZED, "Error retrieving Session");
			}

			// Validate sessionEvent Item if its missing some events.
			try {
				this.validationHelper.validateSessionEventFields(session);
			} catch (error: any) {
				this.logger.info(`Some events are missing for the session event with the userId: ${sub}`, error.message);
				return {
					statusCode: HttpCodesEnum.OK,
					body: JSON.stringify({
						status: SessionEventStatusEnum.PENDING,
						message: error.message,
					}),
				};
			}
			// Validate the notified field is set to true
			if (!session.notified) {
				this.logger.error("User is not yet notified for this session event.");
				return new Response(HttpCodesEnum.UNAUTHORIZED, "User is not yet notified for this session event.");
			}
			this.logger.info("User is successfully redirected to : ", session?.redirectUri);
			return {
				statusCode: HttpCodesEnum.OK,
				body: JSON.stringify({
					status: SessionEventStatusEnum.COMPLETED,
					redirect_uri:session?.redirectUri,
				}),
			};
		} catch (err: any) {
			return new Response(HttpCodesEnum.UNAUTHORIZED, err.message);
		}
	}

	async generateIdToken(authCode : string): Promise<string> {
		const oidcTokenUrl = `${this.environmentVariables.oidcUrl()}${Constants.OIDC_TOKEN_ENDPOINT}`;
		const jwtPayload = {
			jti: randomUUID(),
			aud: oidcTokenUrl,
			sub: this.environmentVariables.clientId(),
			iss: this.environmentVariables.clientId(),
			iat: absoluteTimeNow(),
			exp: absoluteTimeNow() + Number(this.environmentVariables.oidcJwtAssertionTokenExpiry()),
		};
		let client_assertion;
		try {
			client_assertion = await this.kmsJwtAdapter.sign(jwtPayload);
		} catch (error) {
			throw new AppError(HttpCodesEnum.UNAUTHORIZED, "Failed to sign the client_assertion Jwt");
		}

		const ENCODED_REDIRECT_URI = encodeURIComponent(this.environmentVariables.returnRedirectUrl());
		const ENCODED_CLIENT_ASSERTION_TYPE = encodeURIComponent(Constants.CLIENT_ASSERTION_TYPE);
		const urlEncodedBody = `grant_type=${Constants.GRANT_TYPE}&code=${authCode}&redirect_uri=${ENCODED_REDIRECT_URI}&client_assertion_type=${ENCODED_CLIENT_ASSERTION_TYPE}&client_assertion=${client_assertion}`;

		try {
			const { data } = await axios.post(
				oidcTokenUrl,
				urlEncodedBody,
				{ headers:{ "Content-Type" : "text/plain" } },
			);
			return data.id_token;
		} catch (err: any) {
			this.logger.error({ message: "An error occurred when retrieving OIDC token response ", err });
			throw new AppError(HttpCodesEnum.UNAUTHORIZED, err.message);
		}
	}

}
