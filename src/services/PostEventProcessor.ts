import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";

import { AppError } from "../utils/AppError";
import { HttpCodesEnum } from "../models/enums/HttpCodesEnum";
import { Constants, TXMA_EVENT_DETAILS } from "../utils/Constants";
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

	async processRequest(eventBody: string): Promise<any> {
		try {
			const eventDetails: ReturnSQSEvent = JSON.parse(eventBody);
			const { event_id, event_name, user } = eventDetails;

			const requiredFields = ["event_id", "event_name", "user"];

			const missingFields = requiredFields.filter(field => !(field in eventDetails));

			if (missingFields.length > 0) {
				const errorMessage = "Missing fields in the incoming SQS event";
				this.logger.error({ message: errorMessage }, { missingFields: missingFields.join(", ") }, { messageCode: MessageCodes.MISSING_MANDATORY_FIELDS });
				throw new AppError(HttpCodesEnum.SERVER_ERROR, errorMessage);
			}
	
			this.logger.info({ message: `Received SQS event with eventName ${event_name}` });

			const { user_id, govuk_signin_journey_id } = user;
			if (!user_id) {
				const errorMessage = "Missing or invalid value for userDetails.user_id in event payload";
				this.logger.error({ message: errorMessage }, { messageCode: MessageCodes.MISSING_MANDATORY_FIELDS });
				throw new AppError(HttpCodesEnum.SERVER_ERROR, errorMessage);
			}
	
			this.logger.appendKeys({ event_id, govuk_signin_journey_id });
			const isFlaggedForDeletionOrEventAlreadyProcessed = await this.iprService.isFlaggedForDeletionOrEventAlreadyProcessed(user_id, event_name);
	
			if (isFlaggedForDeletionOrEventAlreadyProcessed) {
				this.logger.info({ message: "Record flagged for deletion or event already processed, skipping update" });
				return "Record flagged for deletion or event already processed, skipping update";
			}
	
			let updateExpression, expressionAttributeValues: { [key: string]: any };
	
			const expiresOn = absoluteTimeNow() + (event_name === Constants.F2F_YOTI_START ? this.environmentVariables.sessionReturnRecordTtlSecs() : this.environmentVariables.initialSessionReturnRecordTtlSecs());
	
			const returnRecord = new SessionReturnRecord(eventDetails, expiresOn);

			const { AUTH_REQUESTED, YOTI_START, VC_CONSUMED, DOCUMENT_UPLOADED, DELETE_ACCOUNT } = TXMA_EVENT_DETAILS;
	
			switch (event_name) {
				case AUTH_REQUESTED.Name :
					if (!this.checkIfValidString([user.email, eventDetails.client_id, eventDetails.clientLandingPageUrl])) {
						const errorMessage = "Missing or invalid value for any or all of userDetails.email, eventDetails.client_id, eventDetails.clientLandingPageUrl fields required for AUTH_IPV_AUTHORISATION_REQUESTED event type";
						this.logger.warn({ message: errorMessage }, { messageCode: MessageCodes.MISSING_MANDATORY_FIELDS });
						return `Missing info in ${Constants.AUTH_IPV_AUTHORISATION_REQUESTED} event, unlikely this event was meant for F2F`;
					}
					updateExpression = AUTH_REQUESTED.UpdateExpression;
					expressionAttributeValues = {
						":userEmail": returnRecord.userEmail,
						":ipvStartedOn": returnRecord.ipvStartedOn,
						":clientName": returnRecord.clientName,
						":redirectUri": returnRecord.redirectUri,
						":expiresOn": returnRecord.expiresDate,
					};
					break;
	
				case YOTI_START.Name:
					updateExpression = YOTI_START.UpdateExpression;
					expressionAttributeValues = {
						":journeyWentAsyncOn": returnRecord.journeyWentAsyncOn,
						":expiresOn": returnRecord.expiresDate,
					};
	
					if (returnRecord.postOfficeInfo) {
						updateExpression += ", postOfficeInfo = :postOfficeInfo";
						expressionAttributeValues[":postOfficeInfo"] = returnRecord.postOfficeInfo;
					} else {
						this.logger.info(`No post_office_details in ${event_name} event`);
					}
	
					if (returnRecord.documentType) {
						updateExpression += ", documentType = :documentType";
						expressionAttributeValues[":documentType"] = returnRecord.documentType;
					} else {
						this.logger.info(`No document_details in ${event_name} event`);
					}
	
					if (returnRecord.clientSessionId) {
						updateExpression += ", clientSessionId = :clientSessionId";
						expressionAttributeValues[":clientSessionId"] = returnRecord.clientSessionId;
					} else {
						this.logger.info(`No govuk_signin_journey_id in ${event_name} event`);
					}
					break;
	
				case VC_CONSUMED.Name:
					if (!eventDetails.restricted || !eventDetails.restricted.nameParts) {
						const errorMessage = "Missing nameParts fields required for IPV_F2F_CRI_VC_CONSUMED event type";
						this.logger.error({ message: errorMessage }, { messageCode: MessageCodes.MISSING_MANDATORY_FIELDS });
						throw new AppError(HttpCodesEnum.SERVER_ERROR, `Missing info in sqs ${Constants.AUTH_IPV_AUTHORISATION_REQUESTED} event`);
					}
					updateExpression = VC_CONSUMED.UpdateExpression;
					expressionAttributeValues = {
						":readyToResumeOn": returnRecord.readyToResumeOn,
						":nameParts": returnRecord.nameParts,
					};
	
					if (returnRecord.documentExpiryDate) {
						updateExpression += ", documentExpiryDate = :documentExpiryDate";
						expressionAttributeValues[":documentExpiryDate"] = returnRecord.documentExpiryDate;
					} else {
						this.logger.info(`No docExpiryDate in ${event_name} event`);
					}
					break;
	
				case DOCUMENT_UPLOADED.Name:
					if (!eventDetails.extensions || !eventDetails.extensions.post_office_visit_details) {
						const errorMessage = "Missing post_office_visit_details fields required for F2F_DOCUMENT_UPLOADED event type";
						this.logger.error({ message: errorMessage }, { messageCode: MessageCodes.MISSING_MANDATORY_FIELDS });
						throw new AppError(HttpCodesEnum.SERVER_ERROR, `Missing info in sqs ${Constants.F2F_DOCUMENT_UPLOADED} event`);
					}
					updateExpression = DOCUMENT_UPLOADED.UpdateExpression;
					expressionAttributeValues = {
						":documentUploadedOn": returnRecord.documentUploadedOn,
						":postOfficeVisitDetails": returnRecord.postOfficeVisitDetails,
					};
					break;
	
				case DELETE_ACCOUNT.Name:
					updateExpression = DELETE_ACCOUNT.UpdateExpression;
					expressionAttributeValues = {
						":accountDeletedOn": returnRecord.accountDeletedOn,
						":userEmail": returnRecord.userEmail,
						":nameParts": returnRecord.nameParts,
						":clientName": returnRecord.clientName,
						":redirectUri": returnRecord.redirectUri,
					};
					break;
	
				default:
					this.logger.error({ message: "Unexpected event received in SQS queue:", event_name });
					throw new AppError(HttpCodesEnum.SERVER_ERROR, "Unexpected event received");
			}
	
			if (!updateExpression || !expressionAttributeValues) {
				this.logger.error({ message: "Missing config to update DynamoDB for event:", event_name });
				throw new AppError(HttpCodesEnum.SERVER_ERROR, "Missing event config");
			}
	
			await this.iprService.saveEventData(user_id, updateExpression, expressionAttributeValues);
	
			return {
				statusCode: HttpCodesEnum.CREATED,
				eventBody: "OK",
			};
	
		} catch (error) {
			this.logger.error({ message: "Cannot parse event data", error });
			throw new AppError(HttpCodesEnum.BAD_REQUEST, "Cannot parse event data");
		}	
	}

	/**
	 * Checks if all string values in the array are defined and does not
	 * contain spaces only
	 *
	 * @param params
	 */
	checkIfValidString(params: Array<string | undefined>): boolean {
		if (params.some((param) => (!param || !param.trim()) )) {
			return false;
		}
		return true;
	}
}
