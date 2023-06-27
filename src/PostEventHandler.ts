import { SQSBatchResponse, SQSEvent, SQSRecord } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { PostEventProcessor } from "./services/PostEventProcessor";

const POWERTOOLS_METRICS_NAMESPACE = process.env.POWERTOOLS_METRICS_NAMESPACE;
const POWERTOOLS_LOG_LEVEL = process.env.POWERTOOLS_LOG_LEVEL;
const POWERTOOLS_SERVICE_NAME = process.env.POWERTOOLS_SERVICE_NAME;

const logger = new Logger({
	logLevel: POWERTOOLS_LOG_LEVEL,
	serviceName: POWERTOOLS_SERVICE_NAME,
});

const metrics = new Metrics({ namespace: POWERTOOLS_METRICS_NAMESPACE, serviceName: POWERTOOLS_SERVICE_NAME });

class PostEventHandler implements LambdaInterface {

	@metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
	async handler(event: SQSEvent, context: any): Promise<SQSBatchResponse> {

		// clear PersistentLogAttributes set by any previous invocation, and add lambda context for this invocation
		logger.setPersistentLogAttributes({});
		logger.addContext(context);

		if (event.Records.length === 1) {
			let body;
			const record: SQSRecord = event.Records[0];

			try {
				body = JSON.parse(record.body);
			} catch (error) {
				logger.error({ message:"Received invalid JSON in the SQS event record.body" });
				return { batchItemFailures:[] };
			}

			logger.debug("Starting to process record", { event_name: body.event_name });

			try {
				await PostEventProcessor.getInstance(logger, metrics).processRequest(record.body);

				logger.debug("Finished processing record from SQS");
				return { batchItemFailures:[] };

			} catch (error: any) {
				logger.error({ message: "SQS Event could not be processed", error });
				return { batchItemFailures:[] };
			}

		} else {
			logger.warn({ message: "Unexpected no. of records received", numOfRecords: event.Records.length });
			return { batchItemFailures:[] };
		}
	}

}

const handlerClass = new PostEventHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
