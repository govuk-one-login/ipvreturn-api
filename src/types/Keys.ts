import { JsonWebKey } from "node:crypto";

export type Jwks = {
    keys: Jwk[];
};

export interface Jwk extends JsonWebKey {
    alg: string;
    kid: string;
    kty: "RSA" | "EC";
    use: "enc" | "sig";
}
