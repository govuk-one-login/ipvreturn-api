import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { Response } from "./utils/Response";
import { ResourcesEnum } from "./models/enums/ResourcesEnum";
import { HttpCodesEnum } from "./utils/HttpCodesEnum";
import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { SessionProcessor } from "./services/SessionProcessor";
import { HttpVerbsEnum } from "./utils/HttpVerbsEnum";
import { getParameter } from "./utils/Config";
import { EnvironmentVariables } from "./services/EnvironmentVariables";
import { ServicesEnum } from "./models/enums/ServicesEnum";

const POWERTOOLS_METRICS_NAMESPACE = process.env.POWERTOOLS_METRICS_NAMESPACE ? process.env.POWERTOOLS_METRICS_NAMESPACE : "CIC-CRI";
const POWERTOOLS_LOG_LEVEL = process.env.POWERTOOLS_LOG_LEVEL ? process.env.POWERTOOLS_LOG_LEVEL : "DEBUG";

const logger = new Logger({
	logLevel: POWERTOOLS_LOG_LEVEL,
	serviceName: "SessionHandler",
});
let CLIENT_ID: string;

const metrics = new Metrics({ namespace: POWERTOOLS_METRICS_NAMESPACE, serviceName: "SessionHandler" });

class Session implements LambdaInterface {
	private readonly environmentVariables = new EnvironmentVariables(logger, ServicesEnum.GET_SESSION_EVENT_DATA_SERVICE);

	@metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
	@logger.injectLambdaContext()
	async handler(event: APIGatewayProxyEvent, context: any): Promise<APIGatewayProxyResult> {

		// clear PersistentLogAttributes set by any previous invocation, and add lambda context for this invocation
		logger.setPersistentLogAttributes({});
		logger.addContext(context);
		logger.debug("metrics is", { metrics });

		switch (event.resource) {
			case ResourcesEnum.SESSION:
				if (event.httpMethod === HttpVerbsEnum.GET) {
					try {
						logger.info({ message: "Got Session request:" }, { requestId: event.requestContext.requestId });
						if (!CLIENT_ID) {
							logger.info({ message: "Fetching CLIENT_ID from SSM" });
							try {
								CLIENT_ID = await getParameter(this.environmentVariables.clientIdSsmPath());
							} catch (err) {
								logger.error(`failed to get param from ssm at ${this.environmentVariables.clientIdSsmPath()}`, { err });
								throw err;
							}
						}
						return await SessionProcessor.getInstance(logger, metrics, CLIENT_ID).processRequest(event);
					} catch (err) {
						logger.error({ message: "An error has occurred. ", err });
						return new Response(HttpCodesEnum.SERVER_ERROR, "An error has occurred");
					}
				}
				return new Response(HttpCodesEnum.NOT_FOUND, "");
			default:
				return new Response(HttpCodesEnum.NOT_FOUND, "Resource not found");
		}
	}

}
const handlerClass = new Session();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
