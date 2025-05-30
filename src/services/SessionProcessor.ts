/* eslint-disable complexity */
/* eslint-disable max-lines-per-function */
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics, MetricUnits } from "@aws-lambda-powertools/metrics";
import { KmsJwtAdapter } from "../utils/KmsJwtAdapter";
import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { APIGatewayProxyEvent } from "aws-lambda";
import { Response } from "../utils/Response";
import { absoluteTimeNow } from "../utils/DateTimeUtils";
import { buildCoreEventFields } from "../utils/TxmaEvent";
import { randomUUID } from "crypto";
import axios from "axios";
import { AppError } from "../utils/AppError";
import { createDynamoDbClientWithCreds } from "../utils/DynamoDBFactory";
import { IPRServiceSession } from "./IPRServiceSession";
import { EnvironmentVariables } from "./EnvironmentVariables";
import { ServicesEnum } from "../models/enums/ServicesEnum";
import { ValidationHelper } from "../utils/ValidationHelper";
import { Jwt, JwtPayload } from "../utils/IVeriCredential";
import { Constants } from "../utils/Constants";
import { SessionEventStatusEnum } from "../models/enums/SessionEventStatusEnum";
import { stsClient } from "../utils/StsClient";
import { MessageCodes } from "../models/enums/MessageCodes";

export class SessionProcessor {
	private static instance: SessionProcessor;

	private readonly logger: Logger;

	private readonly metrics: Metrics;

	private readonly kmsJwtAdapter: KmsJwtAdapter;

	private readonly environmentVariables: EnvironmentVariables;

	private readonly validationHelper: ValidationHelper;

	private CLIENT_ID;

	constructor(logger: Logger, metrics: Metrics, CLIENT_ID: string) {
		this.logger = logger;
		this.environmentVariables = new EnvironmentVariables(logger, ServicesEnum.GET_SESSION_EVENT_DATA_SERVICE);
		this.kmsJwtAdapter = new KmsJwtAdapter(this.environmentVariables.kmsKeyArn());
		this.metrics = metrics;
		this.CLIENT_ID = CLIENT_ID;
		this.validationHelper = new ValidationHelper();
	}

	static getInstance(logger: Logger, metrics: Metrics, CLIENT_ID: string): SessionProcessor {
		if (!SessionProcessor.instance) {
			SessionProcessor.instance = new SessionProcessor(logger, metrics, CLIENT_ID);
		}
		return SessionProcessor.instance;
	}

