import { DynamoDBRecord, DynamoDBStreamEvent } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { Constants } from "./utils/Constants";
import { RecordStreamProcessor } from "./services/RecordStreamProcessor";
import { DynamoDBBatchResponse } from "aws-lambda/trigger/dynamodb-stream";

const { unmarshall } = require("@aws-sdk/util-dynamodb");
const {
	POWERTOOLS_METRICS_NAMESPACE = Constants.IPVRETURN_METRICS_NAMESPACE,
	POWERTOOLS_LOG_LEVEL = Constants.DEBUG,
	POWERTOOLS_SERVICE_NAME = Constants.STREAM_PROCESSOR_LOGGER_SVC_NAME,
} = process.env;

const logger = new Logger({ logLevel: POWERTOOLS_LOG_LEVEL, serviceName: POWERTOOLS_SERVICE_NAME });

const metrics = new Metrics({ namespace: POWERTOOLS_METRICS_NAMESPACE, serviceName: POWERTOOLS_SERVICE_NAME });

class RecordStreamHandler implements LambdaInterface {
	@metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
	async handler(event: DynamoDBStreamEvent, context: any): Promise<DynamoDBBatchResponse> {
		logger.setPersistentLogAttributes({});
		logger.addContext(context);

		logger.debug("DB Stream event received");

		if (event.Records.length !== 1) {
			logger.warn("Unexpected number of records received");
			return { batchItemFailures: [] };
		}

		const record: DynamoDBRecord = event.Records[0];

		if (record.eventName !== "MODIFY") {
			logger.warn("Record eventName doesn't match MODIFY state");
			return { batchItemFailures: [] };
		}

		try {
			const sessionEvent = unmarshall(record.dynamodb?.NewImage);
			await RecordStreamProcessor.getInstance(logger, metrics).processRequest(sessionEvent);
			return { batchItemFailures: [] };
		} catch (error) {
			logger.info({ message: "An error has occurred when processing the session record", error });
			return { batchItemFailures: [] };
		}
	}
}


const handlerClass = new RecordStreamHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
