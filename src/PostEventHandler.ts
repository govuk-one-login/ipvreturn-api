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

const EMPTY_BATCH_RESPONSE: SQSBatchResponse = {
	batchItemFailures: [],
};

class PostEventHandler implements LambdaInterface {
	async handler(event: SQSEvent, context: any): Promise < SQSBatchResponse > {
		logger.setPersistentLogAttributes({});
		logger.addContext(context);

		if (event.Records.length !== 1) {
			logger.warn({ message: "Unexpected no. of records received", numOfRecords: event.Records.length });
			return EMPTY_BATCH_RESPONSE;
		}

		const record: SQSRecord = event.Records[0];
		let body;

		try {
			body = JSON.parse(record.body);
		} catch (error) {
			logger.error({
				message: "Received invalid JSON in the SQS event record.body",
			});
			return EMPTY_BATCH_RESPONSE;
		}

		logger.debug("Starting to process record", {
			event_name: body.event_name,
		});

		try {
			await PostEventProcessor.getInstance(logger, metrics).processRequest(record.body);
			logger.debug("Finished processing record from SQS");
			return EMPTY_BATCH_RESPONSE;
		} catch (error: any) {
			logger.error({ message: "SQS Event could not be processed", error });
			return EMPTY_BATCH_RESPONSE;
		}
	}
}

const handlerClass = new PostEventHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
