import { SQSBatchItemFailure, SQSBatchResponse, SQSEvent, SQSRecord } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { Constants } from "./utils/Constants";
import { SendEmailProcessor } from "./services/SendEmailProcessor";
import { getParameter } from "./utils/Config";
import { EnvironmentVariables } from "./services/EnvironmentVariables";
import { ServicesEnum } from "./models/enums/ServicesEnum";
import { DynamicEmail, Email, FallbackEmail, VCGenerationFailureEmail } from "./models/Email";


const POWERTOOLS_METRICS_NAMESPACE = process.env.POWERTOOLS_METRICS_NAMESPACE ? process.env.POWERTOOLS_METRICS_NAMESPACE : Constants.IPVRETURN_METRICS_NAMESPACE;
const POWERTOOLS_LOG_LEVEL = process.env.POWERTOOLS_LOG_LEVEL ? process.env.POWERTOOLS_LOG_LEVEL : Constants.DEBUG;
const POWERTOOLS_SERVICE_NAME = process.env.POWERTOOLS_SERVICE_NAME ? process.env.POWERTOOLS_SERVICE_NAME : Constants.EMAIL_LOGGER_SVC_NAME;

const logger = new Logger({
	logLevel: POWERTOOLS_LOG_LEVEL,
	serviceName: POWERTOOLS_SERVICE_NAME,
});

const metrics = new Metrics({ namespace: POWERTOOLS_METRICS_NAMESPACE, serviceName: POWERTOOLS_SERVICE_NAME });

let GOVUKNOTIFY_API_KEY: string;
class GovNotifyHandler implements LambdaInterface {
	private readonly environmentVariables = new EnvironmentVariables(logger, ServicesEnum.GOV_NOTIFY_SERVICE);

	@metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
	async handler(event: SQSEvent, context: any): Promise<SQSBatchResponse> {

		// clear PersistentLogAttributes set by any previous invocation, and add lambda context for this invocation
		logger.setPersistentLogAttributes({});
		logger.addContext(context);
	
		const batchFailures: SQSBatchItemFailure[] = [];
		if (event.Records.length === 1) {
			const record: SQSRecord = event.Records[0];
			logger.info("Starting to process record from SQS");

			try {
				const body = JSON.parse(record.body);
				if (!GOVUKNOTIFY_API_KEY) {
					logger.info({ message: "Fetching GOVUKNOTIFY_API_KEY from SSM" });
					try {
						GOVUKNOTIFY_API_KEY = await getParameter(this.environmentVariables.govNotifyApiKeySsmPath());
					} catch (error) {
						logger.error(`failed to get param from ssm at ${this.environmentVariables.govNotifyApiKeySsmPath()}`, { error });
						batchFailures.push({ itemIdentifier: "" });
						return { batchItemFailures: batchFailures };
					}
				}
				let govnotifyServiceId;
				try {
					govnotifyServiceId = GOVUKNOTIFY_API_KEY.substring(GOVUKNOTIFY_API_KEY.length - 73, GOVUKNOTIFY_API_KEY.length - 37);
				} catch (error) {
					logger.error("failed to extract govnotifyServiceId from the GOVUKNOTIFY_API_KEY", { error });
					batchFailures.push({ itemIdentifier: "" });
					return { batchItemFailures: batchFailures };
				}
				// Check for messageType and reject it if it doesnt match the required types.
				const messageType = body.Message.messageType;
				let message;
				switch (messageType) {
					case Constants.VIST_PO_EMAIL_STATIC: {
						message = Email.parseRequest(JSON.stringify(body.Message));
						break;
					}
					case Constants.VIST_PO_EMAIL_DYNAMIC: {
						message = DynamicEmail.parseRequest(JSON.stringify(body.Message));
						break;
					}
					case Constants.VISIT_PO_EMAIL_FALLBACK: {
						message = FallbackEmail.parseRequest(JSON.stringify(body.Message));
						break;
					}
					case Constants.VC_GENERATION_FAILURE_EMAIL: {
						message = VCGenerationFailureEmail.parseRequest(JSON.stringify(body.Message));
						break;
					}
					default :{
						logger.error(`Unrecognised emailType: ${messageType}, unable to process Gov Notify message.`);
						batchFailures.push({ itemIdentifier: "" });
						return { batchItemFailures: batchFailures };
					}
				}	

				await SendEmailProcessor.getInstance(logger, metrics, GOVUKNOTIFY_API_KEY, govnotifyServiceId, this.environmentVariables.sessionEventsTable()).processRequest(message);
				logger.info("Finished processing record from SQS");

				// return an empty batchItemFailures array to mark the batch as a success
				// see https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html#services-sqs-batchfailurereporting
				return { batchItemFailures: [] };			
				// ignored so as not log PII
				/* eslint-disable @typescript-eslint/no-unused-vars */
			} catch (error: any) {
				logger.error("Email could not be sent. Returning failed message", "Handler");

				// explicitly set itemIdentifier to an empty string to fail the whole batch
				// see https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html#services-sqs-batchfailurereporting
				batchFailures.push({ itemIdentifier: "" });
				return { batchItemFailures: batchFailures };
			}

		} else {
			logger.warn("Unexpected no of records received");

			// explicitly set itemIdentifier to an empty string to fail the whole batch
			// see https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html#services-sqs-batchfailurereporting
			batchFailures.push({ itemIdentifier: "" });
			return { batchItemFailures: batchFailures };
		}
	}

}

const handlerClass = new GovNotifyHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
