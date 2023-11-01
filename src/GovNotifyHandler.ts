import { SQSBatchItemFailure, SQSBatchResponse, SQSEvent, SQSRecord } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { Constants } from "./utils/Constants";
import { SendEmailProcessor } from "./services/SendEmailProcessor";
import { getParameter } from "./utils/Config";
import { EnvironmentVariables } from "./services/EnvironmentVariables";
import { ServicesEnum } from "./models/enums/ServicesEnum";
import { Email, DynamicEmail } from "./models/Email";

const {
	POWERTOOLS_METRICS_NAMESPACE = Constants.IPVRETURN_METRICS_NAMESPACE,
	POWERTOOLS_LOG_LEVEL = Constants.DEBUG,
	POWERTOOLS_SERVICE_NAME = Constants.EMAIL_LOGGER_SVC_NAME,
} = process.env;

const logger = new Logger({ logLevel: POWERTOOLS_LOG_LEVEL, serviceName: POWERTOOLS_SERVICE_NAME });

const metrics = new Metrics({ namespace: POWERTOOLS_METRICS_NAMESPACE, serviceName: POWERTOOLS_SERVICE_NAME });

let GOVUKNOTIFY_API_KEY: string;
class GovNotifyHandler implements LambdaInterface {
  private readonly environmentVariables = new EnvironmentVariables(logger, ServicesEnum.GOV_NOTIFY_SERVICE);

  @metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
  async handler(event: SQSEvent, context: any): Promise<SQSBatchResponse> {
  	logger.setPersistentLogAttributes({});
  	logger.addContext(context);

  	const batchFailures: SQSBatchItemFailure[] = [];

  	if (event.Records.length !== 1) {
  		logger.warn("Unexpected number of records received");
  		batchFailures.push({ itemIdentifier: "" });
  		return { batchItemFailures: batchFailures };
  	}

  	const record: SQSRecord = event.Records[0];
  	logger.info("Starting to process record from SQS");

  	try {
  		const body = JSON.parse(record.body);
      
  		GOVUKNOTIFY_API_KEY = await this.checkGovNotifyApiKey(GOVUKNOTIFY_API_KEY);
  		const govnotifyServiceId = this.extractGovNotifyServiceId(GOVUKNOTIFY_API_KEY);

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
  				return { batchItemFailures: batchFailures };
  		}

  		await SendEmailProcessor.getInstance(logger, metrics, GOVUKNOTIFY_API_KEY, govnotifyServiceId, this.environmentVariables.sessionEventsTable()).processRequest(message);
  		logger.info("Finished processing record from SQS");

  		return { batchItemFailures: [] };
  	} catch (error: any) {
  		logger.error("Email could not be sent. Returning failed message", "Handler");
  		batchFailures.push({ itemIdentifier: "" });
  		return { batchItemFailures: batchFailures };
  	}
  }

  private async checkGovNotifyApiKey(GOVUKNOTIFY_API_KEY: string) {
  	if (!GOVUKNOTIFY_API_KEY) {
  		logger.info({ message: "Fetching GOVUKNOTIFY_API_KEY from SSM" });
  		try {
  			return await getParameter(this.environmentVariables.govNotifyApiKeySsmPath());
  		} catch (error) {
  			logger.error(`failed to get param from ssm at ${this.environmentVariables.govNotifyApiKeySsmPath()}`, { error });
  			throw error;
  		}
  	} else return GOVUKNOTIFY_API_KEY;
  }

  private extractGovNotifyServiceId(GOVUKNOTIFY_API_KEY: string): string {
  	let govnotifyServiceId;

  	try {
  		govnotifyServiceId = GOVUKNOTIFY_API_KEY.substring(GOVUKNOTIFY_API_KEY.length - 73, GOVUKNOTIFY_API_KEY.length - 37);
  	} catch (error) {
  		logger.error("Failed to extract govnotifyServiceId from the GOVUKNOTIFY_API_KEY", { error });
  		throw error;
  	}

  	return govnotifyServiceId;
  }
}

const handlerClass = new GovNotifyHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
