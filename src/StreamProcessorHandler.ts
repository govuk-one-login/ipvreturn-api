import { DynamoDBRecord, DynamoDBStreamEvent } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { Response } from "./utils/Response";
import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { Constants } from "./utils/Constants";
import { HttpCodesEnum } from "./models/enums/HttpCodesEnum";
import { EnvironmentVariables } from "./services/EnvironmentVariables";
import { ServicesEnum } from "./models/enums/ServicesEnum";
import { SessionEventProcessor } from "./services/SessionEventProcessor";

const { unmarshall } = require("@aws-sdk/util-dynamodb");
const POWERTOOLS_METRICS_NAMESPACE = process.env.POWERTOOLS_METRICS_NAMESPACE ? process.env.POWERTOOLS_METRICS_NAMESPACE : Constants.IPVRETURN_METRICS_NAMESPACE;
const POWERTOOLS_LOG_LEVEL = process.env.POWERTOOLS_LOG_LEVEL ? process.env.POWERTOOLS_LOG_LEVEL : Constants.DEBUG;
const POWERTOOLS_SERVICE_NAME = process.env.POWERTOOLS_SERVICE_NAME ? process.env.POWERTOOLS_SERVICE_NAME : Constants.STREAM_PROCESSOR_LOGGER_SVC_NAME;

const logger = new Logger({
	logLevel: POWERTOOLS_LOG_LEVEL,
	serviceName: POWERTOOLS_SERVICE_NAME,
});

const metrics = new Metrics({ namespace: POWERTOOLS_METRICS_NAMESPACE, serviceName: POWERTOOLS_SERVICE_NAME });

class StreamProcessorHandler implements LambdaInterface {
	private readonly environmentVariables = new EnvironmentVariables(logger, ServicesEnum.STREAM_PROCESSOR_SERVICE);

	@metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
	async handler(event: DynamoDBStreamEvent, context: any): Promise<any> {
		if (event.Records.length === 1) {
			const record: DynamoDBRecord = event.Records[0];
			logger.debug("Starting to process stream record", { record });

			try {
				if (record.eventName === "MODIFY") {
					const sessionEvent = unmarshall(record.dynamodb?.NewImage);
					logger.debug("Parsed session event", JSON.stringify(sessionEvent));
					return await SessionEventProcessor.getInstance(logger, metrics).processRequest(sessionEvent);
				} else {
					logger.debug("Record eventName doesnt match MODIFY state");
				}
			} catch (error) {
				logger.error({ message: "An error has occurred. ", error });
				return new Response(HttpCodesEnum.SERVER_ERROR, "An error has occurred");
			}
		} else {
			logger.warn("Unexpected no of records received");
			return new Response(HttpCodesEnum.BAD_REQUEST, "Unexpected no of records received");
		}
	}

}

const handlerClass = new StreamProcessorHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
