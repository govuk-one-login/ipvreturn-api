import { PublishKeyHandler } from "../../PublishKeyHandler";
import { expect, jest } from "@jest/globals";
import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-jest";
import { GetPublicKeyCommand, GetPublicKeyCommandOutput, KMSClient } from "@aws-sdk/client-kms";
import { PutObjectCommand, PutObjectCommandInput, S3Client } from "@aws-sdk/client-s3";
import { Jwk } from "../../types/Keys";
import { Context } from "aws-lambda";
import crypto from "node:crypto";

jest.mock("@aws-lambda-powertools/logger", () => ({
    Logger: jest.fn().mockImplementation(() => ({
        info: (x: any) => console.log(x),
        debug: (x: any) => console.log(x),
    })),
}));

const { publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
});
const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });
const jwk = crypto.createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' })
                  .export({ format: 'jwk' });
const keyID = "1234-56789-KeyId";
const mockedHashedKid = "2f572216be9732645402b591d4bebbc2fc6f10749d73fc22aaec1fa2f11fbc08"; //pragma: allowlist secret
const bucketName = "test_bucket_name";
const validJwk: Jwk = {
    ...jwk,
    use: "sig",
    alg: "RS256",
    kid: mockedHashedKid,
    kty: "RSA",
};
const validContext = { functionName: "test", functionVersion: "1" } as Context;
const validEvent = {} as Record<string, unknown>;

const validGetPublicKeyCommandOutput: GetPublicKeyCommandOutput = {
    $metadata: {
        httpStatusCode: 200,
        requestId: "cfc3d7ac-fa8c-4e3f-ab04-5aa1d6531f52",
        attempts: 1,
        totalRetryDelay: 0,
    },
    CustomerMasterKeySpec: "RSA_2048",
    EncryptionAlgorithms: ["RSAES_OAEP_SHA_1", "RSAES_OAEP_SHA_256"],
    KeyId: `arn:aws:kms:eu-west-2:0001:key/${keyID}`,
    KeySpec: "RSA_2048",
    KeyUsage: "SIGN_VERIFY",
    PublicKey: new Uint8Array(publicKeyDer)
};
const invalidGetPublicKeyCommandOutput: GetPublicKeyCommandOutput = {
    $metadata: {
        httpStatusCode: 200,
        requestId: "cfc3d7ac-fa8c-4e3f-ab04-5aa1d6531f52",
        attempts: 1,
        totalRetryDelay: 0,
    },
    CustomerMasterKeySpec: "RSA_2048",
    EncryptionAlgorithms: ["RSAES_OAEP_SHA_1", "RSAES_OAEP_SHA_256"],
    KeyId: `arn:aws:kms:eu-west-2:0001:key/${keyID}`,
    KeySpec: "RSA_2048",
    KeyUsage: "ENCRYPT_DECRYPT",
    PublicKey: new Uint8Array(publicKeyDer)
};
const validPutObjectCommandInput: PutObjectCommandInput = {
    Bucket: bucketName,
    Key: "jwks.json",
    Body: JSON.stringify({
        keys: [validJwk],
    }),
    ContentType: "application/json",
};

