import { absoluteTimeNow } from "../../../utils/DateTimeUtils";
import { Jwt, JwtPayload } from "../../../utils/IVeriCredential";
import { HttpCodesEnum } from "../../../utils/HttpCodesEnum";

export class MockKmsJwtAdapter {
    result: boolean;

    mockJwt: Jwt;

    constructor(result: boolean, payload: JwtPayload, mockJwT: Jwt = {
    	header: {
    		alg: "alg",
    		typ: "typ",
    		kid: "kid",
    	},
    	payload,
    	signature: "testSignature",
    },
    ) {
    	this.result = result;
    	this.mockJwt = mockJwT;
    }

    verify(_urlEncodedJwt: string): boolean { return this.result; }

    verifyWithJwks(_urlEncodedJwt: string, _jwks_endpoint: string): boolean {return this.result;}

    decode(_urlEncodedJwt: string): Jwt { return this.mockJwt; }

    sign(_jwtPayload: JwtPayload): string { return "signedJwt-test"; }
}

export class MockFailingKmsSigningJwtAdapter {

	sign(_jwtPayload: JwtPayload): string { throw new Error("Failed to sign Jwt"); }
}

export class MockFailingKmsJwtAdapter {
	sign(_jwtPayload: JwtPayload): string { return "signedJwt-test"; }

	decode(_urlEncodedJwt: string): Jwt { throw new Error("Failed to decode Jwt"); }
}
