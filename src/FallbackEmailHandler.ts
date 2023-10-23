import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { Response } from "./utils/Response";
import { HttpCodesEnum } from "./utils/HttpCodesEnum";
import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { FallbackEmailProcessor } from "./services/FallbackEmailProcessor";
import { MessageCodes } from "./models/enums/MessageCodes";
import { AppError } from "./utils/AppError";
import { Constants } from "./utils/Constants";

const POWERTOOLS_METRICS_NAMESPACE = process.env.POWERTOOLS_METRICS_NAMESPACE ? process.env.POWERTOOLS_METRICS_NAMESPACE : "IPR-CRI";
const POWERTOOLS_LOG_LEVEL = process.env.POWERTOOLS_LOG_LEVEL ? process.env.POWERTOOLS_LOG_LEVEL : "DEBUG";
const POWERTOOLS_SERVICE_NAME = process.env.POWERTOOLS_SERVICE_NAME ? process.env.POWERTOOLS_SERVICE_NAME : Constants.FALLBACK_EMAIL_LOGGER_SVC_NAME;

const logger = new Logger({
	logLevel: POWERTOOLS_LOG_LEVEL,
	serviceName: POWERTOOLS_SERVICE_NAME,
});

const metrics = new Metrics({ namespace: POWERTOOLS_METRICS_NAMESPACE, serviceName: POWERTOOLS_SERVICE_NAME });

class FallbackEmailHandler implements LambdaInterface {
	@metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
	async handler(event: any, context: any) {
		logger.setPersistentLogAttributes({});
		logger.addContext(context);

		try {
			return await FallbackEmailProcessor.getInstance(logger, metrics).processRequest();
		} catch (error: any) {
			const statusCode = error instanceof AppError ? error.statusCode : HttpCodesEnum.SERVER_ERROR;
			logger.error("An error has occurred.", { messageCode: MessageCodes.SERVER_ERROR });
			return new Response(statusCode, "Server Error");
		}
	}
}

const handlerClass = new FallbackEmailHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
