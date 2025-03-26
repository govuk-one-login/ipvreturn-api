import AWSXRay from "aws-xray-sdk-core";

import { STS } from "@aws-sdk/client-sts";
AWSXRay.setContextMissingStrategy("LOG_ERROR");

const stsClientRaw = new STS({ region: process.env.REGION });

const stsClient = process.env.XRAY_ENABLED === "true" ? AWSXRay.captureAWSv3Client(stsClientRaw ) : stsClientRaw;

export { stsClient };
