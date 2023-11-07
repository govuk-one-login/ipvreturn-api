import { Jwt, JwtPayload } from "../../../utils/IVeriCredential";

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

    verify(): boolean { return this.result; }

    verifyWithJwks(): boolean {return this.result;}

    decode(): Jwt { return this.mockJwt; }

    sign(): string { return "signedJwt-test"; }
}

export class MockFailingKmsSigningJwtAdapter {

	sign(): string { throw new Error("Failed to sign Jwt"); }
}

export class MockFailingKmsJwtAdapter {
	sign(): string { return "signedJwt-test"; }

	decode(): Jwt { throw new Error("Failed to decode Jwt"); }
}
