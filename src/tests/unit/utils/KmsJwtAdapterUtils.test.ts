/* eslint-disable @typescript-eslint/unbound-method */
import format from "ecdsa-sig-formatter";
import { KmsJwtAdapter } from "../../../utils/KmsJwtAdapter";
import { Constants } from "../../../utils/Constants";
import { absoluteTimeNow } from "../../../utils/DateTimeUtils";
import { jwtUtils } from "../../../utils/JwtUtils";

jest.mock("@aws-sdk/client-kms", () => ({
	KMS: jest.fn().mockImplementation(() => ({
		sign: jest.fn().mockImplementation(() => ({
			Signature: "signature",
		})),
		verify: jest.fn().mockImplementation(() => ({
			SignatureValid: true,
		})),
	})),
}));

jest.mock("../../../utils/JwtUtils", () => ({
	jwtUtils: {
		base64Encode: jest.fn().mockImplementation((args) => JSON.parse(args)),
		base64DecodeToString: jest.fn().mockImplementation((args) => JSON.stringify(args)),
		getHashedKid: jest.fn().mockImplementation((args) => {return args;}),
	},
}));

describe("KmsJwtAdapter utils", () => {
	let kmsJwtAdapter: KmsJwtAdapter;

	beforeEach(() => {
		kmsJwtAdapter = new KmsJwtAdapter(process.env.KMS_KEY_ARN!);
	});

	describe("#sign", () => {
		it("returns a signed access token", async () => {
			const jwtHeader = { alg: "RS256", typ: "JWT", kid: `${process.env.KMS_KEY_ARN}` };
			const jwtPayload = {
				sub: "b0668808-67ce-8jc7-a2fc-132b81612111",
				aud: process.env.ISSUER,
				iss: process.env.ISSUER,
				exp: absoluteTimeNow() + Constants.TOKEN_EXPIRY_SECONDS,
			};

			const accessToken = await kmsJwtAdapter.sign(jwtPayload);
			expect(jwtUtils.base64Encode).toHaveBeenNthCalledWith(1, JSON.stringify(jwtHeader));
			expect(jwtUtils.base64Encode).toHaveBeenNthCalledWith(2, JSON.stringify(jwtPayload));
			expect(accessToken).toBe(`${jwtHeader}.${jwtPayload}.c2lnbmF0dXJl`);
		});

		it("error is thrown if jwt cannot be signed", async () => {
			const jwtPayload = {
				sub: "b0668808-67ce-8jc7-a2fc-132b81612111",
				aud: process.env.ISSUER,
				iss: process.env.ISSUER,
				exp: absoluteTimeNow() + Constants.TOKEN_EXPIRY_SECONDS,
			};

			jest.spyOn(kmsJwtAdapter.kms, "sign").mockImplementationOnce(() => ({ Signature: null }));

			await expect(kmsJwtAdapter.sign(jwtPayload)).rejects.toThrow(expect.objectContaining({ message: "Failed to sign Jwt" }));
		});
	});


	describe("#decode", () => {
		it("returns correctly formatted result", () => {
			expect(kmsJwtAdapter.decode("header.payload.signature")).toEqual({
				header: "header",
				payload: "payload",
				signature: "signature",
			});
		});
	});
});
