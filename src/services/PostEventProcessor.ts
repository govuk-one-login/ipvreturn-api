import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { AppError } from "../utils/AppError";
import { HttpCodesEnum } from "../models/enums/HttpCodesEnum";
import { Constants } from "../utils/Constants";
import { IPRService } from "./IPRService";
import { EnvironmentVariables } from "./EnvironmentVariables";
import { ServicesEnum } from "../models/enums/ServicesEnum";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
import { ReturnSQSEvent } from "../models/ReturnSQSEvent";
import { SessionReturnRecord } from "../models/SessionReturnRecord";
import { absoluteTimeNow } from "../utils/DateTimeUtils";
import { MessageCodes } from "../models/enums/MessageCodes";

export class PostEventProcessor {
	private static instance: PostEventProcessor;

	private readonly logger: Logger;

	private readonly metrics: Metrics;

	private readonly environmentVariables: EnvironmentVariables;

	private readonly iprService: IPRService;

	constructor(logger: Logger, metrics: Metrics) {
		this.logger = logger;
		this.metrics = metrics;
		this.environmentVariables = new EnvironmentVariables(logger, ServicesEnum.POST_EVENT_SERVICE);
		this.iprService = IPRService.getInstance(this.environmentVariables.sessionEventsTable(), this.logger, createDynamoDbClient());
	}

	static getInstance(logger: Logger, metrics: Metrics): PostEventProcessor {
		if (!PostEventProcessor.instance) {
			PostEventProcessor.instance = new PostEventProcessor(logger, metrics);
		}
		return PostEventProcessor.instance;
	}

