import { SQSEvent, SQSRecord } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { Response } from "./utils/Response";
import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { HttpCodesEnum } from "./models/enums/HttpCodesEnum";
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
	async handler(event: SQSEvent, context: any): Promise<Response> {
		if (event.Records.length === 1) {

			const record: SQSRecord = event.Records[0];
			logger.debug("Starting to process record", { record });

			try {
				const postEventResponse = await PostEventProcessor.getInstance(logger, metrics).processRequest(record.body);
				const responseBody = {
					batchItemFailures: [],
				};

				logger.debug("Finished processing record from SQS");
				return new Response(postEventResponse.statusCode, responseBody);

			} catch (error: any) {
				logger.error({ message: "SQS Event could not be processed", error });
				return new Response(HttpCodesEnum.SERVER_ERROR, "postEvent - Event could not be processed");
			}

		} else {
			logger.warn({ message: "Unexpected no. of records received", numOfRecords: event.Records.length });
			return new Response(HttpCodesEnum.BAD_REQUEST, "Unexpected no. of records received");
		}
	}

}

const handlerClass = new PostEventHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
