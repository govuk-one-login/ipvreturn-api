import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { Response } from "./utils/Response";
import { HttpCodesEnum } from "./utils/HttpCodesEnum";
import { SessionProcessor } from "./services/SessionProcessor";
import { getParameter } from "./utils/Config";
import { EnvironmentVariables } from "./services/EnvironmentVariables";
import { ServicesEnum } from "./models/enums/ServicesEnum";
import { MessageCodes } from "./models/enums/MessageCodes";
import { AppError } from "./utils/AppError";
import { Constants } from "./utils/Constants";

const POWERTOOLS_METRICS_NAMESPACE = process.env.POWERTOOLS_METRICS_NAMESPACE || Constants.IPVRETURN_METRICS_NAMESPACE;
const POWERTOOLS_LOG_LEVEL = process.env.POWERTOOLS_LOG_LEVEL || Constants.DEBUG;
const POWERTOOLS_SERVICE_NAME = process.env.POWERTOOLS_SERVICE_NAME || Constants.STREAM_PROCESSOR_LOGGER_SVC_NAME;

const logger = new Logger({
	logLevel: POWERTOOLS_LOG_LEVEL,
	serviceName: POWERTOOLS_SERVICE_NAME,
});

const metrics = new Metrics({ namespace: POWERTOOLS_METRICS_NAMESPACE, serviceName: POWERTOOLS_SERVICE_NAME });

let CLIENT_ID: string;

class Session {
  private readonly environmentVariables = new EnvironmentVariables(logger, ServicesEnum.GET_SESSION_EVENT_DATA_SERVICE);

  @metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
  @logger.injectLambdaContext()

  async handler(event: APIGatewayProxyEvent, context: any): Promise<APIGatewayProxyResult> {
    logger.setPersistentLogAttributes({});
    logger.addContext(context);

    logger.debug("metrics is", { metrics });

    try {
      logger.info({ message: "Got Session request:" }, { requestId: event.requestContext.requestId });
      if (!CLIENT_ID) {
        logger.info({ message: "Fetching CLIENT_ID from SSM" });
        CLIENT_ID = await getParameter(this.environmentVariables.clientIdSsmPath());
      }
      return SessionProcessor.getInstance(logger, metrics, CLIENT_ID).processRequest(event);
    } catch (error) {
      logger.error({ message: "An error has occurred. ", error, messageCode: MessageCodes.SERVER_ERROR });
      return error instanceof AppError ? new Response(error.statusCode, error.message) : new Response(HttpCodesEnum.SERVER_ERROR, "An error has occurred");
    }
  }
}

const handlerClass = new Session();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);