  async processRequest(eventBody: any): Promise<any> {
    try {
      const eventDetails: ReturnSQSEvent = JSON.parse(eventBody);
      const eventName = eventDetails.event_name;
      let updateExpression: string = "";
      let expressionAttributeValues: { [key: string]: any } = {};

      if (!eventDetails.event_id) {
        this.handleError("Missing event_id in the incoming SQS event", MessageCodes.MISSING_MANDATORY_FIELDS);
      }

      this.logger.appendKeys({ event_id: eventDetails.event_id });

      this.logger.info({ message: `Received SQS event with eventName ${eventName}` });

      if (!this.checkIfValidString([eventName]) || !eventDetails.timestamp) {
        this.handleError("Missing or invalid value for event name or timestamp in the incoming SQS event", MessageCodes.MISSING_MANDATORY_FIELDS);
      }

      if (!eventDetails.user) {
        this.handleError("Missing user details in the incoming SQS event", MessageCodes.MISSING_MANDATORY_FIELDS);
      }

      const userDetails = eventDetails.user;
      this.logger.appendKeys({ govuk_signin_journey_id: userDetails.govuk_signin_journey_id });

      if (!this.checkIfValidString([userDetails.user_id])) {
        this.handleError("Missing or invalid value for userDetails.user_id in event payload", MessageCodes.MISSING_MANDATORY_FIELDS);
      }

      const userId = userDetails.user_id;

      const isFlaggedForDeletionOrEventAlreadyProcessed = await this.iprService.isFlaggedForDeletionOrEventAlreadyProcessed(userId, eventName);
      
      if (isFlaggedForDeletionOrEventAlreadyProcessed) {
        this.logger.info({ message: "Record flagged for deletion or event already processed, skipping update" });
        return "Record flagged for deletion or event already processed, skipping update";
      }

      let expiresOn = absoluteTimeNow() + this.environmentVariables.initialSessionReturnRecordTtlSecs();

      if (eventName === Constants.F2F_YOTI_START) {
        expiresOn = absoluteTimeNow() + this.environmentVariables.sessionReturnRecordTtlSecs();
      }

      const returnRecord = new SessionReturnRecord(eventDetails, expiresOn);

      switch (eventName) {
        case Constants.AUTH_IPV_AUTHORISATION_REQUESTED: {
          if (!this.checkIfValidString([userDetails.email, eventDetails.client_id, eventDetails.clientLandingPageUrl])) {
            this.logger.warn({ message: "Missing or invalid value for fields required for AUTH_IPV_AUTHORISATION_REQUESTED event type" }, { messageCode: MessageCodes.MISSING_MANDATORY_FIELDS });
            return `Missing info in sqs ${Constants.AUTH_IPV_AUTHORISATION_REQUESTED} event, it is unlikely that this event was meant for F2F`;
          }

          updateExpression = "SET ipvStartedOn = :ipvStartedOn, userEmail = :userEmail, clientName = :clientName,  redirectUri = :redirectUri, expiresOn = :expiresOn";
          expressionAttributeValues = {
            ":userEmail": returnRecord.userEmail,
            ":ipvStartedOn": returnRecord.ipvStartedOn,
            ":clientName": returnRecord.clientName,
            ":redirectUri": returnRecord.redirectUri,
            ":expiresOn": returnRecord.expiresDate,
          };
          break;
        }
        case Constants.F2F_YOTI_START: {
          updateExpression = "SET journeyWentAsyncOn = :journeyWentAsyncOn, expiresOn = :expiresOn";
          expressionAttributeValues = {
            ":journeyWentAsyncOn": returnRecord.journeyWentAsyncOn,
            ":expiresOn": returnRecord.expiresDate,
          };

          if (returnRecord.postOfficeInfo) {
            updateExpression += ", postOfficeInfo = :postOfficeInfo";
            expressionAttributeValues[":postOfficeInfo"] = returnRecord.postOfficeInfo;
          } else {
            this.logger.info(`No post_office_details in ${eventName} event`);
          }

          if (returnRecord.documentType) {
            updateExpression += ", documentType = :documentType";
            expressionAttributeValues[":documentType"] = returnRecord.documentType;
          } else {
            this.logger.info(`No document_details in ${eventName} event`);
          }

          if (returnRecord.clientSessionId) {
            updateExpression += ", clientSessionId = :clientSessionId";
            expressionAttributeValues[":clientSessionId"] = returnRecord.clientSessionId;
          } else {
            this.logger.info(`No govuk_signin_journey_id in ${eventName} event`);
          }
          break;
        }
        case Constants.IPV_F2F_CRI_VC_CONSUMED: {
          if (!eventDetails.restricted || !eventDetails.restricted.nameParts) {
            this.handleError("Missing nameParts fields required for IPV_F2F_CRI_VC_CONSUMED event type", MessageCodes.MISSING_MANDATORY_FIELDS);
          }

          updateExpression = "SET readyToResumeOn = :readyToResumeOn, nameParts = :nameParts";
          expressionAttributeValues = {
            ":readyToResumeOn": returnRecord.readyToResumeOn,
            ":nameParts": returnRecord.nameParts,
          };

          if (returnRecord.documentExpiryDate) {
            updateExpression += ", documentExpiryDate = :documentExpiryDate";
            expressionAttributeValues[":documentExpiryDate"] = returnRecord.documentExpiryDate;
          } else {
            this.logger.info(`No docExpiryDate in ${eventName} event`);
          }
          break;
        }
        case Constants.F2F_DOCUMENT_UPLOADED: {
          if (!eventDetails.extensions || !eventDetails.extensions.post_office_visit_details) {
            this.handleError("Missing post_office_visit_details fields required for F2F_DOCUMENT_UPLOADED event type", MessageCodes.MISSING_MANDATORY_FIELDS);
          }

          updateExpression = "SET documentUploadedOn = :documentUploadedOn, postOfficeVisitDetails = :postOfficeVisitDetails";
          expressionAttributeValues = {
            ":documentUploadedOn": returnRecord.documentUploadedOn,
            ":postOfficeVisitDetails": returnRecord.postOfficeVisitDetails,
          };
          break;
        }
        case Constants.AUTH_DELETE_ACCOUNT: {
          updateExpression = "SET accountDeletedOn = :accountDeletedOn, userEmail = :userEmail, nameParts = :nameParts, clientName = :clientName,  redirectUri = :redirectUri";
          expressionAttributeValues = {
            ":accountDeletedOn": returnRecord.accountDeletedOn,
            ":userEmail": returnRecord.userEmail,
            ":nameParts": returnRecord.nameParts,
            ":clientName": returnRecord.clientName,
            ":redirectUri": returnRecord.redirectUri,
          };
          break;
        }
        default:
          this.handleError(`Unexpected event received in SQS queue: ${eventName}`, MessageCodes.MISSING_MANDATORY_FIELDS);
      }

      if (!updateExpression || !expressionAttributeValues) {
        this.handleError(`Missing config to update DynamoDB for event: ${eventName}`, MessageCodes.MISSING_MANDATORY_FIELDS);
      } else {
				const saveEventData = await this.iprService.saveEventData(userId, updateExpression, expressionAttributeValues);

				return {
					statusCode: HttpCodesEnum.CREATED,
					eventBody: saveEventData ? saveEventData : "OK",
				}
			}
    } catch (error: any) {
      this.handleError("Cannot parse event data", MessageCodes.MISSING_MANDATORY_FIELDS);
    }
  }

  private handleError(errorMessage: string, messageCode: string): void {
    this.logger.error({ message: errorMessage }, { messageCode: messageCode });
    throw new AppError(HttpCodesEnum.BAD_REQUEST, errorMessage);
  }

  private checkIfValidString(params: Array<string | undefined>): boolean {
    return params.every((param) => param && param.trim() !== "");
  }
}
