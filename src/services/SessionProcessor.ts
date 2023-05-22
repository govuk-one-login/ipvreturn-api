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
import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { createDynamoDbClientWithCreds } from "../utils/DynamoDBFactory";
import { IPRService } from "./IPRService";
import { EnvironmentVariables } from "./EnvironmentVariables";
import { ServicesEnum } from "../models/enums/ServicesEnum";

const { STS } = require("@aws-sdk/client-sts");
const stsClient = new STS({ region: process.env.REGION });
const jose = require("jose");

export class SessionProcessor {
	private static instance: SessionProcessor;

	private readonly logger: Logger;

	private readonly metrics: Metrics;

	private readonly kmsJwtAdapter: KmsJwtAdapter;

	private readonly environmentVariables: EnvironmentVariables;

	constructor(logger: Logger, metrics: Metrics) {
		this.logger = logger;
		this.environmentVariables = new EnvironmentVariables(logger, ServicesEnum.POST_EVENT_SERVICE);
		// @ts-ignore
		this.kmsJwtAdapter = new KmsJwtAdapter(process.env.KMS_KEY_ARN);
		this.metrics = metrics;
	}

	static getInstance(logger: Logger, metrics: Metrics): SessionProcessor {
		if (!SessionProcessor.instance) {
			SessionProcessor.instance = new SessionProcessor(logger, metrics);
		}
		return SessionProcessor.instance;
	}

	async processRequest(event: APIGatewayProxyEvent): Promise<Response> {
		try {
			const authCode = event.queryStringParameters?.code;
			// Get OpenId configuration to extract the jwks_uri
			const openIdConfigEndpoint = "https://oidc.staging.account.gov.uk/.well-known/openid-configuration";
			const openIdConfiguration = (await axios.get(openIdConfigEndpoint)).data;
			this.logger.debug("OpenId Configuration data: ", { openIdConfiguration });
			const jwksEndpoint = openIdConfiguration.jwks_uri;
			this.logger.debug("Jwks_uri endpoint: ", jwksEndpoint);

			// Generate access token
			const jwtPayload = {
				jti: randomUUID(),
				aud:"https://oidc.staging.account.gov.uk/token",
				sub: "ppcQQGGNxghc-QJiqhRyGIJ5Its",
				iss: "ppcQQGGNxghc-QJiqhRyGIJ5Its",
				iat: absoluteTimeNow(),
				exp: absoluteTimeNow() + 86400,
			};
			let client_assertion;
			try {
				client_assertion = await this.kmsJwtAdapter.sign(jwtPayload);
			} catch (error) {
				return new Response(HttpCodesEnum.SERVER_ERROR, "Failed to sign the accessToken Jwt");
			}

			this.logger.debug("client_assertion generated successfully", { client_assertion });
			const ENCODED_REDIRECT_URI = encodeURIComponent("https://return.dev.account.gov.uk/callback");
			const ENCODED_CLIENT_ASSERTION_TYPE = encodeURIComponent("urn:ietf:params:oauth:client-assertion-type:jwt-bearer");
			const urlEncodedBody = `grant_type=authorization_code&code=${authCode}&redirect_uri=${ENCODED_REDIRECT_URI}&client_assertion_type=${ENCODED_CLIENT_ASSERTION_TYPE}&client_assertion=${client_assertion}`;

			console.log("urlencodedBody: ", urlEncodedBody);
			let idToken;
			let sub;
			try {
				const { data } = await axios.post(
					"https://oidc.staging.account.gov.uk/token",
					urlEncodedBody,
					{ headers:{ "Content-Type" : "text/plain" } },
				);

				this.logger.info("OIDC Token response: ", { data });
				idToken = data.id_token;
				sub = jose.decodeJwt(idToken).sub;
				console.log("sub from the id_token: ", sub );
			} catch (err: any) {
				this.logger.error({ message: "An error occurred when retrieving OIDC token response ", err });
				return new Response(err.statusCode, err.message);
			}

			// Call AssumeRoleWithWebIdentity using the id_token
			let assumedRole;
			try {
				assumedRole = await stsClient.assumeRoleWithWebIdentity({
					RoleSessionName: "AssumeRoleWithWebIdentityRole",
					WebIdentityToken: idToken,
					RoleArn: process.env.ASSUMEROLE_WITH_WEB_IDENTITY_ARN,
				});
			} catch (err: any) {
				this.logger.error({ message: "An error occurred while assuming the role with WebIdentity ", err });
				return new Response(err.statusCode, err.message);
			}
			// Dynamo access using the temporary credentials
			// from the ID token
			const iprService = IPRService.getInstance(this.environmentVariables.sessionEventsTable(), this.logger, createDynamoDbClientWithCreds(assumedRole.Credentials));

			// The assumed role only allows access
			// to rows where the leading key (partition key)
			// is equal to the sub of the ID.
			//
			let session;
			try {
				session = await iprService.getSessionBySub(sub);
				this.logger.debug("Session retrieved from DB: ", { session });

			} catch (error) {
				this.logger.error({ message: "getSessionByUserId - failed executing get from dynamodb:", error });
				throw new AppError(HttpCodesEnum.SERVER_ERROR, "Error retrieving Session");
			}

			return {
				statusCode: HttpCodesEnum.CREATED,
				body: JSON.stringify({
					status: "completed",
					redirect_uri:session?.redirectUri,
				}),
			};
		} catch (err: any) {
			return new Response(err.statusCode, err.message);
		}
	}
}
