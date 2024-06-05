import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { Response } from "./utils/Response";

import { HttpCodesEnum } from "./utils/HttpCodesEnum";
import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { AppError } from "./utils/AppError";
import { OidcAuthorizeProcessor } from "./services/OidcAuthorizeProcessor";


const POWERTOOLS_METRICS_NAMESPACE = process.env.POWERTOOLS_METRICS_NAMESPACE ? process.env.POWERTOOLS_METRICS_NAMESPACE : Constants.F2F_METRICS_NAMESPACE;
const POWERTOOLS_LOG_LEVEL = process.env.POWERTOOLS_LOG_LEVEL ? process.env.POWERTOOLS_LOG_LEVEL : Constants.DEBUG;
const POWERTOOLS_SERVICE_NAME = process.env.POWERTOOLS_SERVICE_NAME ? process.env.POWERTOOLS_SERVICE_NAME : Constants.AUTHORIZATIONCODE_LOGGER_SVC_NAME;

const logger = new Logger({
	logLevel: POWERTOOLS_LOG_LEVEL,
	serviceName: POWERTOOLS_SERVICE_NAME,
});

const metrics = new Metrics({ namespace: POWERTOOLS_METRICS_NAMESPACE, serviceName: POWERTOOLS_SERVICE_NAME });

class MockOidcAutorizeHandler implements LambdaInterface {

	@metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
	async handler(event: APIGatewayProxyEvent, context: any): Promise<APIGatewayProxyResult> {
		try {
			logger.info("Event received: OIDC Authorize endpoint");
			return await OidcAuthorizeProcessor.getInstance(logger, metrics).returnAuthCode(event);						 
		} catch (err: any) {
			logger.error({ message: "An error has occurred.", err });
			if (err instanceof AppError) {
				return new Response(err.statusCode, err.message);
			}
			return new Response(HttpCodesEnum.SERVER_ERROR, "An error has occurred");
		}				 
	}
}
const handlerClass = new MockOidcAutorizeHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
