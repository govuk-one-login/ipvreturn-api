import { DynamoDBRecord, DynamoDBStreamEvent } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics, MetricUnits } from "@aws-lambda-powertools/metrics";
import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { Constants } from "./utils/Constants";
import { SessionEventProcessor } from "./services/SessionEventProcessor";
import { POFailureEventProcessor } from "./services/POFailureEventProcessor";
import { DynamoDBBatchResponse } from "aws-lambda/trigger/dynamodb-stream";

import { unmarshall } from "@aws-sdk/util-dynamodb";
const POWERTOOLS_METRICS_NAMESPACE = process.env.POWERTOOLS_METRICS_NAMESPACE ? process.env.POWERTOOLS_METRICS_NAMESPACE : Constants.IPVRETURN_METRICS_NAMESPACE;
const POWERTOOLS_LOG_LEVEL = process.env.POWERTOOLS_LOG_LEVEL ? process.env.POWERTOOLS_LOG_LEVEL : Constants.DEBUG;
const POWERTOOLS_SERVICE_NAME = process.env.POWERTOOLS_SERVICE_NAME ? process.env.POWERTOOLS_SERVICE_NAME : Constants.STREAM_PROCESSOR_LOGGER_SVC_NAME;

const logger = new Logger({
	logLevel: POWERTOOLS_LOG_LEVEL,
	serviceName: POWERTOOLS_SERVICE_NAME,
});

const metrics = new Metrics({ namespace: POWERTOOLS_METRICS_NAMESPACE, serviceName: POWERTOOLS_SERVICE_NAME });

class StreamProcessorHandler implements LambdaInterface {

	@metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
	async handler(event: DynamoDBStreamEvent, context: any): Promise<DynamoDBBatchResponse> {

		// clear PersistentLogAttributes set by any previous invocation, and add lambda context for this invocation
		logger.setPersistentLogAttributes({});
		logger.addContext(context);
		
		logger.debug("DB Stream event received");
		if (event.Records.length === 1) {
			const record: DynamoDBRecord = event.Records[0];
			logger.info("Starting to process stream record");
			try {
				if (record.eventName === "MODIFY") {
					// @ts-expect-error allow undefined to be passed
					const sessionEvent = unmarshall(record.dynamodb?.NewImage);
					
					if (sessionEvent.readyToResumeOn && sessionEvent.errorDescription?.toLowerCase().includes("vc generation failed")) {
						await POFailureEventProcessor.getInstance(logger, metrics).processRequest(sessionEvent);
					} else {
						await SessionEventProcessor.getInstance(logger, metrics).processRequest(sessionEvent);
					}
					return { batchItemFailures:[] };
				} else {
					logger.warn("Record eventName doesnt match MODIFY state");
					return { batchItemFailures:[] };
				}
			} catch (error: any) {
				// Reorganise to only run on specific events
				const singleMetric = metrics.singleMetric();
				singleMetric.addDimension("reason", error.message);
				singleMetric.addMetric("StreamEventProcessor_unprocessed_events", MetricUnits.Count, 1);
				
				logger.info({ message: "An error has occurred when processing the session record ", error });
				return { batchItemFailures:[] };
			}
		} else {
			logger.warn("Unexpected no of records received");
			return { batchItemFailures:[] };
		}
	}

}

const handlerClass = new StreamProcessorHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
