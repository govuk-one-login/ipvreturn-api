import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { JarPayload, JwtHeader } from "../models/enums/AuthTypes";
import { util } from "node-jose";
import crypto from "node:crypto";
import { jwtUtils } from "./JwtUtils";
import * as AWS from "@aws-sdk/client-kms";
import { checkRequiredEnvVars } from "../utils/EnvironmentVarUtils";

export class OidcTokenProcessor {
    private static instance: OidcTokenProcessor;

    private readonly logger: Logger;
	
    constructor(logger: Logger) {
    	this.logger = logger;
    }

    static getInstance(logger: Logger, metrics: Metrics): OidcTokenProcessor {
		if (!checkRequiredEnvVars(["JWKS_URI", "SIGNING_KEY", "OIDC_URL", "OIDC_CLIENT_ID"])) throw new Error("Missing Configuration");
    	if (!OidcTokenProcessor.instance) {
    		OidcTokenProcessor.instance = new OidcTokenProcessor(logger);
    	}
    	return OidcTokenProcessor.instance;
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
			sub: code as string,
			aud: process.env.OIDC_CLIENT_ID,
			iss: process.env.OIDC_URL,
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

}

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
	const signature = util.base64url.encode(
		Buffer.from(res.Signature),
		"utf8"
	  );
	  return `${tokenComponents.header}.${tokenComponents.payload}.${signature}`;
}

export function getConfig(): {
	jwksUri: string;
	signingKey: string;
  } {  
	return {
	  jwksUri: process.env.JWKS_URI,
	  signingKey: process.env.SIGNING_KEY,
	};
}

