import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
//import { F2fService } from "./F2fService";
import { KmsJwtAdapter } from "../utils/KmsJwtAdapter";
import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
import { APIGatewayProxyEvent } from "aws-lambda";
import { Response } from "../utils/Response";
//import { AccessTokenRequestValidationHelper } from "../utils/AccessTokenRequestValidationHelper";
//import { ISessionItem } from "../models/ISessionItem";
import { absoluteTimeNow } from "../utils/DateTimeUtils";
import { Constants } from "../utils/Constants";
import { EnvironmentVariables } from "./EnvironmentVariables";
import { ServicesEnum } from "../models/enums/ServicesEnum";
import {randomUUID} from "crypto";
//import { AuthSessionState } from "../models/enums/AuthSessionState";

export class SessionProcessor {
	private static instance: SessionProcessor;

	private readonly logger: Logger;

	private readonly metrics: Metrics;

	// private readonly accessTokenRequestValidationHelper: AccessTokenRequestValidationHelper;
	//
	// private readonly f2fService: F2fService;

	private readonly kmsJwtAdapter: KmsJwtAdapter;

	//private readonly environmentVariables: EnvironmentVariables;

	constructor(logger: Logger, metrics: Metrics) {
		this.logger = logger;
		//this.environmentVariables = new EnvironmentVariables(logger, ServicesEnum.AUTHORIZATION_SERVICE);
		// @ts-ignore
		this.kmsJwtAdapter = new KmsJwtAdapter(process.env.KMS_KEY_ARN);
		//this.accessTokenRequestValidationHelper = new AccessTokenRequestValidationHelper();
		this.metrics = metrics;
		//this.f2fService = F2fService.getInstance(this.environmentVariables.sessionTable(), this.logger, createDynamoDbClient());
	}

	static getInstance(logger: Logger, metrics: Metrics): SessionProcessor {
		if (!SessionProcessor.instance) {
			SessionProcessor.instance = new SessionProcessor(logger, metrics);
		}
		return SessionProcessor.instance;
	}

	async processRequest(event: APIGatewayProxyEvent): Promise<Response> {
		try {
			// const requestPayload = this.accessTokenRequestValidationHelper.validatePayload(event.body);
			// let session: ISessionItem | undefined;
			// try {
			// 	session = await this.f2fService.getSessionByAuthorizationCode(requestPayload.code);
			// 	this.logger.info({ message: "Found Session: " + JSON.stringify(session) });
			// 	if (!session) {
			// 		return new Response(HttpCodesEnum.UNAUTHORIZED, `No session found by authorization code: ${requestPayload.code}`);
			// 	}
			// } catch (err) {
			// 	return new Response(HttpCodesEnum.UNAUTHORIZED, "Error while retrieving the session");
			// }

			//if (session.authSessionState === AuthSessionState.F2F_AUTH_CODE_ISSUED) {

				//this.accessTokenRequestValidationHelper.validateTokenRequestToRecord(session, requestPayload.redirectUri);
				// Generate access token
				const jwtPayload = {
					jti: randomUUID(),
					aud:"https://oidc.staging.account.gov.uk/token",
					sub: "ppcQQGGNxghc-QJiqhRyGIJ5Its",
					iss: "ppcQQGGNxghc-QJiqhRyGIJ5Its",
					iat: absoluteTimeNow(),
					exp: absoluteTimeNow() + 86400,
				};
				let accessToken;
				try {
					accessToken = await this.kmsJwtAdapter.sign(jwtPayload);
				} catch (error) {
					return new Response(HttpCodesEnum.SERVER_ERROR, "Failed to sign the accessToken Jwt");
				}

				// Update the sessionTable with accessTokenExpiryDate and AuthSessionState.
				//await this.f2fService.updateSessionWithAccessTokenDetails(session.sessionId, jwtPayload.exp);

				this.logger.info("Access token generated successfully",{accessToken });


			return {
				statusCode: HttpCodesEnum.CREATED,
				body: "",
			};
				// return {
				// 	statusCode: HttpCodesEnum.CREATED,
				// 	body: JSON.stringify({
				// 		access_token: accessToken,
				// 		token_type: Constants.BEARER,
				// 		expires_in: Constants.TOKEN_EXPIRY_SECONDS,
				// 	}),
				// };
			// } else {
			// 	this.logger.warn(`Session is in the wrong state: ${session.authSessionState}, expected state should be ${AuthSessionState.F2F_AUTH_CODE_ISSUED}`);
			// 	return new Response(HttpCodesEnum.UNAUTHORIZED, `Session is in the wrong state: ${session.authSessionState}`);
			// }
		} catch (err: any) {
			return new Response(err.statusCode, err.message);
		}
	}
}