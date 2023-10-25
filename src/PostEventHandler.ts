import { SQSBatchResponse, SQSEvent, SQSRecord } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { PostEventProcessor } from "./services/PostEventProcessor";
import { Constants } from "./utils/Constants";

const {
    POWERTOOLS_METRICS_NAMESPACE = Constants.IPVRETURN_METRICS_NAMESPACE,
    POWERTOOLS_LOG_LEVEL = Constants.DEBUG,
    POWERTOOLS_SERVICE_NAME = Constants.POSTEVENT_LOGGER_SVC_NAME
} = process.env;

const logger = new Logger({logLevel: POWERTOOLS_LOG_LEVEL, serviceName: POWERTOOLS_SERVICE_NAME});

const metrics = new Metrics({ namespace: POWERTOOLS_METRICS_NAMESPACE, serviceName: POWERTOOLS_SERVICE_NAME });

class PostEventHandler implements LambdaInterface {
    @metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
    async handler(event: SQSEvent, context: any): Promise<SQSBatchResponse> {
        logger.setPersistentLogAttributes({});
        logger.addContext(context);

        if (event.Records.length !== 1) {
            logger.warn({ message: "Unexpected no. of records received", numOfRecords: event.Records.length });
            return { batchItemFailures: [] };
        }

        const record: SQSRecord = event.Records[0];
        let body;

        try {
            body = JSON.parse(record.body);
        } catch {
            logger.error({ message: "Received invalid JSON in the SQS event record.body" });
            return { batchItemFailures: [] };
        }

        logger.debug("Starting PostEventProcessor", { event_name: body.event_name });

        try {
            await PostEventProcessor.getInstance(logger, metrics).processRequest(record.body);
            logger.debug("Finished processing record from SQS");
        } catch (error: any) {
            logger.error({ message: "SQS Event could not be processed", error });
        }

        return { batchItemFailures: [] };
    }
}

const handlerClass = new PostEventHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
