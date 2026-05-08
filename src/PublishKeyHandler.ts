import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { Context } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Jwk, Jwks } from "./types/Keys";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { KMSClient, GetPublicKeyCommand, GetPublicKeyCommandOutput } from "@aws-sdk/client-kms";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import crypto from "node:crypto";

export const logger = new Logger({ serviceName: "PublishKeyHandler" });

export class PublishKeyHandler implements LambdaInterface {
    signingKeyId: string;
    bucketName: string;

    readonly s3Client = new S3Client({
        region: process.env.REGION,
        maxAttempts: 5,
        requestHandler: new NodeHttpHandler({
            connectionTimeout: 5000,
            requestTimeout: 5000,
        }),
    });

    readonly kmsClient = new KMSClient({
        region: process.env.REGION,
        maxAttempts: 5,
        requestHandler: new NodeHttpHandler({
            connectionTimeout: 5000,
            requestTimeout: 5000,
        }),
    });

    constructor(signingKeyId: string | undefined, bucketName: string | undefined) {
        if (!signingKeyId) {
            throw new Error("Key ID is missing");
        }
        this.signingKeyId = signingKeyId;

        if (!bucketName) {
            throw new Error("bucketName is missing");
        }
        this.bucketName = bucketName;
    }

    // PLEASE NOTE: THIS LAMBDA WILL OVERWRITE EVERYTHING IN THE JWKS.JSON FILE. It does not append the current decryption key details.
    public async handler(event: Record<string, unknown>, context: Context): Promise<string | undefined> {
        try {
            logger.info(`Initiating lambda ${context.functionName} version ${context.functionVersion}`);
            logger.debug(`Using key ${this.signingKeyId} and uploading to ${this.bucketName}`);

            const jsonWebKeySet: Jwks = { keys: [] };
            const signingKey = await this.getKmsKey();
            logger.debug(`Obtained the Public Key: ${JSON.stringify(signingKey)}`);

            const signingKeyAsJwk: Jwk = this.convertToJwk(signingKey);
            jsonWebKeySet.keys.push(signingKeyAsJwk);

            await this.saveToS3(jsonWebKeySet);
            logger.info("Successfully uploaded a new object version of jwks.json to bucket");

            return "Success";
        } catch (error) {
            throw new Error(`Unable to create JWKS file: ${this.normaliseError(error)}`);
        }
    }

    private async saveToS3(jsonWebKeySet: Jwks) {
        try {
            const uploadParams = {
                Bucket: this.bucketName,
                Key: "jwks.json",
                Body: JSON.stringify(jsonWebKeySet),
                ContentType: "application/json",
            };
            logger.debug(`uploadParams = ${JSON.stringify(uploadParams)}`);

            await this.s3Client.send(new PutObjectCommand(uploadParams));
        } catch (error) {
            throw new Error(`Failed to save to S3: ${this.normaliseError(error)}`);
        }
    }

    private async getKmsKey() {
        try {
            const signingKey = await this.kmsClient.send(new GetPublicKeyCommand({ KeyId: this.signingKeyId }));
            if (!this.isValidPublicKey(signingKey)) {
                logger.debug(`InvalidKey: ${JSON.stringify(signingKey)}`);
                throw new Error(`Public key data obtained from KMS is invalid`);
            }
            return signingKey;
        } catch (error) {
            throw new Error(`Failed to fetch key from KMS: ${this.normaliseError(error)}`);
        }
    }

    private convertToJwk(kmsKeyOutput: GetPublicKeyCommandOutput): Jwk {
        const publicKey: crypto.JsonWebKey = crypto
            .createPublicKey({
                key: kmsKeyOutput.PublicKey as unknown as Buffer,
                type: "spki",
                format: "der",
            })
            .export({ format: "jwk" });

        return {
            ...publicKey,
            use: "sig",
            alg: "RS256", 
            kid: this.signingKeyId,
        } as Jwk;
    }

    private isValidPublicKey(kmsKey: GetPublicKeyCommandOutput | null): boolean {
        return (
            !!kmsKey &&
            kmsKey.KeySpec != undefined &&
            kmsKey.KeyId != undefined &&
            kmsKey.PublicKey != undefined &&
            kmsKey.KeyUsage === "SIGN_VERIFY"
        );
    }

    private normaliseError(error: unknown): string {
        if (error instanceof Error) {
            logger.info(`Error: ${error.message}`);
            return error.message;
        } else {
            return JSON.stringify(error);
        }
    }
}

const SIGNING_KEY_ID: string | undefined = process.env.SIGNING_KEY_ID;
const JWKS_BUCKET_NAME: string | undefined = process.env.JWKS_BUCKET_NAME;

const handlerClass = new PublishKeyHandler(SIGNING_KEY_ID, JWKS_BUCKET_NAME);
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
