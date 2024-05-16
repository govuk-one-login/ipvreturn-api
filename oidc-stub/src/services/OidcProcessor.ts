import { KMSClient } from "@aws-sdk/client-kms";
import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { JarPayload, JwtHeader } from "../models/enums/AuthTypes";
import { util } from "node-jose";
import { NodeHttpHandler } from "@aws-sdk/node-http-handler";
import crypto from "node:crypto";
import { jwtUtils } from "./JwtUtils";
import * as AWS from "@aws-sdk/client-kms";

export class OidcProcessor {
    private static instance: OidcProcessor;

    private readonly logger: Logger;

    private readonly metrics: Metrics;
	
    constructor(logger: Logger, metrics: Metrics) {
    	this.logger = logger;

    	this.metrics = metrics;
    }

    static getInstance(logger: Logger, metrics: Metrics): OidcProcessor {
    	if (!OidcProcessor.instance) {
    		OidcProcessor.instance = new OidcProcessor(logger, metrics);
    	}
    	return OidcProcessor.instance;
    }

    /***
     * POST /token
     * @param event
     */
    async generateToken(event: any): Promise<any> {    	
		const body = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString() : event.body;
		const searchParams = new URLSearchParams(body);
		const code = searchParams.get("code");
		this.logger.info({ message: "Generating token response" }, { code });
		const config = getConfig();
		const iat = Math.floor(Date.now() / 1000);
		const payload: JarPayload = {
			//sub: "01333e01-dde3-412f-a484-4444", //TODO -Further investigation to get this userid
			sub: code as string,
			aud: "ppcQQGGNxghc-QJiqhRyGIJ5Its", //TODO get it from the env var
			iss: "https://ipr-oidc-stub-bhav-govnotifystub.return.dev.account.gov.uk/", //TODO get this from env var
			iat,
			nbf: iat - 1,
			exp: iat + 3 * 60,
			nonce: crypto.randomUUID()
		};

  		const signedJwt = await sign(payload, config.signingKey);
		const accessToken = 'mock-access-token';
		const idToken = signedJwt;
		this.logger.info("Generated token: ", idToken);
		return {
			statusCode: HttpCodesEnum.CREATED,
			body: JSON.stringify({
			access_token: accessToken,
			id_token: idToken,
			token_type: 'Bearer',
			expires_in: 3600,
			}),
		};
    }

	/***
     * GET /.well-known/openid-configuration
     */
    async returnOpenIdConfig(): Promise<any> {
    	this.logger.info({ message: "Fetching OpenId configuration response" });
		const baseUrl = "https://ipr-oidc-stub-bhav-govnotifystub.return.dev.account.gov.uk/"; //TODO get it from env variable.
		return {
			statusCode: HttpCodesEnum.OK,
			body: JSON.stringify({
				"authorization_endpoint": baseUrl+"authorize",
				"token_endpoint": baseUrl+"token",
				"registration_endpoint": baseUrl +"connect/register",
				"issuer": baseUrl,
				"jwks_uri": baseUrl+".well-known/jwks.json",
				"scopes_supported": [
				  "openid",
				  "email",
				  "phone",
				  "offline_access"
				],
				"response_types_supported": [
				  "code"
				],
				"grant_types_supported": [
				  "authorization_code"
				],
				"token_endpoint_auth_methods_supported": [
				  "private_key_jwt",
				  "client_secret_post"
				],
				"token_endpoint_auth_signing_alg_values_supported": [
				  "RS256",
				  "RS384",
				  "RS512",
				  "PS256",
				  "PS384",
				  "PS512"
				],
				"ui_locales_supported": [
				  "en",
				  "cy"
				],
				"service_documentation": "https://docs.sign-in.service.gov.uk/",
				"op_policy_uri": "https://signin.staging.account.gov.uk/privacy-notice",
				"op_tos_uri": "https://signin.staging.account.gov.uk/terms-and-conditions",
				"request_parameter_supported": true,
				"trustmarks": baseUrl+"trustmark",
				"subject_types_supported": [
				  "public",
				  "pairwise"
				],
				"userinfo_endpoint": baseUrl+"userinfo",
				"end_session_endpoint": baseUrl+"logout",
				"id_token_signing_alg_values_supported": [
				  "ES256",
				  "RS256"
				],
				"claim_types_supported": [
				  "normal"
				],
				"claims_supported": [
				  "sub",
				  "email",
				  "email_verified",
				  "phone_number",
				  "phone_number_verified",
				  "wallet_subject_id",
				  "https://vocab.account.gov.uk/v1/passport",
				  "https://vocab.account.gov.uk/v1/socialSecurityRecord",
				  "https://vocab.account.gov.uk/v1/drivingPermit",
				  "https://vocab.account.gov.uk/v1/coreIdentityJWT",
				  "https://vocab.account.gov.uk/v1/address",
				  "https://vocab.account.gov.uk/v1/inheritedIdentityJWT",
				  "https://vocab.account.gov.uk/v1/returnCode"
				],
				"request_uri_parameter_supported": false,
				"backchannel_logout_supported": true,
				"backchannel_logout_session_supported": false
			}
		),
		};
    }

