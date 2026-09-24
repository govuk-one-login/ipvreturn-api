import { SQSEvent, SQSRecord } from "aws-lambda";
import { logger } from "@govuk-one-login/cri-logger";
import { Metrics, MetricUnit } from "@aws-lambda-powertools/metrics";
import { LambdaInterface } from "@aws-lambda-powertools/commons/types";
import { PostEventProcessor } from "./services/PostEventProcessor";

const POWERTOOLS_METRICS_NAMESPACE = process.env.POWERTOOLS_METRICS_NAMESPACE;
const POWERTOOLS_SERVICE_NAME = process.env.POWERTOOLS_SERVICE_NAME;

const metrics = new Metrics({ namespace: POWERTOOLS_METRICS_NAMESPACE, serviceName: POWERTOOLS_SERVICE_NAME });
logger.setLogLevel("DEBUG");
console.log("LOG LEVEL 1", logger.getLevelName())
class PostEventHandler implements LambdaInterface {

	@metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
	async handler(event: SQSEvent, context: any): Promise<any> {

		// clear logger state set by any previous invocation, and add lambda context for this invocation
		logger.resetKeys();
		logger.addContext(context);
		logger.setLogLevel("DEBUG");
		console.log("LOG LEVEL 2", logger.getLevelName())
		if (event.Records.length === 1) {
			let body;
			const record: SQSRecord = event.Records[0];

			try {
				body = JSON.parse(record.body);
				// ignored so as not log PII
				/* eslint-disable @typescript-eslint/no-unused-vars */
			} catch (error) {
				logger.error({ message:"Received invalid JSON in the SQS event record.body" });
				return { batchItemFailures:[] };
			}
			console.log("LOG LEVEL 3", logger.getLevelName())
			logger.debug("Starting to process record IN DEBUG MODE", { event_name: body.event_name });
			logger.info("Starting to process record IN DEBUG MODE", { event_name: body.event_name });
			logger.setLogLevel("INFO");
			console.log("LOG LEVEL 4", logger.getLevelName())
			logger.debug("Starting to process record IN INFO MODE", { event_name: body.event_name });
			logger.info("Starting to process record IN INFO MODE", { event_name: body.event_name });

			try {
				await PostEventProcessor.getInstance(metrics).processRequest(record.body);

				logger.debug("Finished processing record from SQS");
				return { batchItemFailures:[] };

			} catch (error: any) {
				logger.error({ message: "SQS Event could not be processed", error });
				const singleMetric = metrics.singleMetric();
				singleMetric.addDimension("reason", error.message);
				singleMetric.addMetric("PostEventProcessor_error_events", MetricUnit.Count, 1);
				return { 
					batchItemFailures:[] 
				};
			}

		} else {
			logger.warn({ message: "Unexpected no. of records received", numOfRecords: event.Records.length });
			return { batchItemFailures:[] };
		}
	}

}

const handlerClass = new PostEventHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
