import { SQSBatchResponse, SQSEvent, SQSRecord } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { PostEventProcessor } from "./services/PostEventProcessor";
import { Constants, TXMA_EVENT_DETAILS } from "./utils/Constants";
import { SessionReturnRecord } from "./models/SessionReturnRecord";
import { IPRService } from "./services/IPRService";
import { EnvironmentVariables } from "./services/EnvironmentVariables";
import { ServicesEnum } from "./models/enums/ServicesEnum";
import { createDynamoDbClient } from "./utils/DynamoDBFactory";

const {
    POWERTOOLS_METRICS_NAMESPACE = Constants.IPVRETURN_METRICS_NAMESPACE,
    POWERTOOLS_LOG_LEVEL = Constants.DEBUG,
    POWERTOOLS_SERVICE_NAME = Constants.POSTEVENT_LOGGER_SVC_NAME
} = process.env;

const logger = new Logger({logLevel: POWERTOOLS_LOG_LEVEL, serviceName: POWERTOOLS_SERVICE_NAME});

const metrics = new Metrics({ namespace: POWERTOOLS_METRICS_NAMESPACE, serviceName: POWERTOOLS_SERVICE_NAME });

class AuthRequestEventHandler implements LambdaInterface {
    @metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
    async handler(event: SQSEvent, context: any): Promise<SQSBatchResponse> {
        logger.setPersistentLogAttributes({});
        logger.addContext(context);

				const environmentVariables: EnvironmentVariables = new EnvironmentVariables(logger, ServicesEnum.POST_EVENT_SERVICE)
				const iprService: IPRService = IPRService.getInstance(environmentVariables.sessionEventsTable(), logger, createDynamoDbClient());

				const returnRecord = new SessionReturnRecord(eventDetails, expiresOn);

			// 	if (!this.checkIfValidString([user.email, eventDetails.client_id, eventDetails.clientLandingPageUrl])) {
			// 		const errorMessage = `Missing or invalid value for any or all of userDetails.email, eventDetails.client_id, eventDetails.clientLandingPageUrl fields required for AUTH_IPV_AUTHORISATION_REQUESTED event type`;
			// 		logger.warn({ message: errorMessage }, { messageCode: MessageCodes.MISSING_MANDATORY_FIELDS });
			// 		return `Missing info in ${Constants.AUTH_IPV_AUTHORISATION_REQUESTED} event, unlikely this event was meant for F2F`;
			// }

			const updateExpression = TXMA_EVENT_DETAILS.AUTH_REQUESTED.UpdateExpression;
			const expressionAttributeValues = {
					":userEmail": returnRecord.userEmail,
					":ipvStartedOn": returnRecord.ipvStartedOn,
					":clientName": returnRecord.clientName,
					":redirectUri": returnRecord.redirectUri,
					":expiresOn": returnRecord.expiresDate,
			};

			const saveEventData = await this.iprService.saveEventData(user_id, updateExpression, expressionAttributeValues);

    }
}

const handlerClass = new AuthRequestEventHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