	async processRequest(event: APIGatewayProxyEvent): Promise<Response> {
		const { encodedHeader, clientIpAddress } = this.extractHeaders(event);

		let issuer, jwksEndpoint;
		try {
			const authCode = event.queryStringParameters?.code;
			// Get OpenId configuration to extract the jwks_uri
			const openIdConfigEndpoint = `${this.environmentVariables.oidcUrl()}${Constants.OIDC_OPENID_CONFIG_ENDPOINT}`;
			const { data: openIdConfiguration } = await axios.get(openIdConfigEndpoint);

			if (openIdConfiguration.issuer == null || openIdConfiguration.jwks_uri == null ) {
				this.logger.error({ message: "Missing openIdConfiguration values." }, {
					messageCode: MessageCodes.MISSING_OIDC_CONFIGURATION,
				});
				return new Response(HttpCodesEnum.UNAUTHORIZED, "Missing openIdConfiguration values.");
			}

			this.logger.debug("Fetching OpenId Configuration data");
			issuer = openIdConfiguration.issuer;
			jwksEndpoint = openIdConfiguration.jwks_uri;

			// Generate id_token
			if (authCode == null || authCode.length <= 0) {
				this.logger.error({ message: "Missing authCode to generate id_token" }, { messageCode: MessageCodes.MISSING_CONFIGURATION });
				return new Response(HttpCodesEnum.UNAUTHORIZED, "Missing authCode to generate id_token");
			}
			const idToken = await this.generateIdToken(authCode);

			let parsedIdTokenJwt: Jwt;
			try {
				parsedIdTokenJwt = this.kmsJwtAdapter.decode(idToken);
			} catch (error) {
				this.logger.error("FAILED_DECODING_JWT", { messageCode: MessageCodes.FAILED_DECODING_JWT, error });
				return new Response(HttpCodesEnum.UNAUTHORIZED, "Invalid request: Rejected jwt");
			}
			const jwtIdTokenPayload: JwtPayload = parsedIdTokenJwt.payload;

			// idToken Validation
			try {
				const payload = await this.kmsJwtAdapter.verifyWithJwks(idToken, jwksEndpoint);
				if (!payload) {
					this.logger.error("JWT verification failed", { messageCode: MessageCodes.FAILED_VERIFYING_JWT });
					return new Response(HttpCodesEnum.UNAUTHORIZED, "JWT verification failed");
				}
			} catch (error) {
				this.logger.error("UNEXPECTED_ERROR_VERIFYING_JWT", { messageCode: MessageCodes.UNEXPECTED_ERROR_VERIFYING_JWT, error });
				return new Response(HttpCodesEnum.UNAUTHORIZED, "Invalid request: Could not verify jwt");
			}

			// Verify Jwt claims
			const jwtErrors = this.validationHelper.isJwtValid(jwtIdTokenPayload, this.CLIENT_ID, issuer);
			if (jwtErrors.length > 0) {
				this.logger.error({ message: jwtErrors }, { messageCode: MessageCodes.FAILED_VALIDATING_JWT });
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
			} catch (error) {
				this.logger.error({ message: "An error occurred while assuming the role with WebIdentity" }, { messageCode: MessageCodes.ERROR_ASSUMING_ROLE_WITH_WEB_IDENTITY, error });
				return new Response(HttpCodesEnum.UNAUTHORIZED, "An error occurred while assuming the role with WebIdentity");
			}

			// Dynamo access using the temporary credentials
			// from the ID token
			const iprService = IPRServiceSession.getInstance(
				this.environmentVariables.sessionEventsTable(),
				this.logger,
				createDynamoDbClientWithCreds(assumedRole.Credentials),
			);

			// The assumed role only allows access
			// to rows where the leading key (partition key)
			// is equal to the sub of the ID.
			const sub = jwtIdTokenPayload.sub!;
			const session = await iprService.getSessionBySub(sub);
			if (!session) {
				this.logger.error("No session event found for this userId", { messageCode: MessageCodes.SESSION_NOT_FOUND });
				return new Response(HttpCodesEnum.UNAUTHORIZED, "No session event found for this userId");
			}
			this.logger.appendKeys({ govuk_signin_journey_id: session.clientSessionId });

			// Validate sessionEvent Item if its missing some events.
			try {
				this.validationHelper.validateSessionEventFields(session);
			} catch (error: any) {
				this.logger.info("Some events are missing for the session event for this userId", error.message);
				this.metrics.addMetric("User_entered_IPR_in_incorrect_state", MetricUnits.Count, 1);
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
				this.logger.error("User is not yet notified for this session event.", { messageCode: MessageCodes.USER_NOT_NOTIFIED });
				return new Response(HttpCodesEnum.UNAUTHORIZED, "User is not yet notified for this session event.");
			}
			this.logger.info("User is successfully redirected to : ", session?.redirectUri);

			try {
				await iprService.sendToTXMA({
					event_name: "IPR_USER_REDIRECTED",
					...buildCoreEventFields({ user_id: sub, ip_address: clientIpAddress }, this.environmentVariables.issuer()),
					extensions: {
						previous_govuk_signin_journey_id: session.clientSessionId,
				  },
				}, encodedHeader);
			} catch (error) {
				this.logger.error("Failed to send IPR_USER_REDIRECTED event to TXMA", {
					error,
					messageCode: MessageCodes.FAILED_TO_WRITE_TXMA,
				});
			}

			this.metrics.addMetric("User_redirected_from_IPR", MetricUnits.Count, 1);
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

	extractHeaders(event: APIGatewayProxyEvent): { encodedHeader?: string; clientIpAddress: string } {
		let encodedHeader;
		let clientIpAddress = event.requestContext.identity?.sourceIp;

		if (event.headers) {
			encodedHeader = event.headers[Constants.ENCODED_AUDIT_HEADER] ?? "";
			clientIpAddress = event.headers[Constants.X_FORWARDED_FOR] ?? event.requestContext.identity?.sourceIp;
		}

		return { encodedHeader, clientIpAddress };
	}

	async generateIdToken(authCode : string): Promise<string> {
		const oidcTokenUrl = `${this.environmentVariables.oidcUrl()}${Constants.OIDC_TOKEN_ENDPOINT}`;
		const jwtPayload = {
			jti: randomUUID(),
			aud: oidcTokenUrl,
			sub: this.CLIENT_ID,
			iss: this.CLIENT_ID,
			iat: absoluteTimeNow(),
			exp: absoluteTimeNow() + Number(this.environmentVariables.oidcJwtAssertionTokenExpiry()),
		};
		let client_assertion;
		try {
			client_assertion = await this.kmsJwtAdapter.sign(jwtPayload);
		} catch (error) {
			this.logger.error("Failed to sign the client_assertion Jwt", {
				error,
				messageCode: MessageCodes.ERROR_SIGNING_JWT,
			});
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
		} catch (error) {
			this.logger.error("An error occurred when fetching OIDC token response", {
				error,
				messageCode: MessageCodes.UNEXPECTED_ERROR_FETCHING_OIDC_TOKEN,
			});
			throw new AppError(HttpCodesEnum.UNAUTHORIZED, "An error occurred when fetching OIDC token response");
		}
	}

}