	/***
	 * Authorization endpoint
     * GET /authorize
     */
    async returnAuthCode(event: any): Promise<any> {
		this.logger.info({ message: "Generating AuthCode" });
		const authorizationCode = event.queryStringParameters.state;
		const redirectUri = event.queryStringParameters.redirect_uri;
		const redirectUrl = `${redirectUri}?code=${authorizationCode}&state=${authorizationCode}`;
		this.logger.info({ message: "Successfully generated authorizationCode, redirectUrl: ", redirectUrl });
		return {
			statusCode: HttpCodesEnum.FOUND,
			headers: {
				Location: redirectUrl
			}
		}
    }

}
export const v3KmsClient = new KMSClient({
	region: process.env.REGION ?? "eu-west-2",
	requestHandler: new NodeHttpHandler({
	  connectionTimeout: 29000,
	  socketTimeout: 29000,
	}),
	maxAttempts: 2,
});

// async function sign(payload: JarPayload, keyId: string): Promise<string> {
// 	const kid = keyId.split("/").pop() ?? "";
// 	const alg = "RSASSA_PKCS1_V1_5_SHA_256";
// 	const jwtHeader: JwtHeader = { alg: "RS256", typ: "JWT", kid };
// 	const tokenComponents = {
// 	  header: util.base64url.encode(
// 		Buffer.from(JSON.stringify(jwtHeader)),
// 		"utf8"
// 	  ),
// 	  payload: util.base64url.encode(
// 		Buffer.from(JSON.stringify(payload)),
// 		"utf8"
// 	  ),
// 	  signature: "",
// 	};
// 	console.log("Sending to KMSClient...");
// 	const res = await v3KmsClient.send(
// 	  new SignCommand({
// 		KeyId: kid,
// 		SigningAlgorithm: alg,
// 		MessageType: "RAW",
// 		Message: Buffer.from(
// 		  `${tokenComponents.header}.${tokenComponents.payload}`
// 		),
// 	  })
// 	);
// 	if (res?.Signature == null) {
// 	  throw res as unknown as AWS.AWSError;
// 	}
// 	console.log("Creating Signature...")
// 	// tokenComponents.signature = format.derToJose(
// 	//   Buffer.from(res.Signature),
// 	//   "ES256"
// 	// );
// 	// return `${tokenComponents.header}.${tokenComponents.payload}.${tokenComponents.signature}`;
// 	// const signature = res.Signature?.toString('base64');
// 	// console.log("Signature.....:" + signature);
// 	// const token = jwt.sign(tokenComponents.payload, signature, { algorithm: 'RS256' });
//   	// return token;

// 	  const signature = util.base64url.encode(
// 		Buffer.from(res.Signature),
// 		"utf8"
// 	  );
// 	  console.log("Signature----:" + signature);
// 	  return `${tokenComponents.header}.${tokenComponents.payload}.${signature}`;
// }

async function sign(jwtPayload: JarPayload, keyId: string): Promise<string> {
	const kms : AWS.KMS = new AWS.KMS({
		region: process.env.REGION ?? "eu-west-2",
	});
	const kid = keyId.split("/").pop() ?? "";
	const alg = "RSASSA_PKCS1_V1_5_SHA_256";
	const jwtHeader: JwtHeader = { alg: "RS256", typ: "JWT", kid };	
	console.log("Sending to KMSClient...");
	const tokenComponents = {
		header: jwtUtils.base64Encode(JSON.stringify(jwtHeader)),
		payload: jwtUtils.base64Encode(JSON.stringify(jwtPayload)),
		signature: "",
	};
	const params = {
		Message: Buffer.from(`${tokenComponents.header}.${tokenComponents.payload}`),
		KeyId: kid,
		SigningAlgorithm: alg,
		MessageType: "RAW",
	};
	const res = await kms.sign(params);
	if (res.Signature == null) {
		throw new Error("Failed to sign Jwt");
	}
	//const base64EncodedSignature = res.Signature.toString('base64');
	// const token = jwt.sign(jwtPayload, base64EncodedSignature, { algorithm: 'RS256' });
    // return token;
	const signature = util.base64url.encode(
		Buffer.from(res.Signature),
		"utf8"
	  );
	  console.log("Signature----:" + signature);
	  return `${tokenComponents.header}.${tokenComponents.payload}.${signature}`;
}

export function getConfig(): {
	jwksUri: string;
	signingKey: string;
  } {
	if (
	  process.env.JWKS_URI == null ||
	  process.env.SIGNING_KEY == null
	) {
	  throw new Error("Missing configuration");
	}
  
	return {
	  jwksUri: process.env.JWKS_URI,
	  signingKey: process.env.SIGNING_KEY,
	};
}
