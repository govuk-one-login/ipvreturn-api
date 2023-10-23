import { APIGatewayProxyEvent } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { PutObjectCommand, S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"; // Import DeleteObjectCommand
import { NodeHttpHandler } from "@aws-sdk/node-http-handler";

const POWERTOOLS_METRICS_NAMESPACE = process.env.POWERTOOLS_METRICS_NAMESPACE ? process.env.POWERTOOLS_METRICS_NAMESPACE : "IPR-CRI";
const POWERTOOLS_LOG_LEVEL = process.env.POWERTOOLS_LOG_LEVEL ? process.env.POWERTOOLS_LOG_LEVEL : "DEBUG";

const logger = new Logger({
    logLevel: POWERTOOLS_LOG_LEVEL,
    serviceName: "RetryFailedEmails",
});
let CLIENT_ID: string;

const metrics = new Metrics({ namespace: POWERTOOLS_METRICS_NAMESPACE, serviceName: "RetryFailedEmails" });

const s3Client = new S3Client({
    region: process.env.REGION,
    maxAttempts: 2,
    requestHandler: new NodeHttpHandler({
        connectionTimeout: 29000,
        socketTimeout: 29000,
    }),
});

class Session implements LambdaInterface {
    @metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
    @logger.injectLambdaContext()
    async handler(event: any, context: any): Promise<any> {
        logger.setPersistentLogAttributes({});
        logger.addContext(context);

        logger.info("EVENT", { event });
        logger.info("EVENT", JSON.stringify(event));

        // Extract the fileName from the S3 event
        const fileName = event.Records[0].s3.object.key;
        logger.info('FILE_NAME', fileName);

        // Use the fileName to get the file from S3
        try {
            const getObjectCommand = new GetObjectCommand({
                Bucket: process.env.RETRY_USER_BUCKET_NAME,
                Key: fileName,
            });

            const response = await s3Client.send(getObjectCommand);

            // The file contents are in response.Body as a readable stream
            // You can read the contents or process it as needed.
            const fileContents = response.Body.toString('utf-8');
            logger.info('FILE_CONTENTS', {fileContents});
						logger.info('FILE_CONTENTS', JSON.stringify(fileContents));

            // Delete the file from S3
            const deleteObjectCommand = new DeleteObjectCommand({
                Bucket: process.env.RETRY_USER_BUCKET_NAME,
                Key: fileName,
            });

            await s3Client.send(deleteObjectCommand);

            logger.info('FILE_DELETED', { fileName });

            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'File retrieved and deleted successfully' }),
            };
        } catch (error: any) {
            logger.error('Error retrieving or deleting file from S3', error);

            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Internal Server Error' }),
            };
        }
    }
}

const handlerClass = new Session();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
