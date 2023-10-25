import { SQSBatchItemFailure, SQSEvent, SQSRecord } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { Constants } from "./utils/Constants";
import { SendEmailProcessor } from "./services/SendEmailProcessor";
import { getParameter } from "./utils/Config";
import { EnvironmentVariables } from "./services/EnvironmentVariables";
import { ServicesEnum } from "./models/enums/ServicesEnum";
import { Email, DynamicEmail } from "./models/Email";

const POWERTOOLS_METRICS_NAMESPACE = process.env.POWERTOOLS_METRICS_NAMESPACE || Constants.IPVRETURN_METRICS_NAMESPACE;
const POWERTOOLS_LOG_LEVEL = process.env.POWERTOOLS_LOG_LEVEL || Constants.DEBUG;
const POWERTOOLS_SERVICE_NAME = process.env.POWERTOOLS_SERVICE_NAME || Constants.GOV_NOTIFY_SVC_NAME;

const logger = new Logger({
  logLevel: POWERTOOLS_LOG_LEVEL,
  serviceName: POWERTOOLS_SERVICE_NAME,
});

const metrics = new Metrics({ namespace: POWERTOOLS_METRICS_NAMESPACE, serviceName: POWERTOOLS_SERVICE_NAME });

let GOVUKNOTIFY_API_KEY: string;

class GovNotifyHandler implements LambdaInterface {
  private readonly environmentVariables = new EnvironmentVariables(logger, ServicesEnum.GOV_NOTIFY_SERVICE);

  async handler(event: SQSEvent): Promise<SQSBatchItemFailure[]> {
    logger.setPersistentLogAttributes({});
    const batchFailures: SQSBatchItemFailure[] = [];

    if (event.Records.length !== 1) {
      logger.warn("Unexpected number of records received");
      batchFailures.push({ itemIdentifier: "" });
      return batchFailures;
    }

    const record: SQSRecord = event.Records[0];
    logger.info("Starting to process record from SQS");

    try {
      const body = JSON.parse(record.body);

      if (!GOVUKNOTIFY_API_KEY) {
        logger.info({ message: "Fetching GOVUKNOTIFY_API_KEY from SSM" });
        GOVUKNOTIFY_API_KEY = await getParameter(this.environmentVariables.govNotifyApiKeySsmPath());
      }

      const govnotifyServiceId = GOVUKNOTIFY_API_KEY.substring(GOVUKNOTIFY_API_KEY.length - 73, GOVUKNOTIFY_API_KEY.length - 37);
      const messageType = body.Message.messageType;
      let message;

      switch (messageType) {
        case Constants.VIST_PO_EMAIL_STATIC:
          message = Email.parseRequest(JSON.stringify(body.Message));
          break;
        case Constants.VIST_PO_EMAIL_DYNAMIC:
          message = DynamicEmail.parseRequest(JSON.stringify(body.Message));
          break;
        default:
          logger.error(`Unrecognized emailType: ${messageType}, unable to process Gov Notify message.`);
          batchFailures.push({ itemIdentifier: "" });
          return batchFailures;
      }

      await SendEmailProcessor.getInstance(logger, metrics, GOVUKNOTIFY_API_KEY, govnotifyServiceId, this.environmentVariables.sessionEventsTable()).processRequest(message);
      logger.info("Finished processing record from SQS");
    } catch (error: any) {
      logger.error("Email could not be sent. Returning failed message", "Handler");
      batchFailures.push({ itemIdentifier: "" });
    }

    return batchFailures;
  }
}

const handlerClass = new GovNotifyHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
