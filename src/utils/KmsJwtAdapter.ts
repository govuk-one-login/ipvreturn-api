import { Buffer } from "buffer";
import { JwtHeader, JwtPayload, Jwk, Jwt } from "./IVeriCredential";
import * as AWS from "@aws-sdk/client-kms";
import { jwtUtils } from "./JwtUtils";
import { importJWK, JWTPayload, jwtVerify } from "jose";
import axios from "axios";
import { MessageType, SigningAlgorithmSpec } from "@aws-sdk/client-kms";

export class KmsJwtAdapter {
	readonly kid: string;

	readonly kms = new AWS.KMS({
		region: process.env.REGION,
	});

	/**
	 * An implemention the JWS standard using KMS to sign Jwts
	 *
	 * kid: The key Id of the KMS key
	 */
	ALG = "RSASSA_PKCS1_V1_5_SHA_256";

	constructor(kid: string) {
		this.kid = kid;
	}

	async sign(jwtPayload: JwtPayload): Promise<string> {
		const jwtHeader: JwtHeader = { alg: "RS256", typ: "JWT" };
		const kid = this.kid.split("/").pop();
		if (kid != null) {
			jwtHeader.kid = kid;
		}
		const tokenComponents = {
			header: jwtUtils.base64Encode(JSON.stringify(jwtHeader)),
			payload: jwtUtils.base64Encode(JSON.stringify(jwtPayload)),
			signature: "",
		};
		const params = {
			Message: Buffer.from(`${tokenComponents.header}.${tokenComponents.payload}`),
			KeyId: kid,
			SigningAlgorithm: SigningAlgorithmSpec.RSASSA_PKCS1_V1_5_SHA_256,
			MessageType: MessageType.RAW,
		};

		const res = await this.kms.sign(params);
		if (res.Signature == null) {
			throw new Error("Failed to sign Jwt");
		}

		tokenComponents.signature = Buffer.from(res.Signature).toString("base64").replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=/g, "");
		return `${tokenComponents.header}.${tokenComponents.payload}.${tokenComponents.signature}`;
	}

	decode(urlEncodedJwt: string): Jwt {
		const [header, payload, signature] = urlEncodedJwt.split(".");

		const result: Jwt = {
			header: JSON.parse(jwtUtils.base64DecodeToString(header)),
			payload: JSON.parse(jwtUtils.base64DecodeToString(payload)),
			signature,
		};
		return result;
	}

	async verifyWithJwks(urlEncodedJwt: string, publicKeyEndpoint: string): Promise<JWTPayload | null> {
		const oidcProviderJwks = (await axios.get(publicKeyEndpoint)).data;
		const signingKey = oidcProviderJwks.keys.find((key: Jwk) => key.kty === "RSA");
		const publicKey = await importJWK(signingKey, "RS256");

		try {
			const { payload } = await jwtVerify(urlEncodedJwt, publicKey);
			return payload;
		} catch (error) {
			throw new Error("Failed to verify signature: " + error);
		}
	}

}