describe("Tests", () => {
    const s3Mock = mockClient(S3Client);
    const kmsMock = mockClient(KMSClient);

    beforeEach(() => {
        s3Mock.reset();
        kmsMock.reset();
        kmsMock.on(GetPublicKeyCommand).resolves(validGetPublicKeyCommandOutput);
    });

    describe("#handler happy path", () => {
        it("Should upload keys to s3", async () => {
            const publishKeyHandler: PublishKeyHandler = new PublishKeyHandler(keyID, bucketName);
            const result: string | undefined = await publishKeyHandler.handler(validEvent, validContext);

            expect(result).toEqual("Success");
            expect(s3Mock).toHaveReceivedNthCommandWith(1, PutObjectCommand, validPutObjectCommandInput);
        });

        it("Shouldn't parse keys that are with usage that is not SIGN_VERIFY", async () => {
            kmsMock.on(GetPublicKeyCommand).resolves(invalidGetPublicKeyCommandOutput);
            const publishKeyHandler: PublishKeyHandler = new PublishKeyHandler(keyID, bucketName);
            expect.assertions(1);
            try {
                await publishKeyHandler.handler(validEvent, validContext);
            } catch (error) {
                expect(error).toEqual(
                    new Error(
                        "Unable to create JWKS file: Failed to fetch key from KMS: Public key data obtained from KMS is invalid",
                    ),
                );
            }
        });
    });

    describe("#handler env variables not set", () => {
        it("throws error if Key ID variable is missing", () => {
            expect(() => {
                new PublishKeyHandler(undefined, bucketName);
            }).toThrow("Key ID is missing");
        });

        it("throws error if bucketName variable is missing", () => {
            expect(() => {
                new PublishKeyHandler(keyID, undefined);
            }).toThrow("bucketName is missing");
        });
    });

    describe("AWS KMS Service Errors", () => {
        it("handle any errors from kmsClient getPublicKey", async () => {
            kmsMock.on(GetPublicKeyCommand).rejects(new Error("TEST ERROR"));
            const publishKeyHandler = new PublishKeyHandler(keyID, bucketName);

            expect.assertions(1);
            try {
                await publishKeyHandler.handler(validEvent, validContext);
            } catch (error) {
                expect(error).toEqual(
                    new Error("Unable to create JWKS file: Failed to fetch key from KMS: TEST ERROR"),
                );
            }
        });

        it("handle any null key from kmsClient getPublicKey", async () => {
            kmsMock.on(GetPublicKeyCommand).rejects(undefined);
            const publishKeyHandler = new PublishKeyHandler(keyID, bucketName);

            expect.assertions(1);
            try {
                await publishKeyHandler.handler(validEvent, validContext);
            } catch (error) {
                expect(error).toEqual(new Error("Unable to create JWKS file: Failed to fetch key from KMS: "));
            }
        });

        it("handle partial result from kmsClient getPublicKey", async () => {
            for (const key of Object.keys(validGetPublicKeyCommandOutput)) {
                const kmsOutput = {
                    ...validGetPublicKeyCommandOutput,
                    [key]: undefined,
                } as GetPublicKeyCommandOutput;
                kmsMock.on(GetPublicKeyCommand).resolves(kmsOutput);

                const publishKeyHandler = new PublishKeyHandler(keyID, bucketName);

                try {
                    await publishKeyHandler.handler(validEvent, validContext);
                } catch (error) {
                    expect(error).toEqual(
                        new Error(
                            "Unable to create JWKS file: Failed to fetch key from KMS: Public key data obtained from KMS is invalid",
                        ),
                    );
                }
            }
        });
    });

    describe("AWS S3 Service Errors", () => {
        it("handles error from s3Client PutObject ", async () => {
            s3Mock.on(PutObjectCommand).rejects(new Error("S3 Upload Error"));
            const publishKeyHandler: PublishKeyHandler = new PublishKeyHandler(keyID, bucketName);

            expect.assertions(3);
            let result: string | undefined;
            try {
                result = await publishKeyHandler.handler(validEvent, validContext);
            } catch (error) {
                expect(error).toEqual(new Error("Unable to create JWKS file: Failed to save to S3: S3 Upload Error"));
            }

            expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, validPutObjectCommandInput);
            expect(result).toBeUndefined();
        });

        it("handles non-error rejections from s3Client PutObject ", async () => {
            s3Mock.on(PutObjectCommand).rejects("S3 Upload Error");
            const publishKeyHandler: PublishKeyHandler = new PublishKeyHandler(keyID, bucketName);

            expect.assertions(3);
            let result: string | undefined;
            try {
                result = await publishKeyHandler.handler(validEvent, validContext);
            } catch (error) {
                expect(error).toEqual(new Error("Unable to create JWKS file: Failed to save to S3: S3 Upload Error"));
            }

            expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, validPutObjectCommandInput);
            expect(result).toBeUndefined();
        });
    });
});
