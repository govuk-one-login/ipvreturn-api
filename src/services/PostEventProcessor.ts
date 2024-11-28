import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";

import { AppError } from "../utils/AppError";
import { HttpCodesEnum } from "../models/enums/HttpCodesEnum";
import { Constants } from "../utils/Constants";
import { IPRServiceSession } from "./IPRServiceSession";
import { IPRServiceAuth } from "./IPRServiceAuth";
import { EnvironmentVariables } from "./EnvironmentVariables";
import { ServicesEnum } from "../models/enums/ServicesEnum";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
import {
	ReturnSQSEvent,
} from "../models/ReturnSQSEvent";
import { SessionReturnRecord } from "../models/SessionReturnRecord";
import { absoluteTimeNow } from "../utils/DateTimeUtils";
import { MessageCodes } from "../models/enums/MessageCodes";


export class PostEventProcessor {
	private static instance: PostEventProcessor;

	private readonly logger: Logger;

	private readonly metrics: Metrics;

	private readonly environmentVariables: EnvironmentVariables;

	private readonly iprServiceSession: IPRServiceSession;

	private readonly iprServiceAuth: IPRServiceAuth;

	constructor(logger: Logger, metrics: Metrics) {
		this.logger = logger;
		this.metrics = metrics;
		this.environmentVariables = new EnvironmentVariables(logger, ServicesEnum.POST_EVENT_SERVICE);
		this.iprServiceSession = IPRServiceSession.getInstance(this.environmentVariables.sessionEventsTable(), this.logger, createDynamoDbClient());
		this.iprServiceAuth = IPRServiceAuth.getInstance(this.environmentVariables.authEventsTable(), this.logger, createDynamoDbClient());
	}

	static getInstance(logger: Logger, metrics: Metrics): PostEventProcessor {
		if (!PostEventProcessor.instance) {
			PostEventProcessor.instance = new PostEventProcessor(logger, metrics);
		}
		return PostEventProcessor.instance;
	}

	// eslint-disable-next-line max-lines-per-function, complexity
	async processRequest(eventBody: any): Promise<any> {
		try {
			const eventDetails: ReturnSQSEvent = JSON.parse(eventBody);
			const eventName = eventDetails.event_name;

			const obfuscatedObject = await this.iprServiceSession.obfuscateJSONValues(eventDetails, Constants.TXMA_FIELDS_TO_SHOW);
			this.logger.info({ message: "Obfuscated TxMA Event", txmaEvent: obfuscatedObject });

			if (!eventDetails.event_id) {
				this.logger.error({ message: "Missing event_id in the incoming SQS event" }, { messageCode: MessageCodes.MISSING_MANDATORY_FIELDS });
				throw new AppError(HttpCodesEnum.SERVER_ERROR, "Missing info in sqs event");
			}
			this.logger.appendKeys({ event_id: eventDetails.event_id });

			this.logger.info({ message: "Received SQS event with eventName ", eventName });
			if (!this.checkIfValidString([eventName]) || !eventDetails.timestamp) {

				this.logger.error({ message: "Missing or invalid value for any or all of event name, timestamp in the incoming SQS event" }, { messageCode: MessageCodes.MISSING_MANDATORY_FIELDS });
				throw new AppError(HttpCodesEnum.SERVER_ERROR, "Missing info in sqs event");
			}

			if (!eventDetails.user) {
				this.logger.error({ message: "Missing user details in the incoming SQS event" }, { messageCode: MessageCodes.MISSING_MANDATORY_FIELDS } );
				throw new AppError(HttpCodesEnum.SERVER_ERROR, "Missing info in sqs event");
			}
			const userDetails = eventDetails.user;
			this.logger.appendKeys({ govuk_signin_journey_id: userDetails.govuk_signin_journey_id });

			if (!this.checkIfValidString([userDetails.user_id])) {
				this.logger.error({ message: "Missing or invalid value for userDetails.user_id in event payload" }, { messageCode: MessageCodes.MISSING_MANDATORY_FIELDS });
				throw new AppError(HttpCodesEnum.SERVER_ERROR, "Missing info in sqs event");
			}
			const userId = userDetails.user_id;
			//Do not process the event if the event is already processed or flagged for deletion
			const isFlaggedForDeletionOrEventAlreadyProcessed = await this.iprServiceSession.isFlaggedForDeletionOrEventAlreadyProcessed(userId, eventName);
			if (isFlaggedForDeletionOrEventAlreadyProcessed) {
				this.logger.info( { message: "Record flagged for deletion or event already processed, skipping update" });
				return "Record flagged for deletion or event already processed, skipping update";
			}
			let updateExpression, expressionAttributeValues: { [key: string]: any }, expiresOn;

			//Set auth event TTL to 6hrs
			expiresOn = absoluteTimeNow() + this.environmentVariables.authEventTtlSecs();

			if (eventName === Constants.F2F_YOTI_START) {
				//Reset TTL to 11days for F2F journey
				expiresOn = absoluteTimeNow() + this.environmentVariables.sessionReturnRecordTtlSecs();
			}

			const returnRecord = new SessionReturnRecord(eventDetails, expiresOn );
			switch (eventName) {
				case Constants.AUTH_IPV_AUTHORISATION_REQUESTED: {
					if (!this.checkIfValidString([userDetails.email, eventDetails.client_id, eventDetails.clientLandingPageUrl])) {
						this.logger.warn({ message: "Missing or invalid value for any or all of userDetails.email, eventDetails.client_id, eventDetails.clientLandingPageUrl fields required for AUTH_IPV_AUTHORISATION_REQUESTED event type" }, { messageCode: MessageCodes.MISSING_MANDATORY_FIELDS });
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
					const fetchedRecord = await this.iprServiceAuth.getAuthEventBySub(userId);
					if (!fetchedRecord) {
						this.logger.error({ message: "F2F_YOTI_START event received before AUTH_IPV_AUTHORISATION_REQUESTED event" }, { messageCode: MessageCodes.SQS_OUT_OF_SYNC });
						throw new AppError(HttpCodesEnum.SERVER_ERROR, "F2F_YOTI_START event received before AUTH_IPV_AUTHORISATION_REQUESTED event");
					}
					updateExpression = "SET journeyWentAsyncOn = :journeyWentAsyncOn, expiresOn = :expiresOn, ipvStartedOn = :ipvStartedOn, userEmail = :userEmail, clientName = :clientName, redirectUri = :redirectUri";
					expressionAttributeValues = {
						":userEmail": fetchedRecord.userEmail,
						":ipvStartedOn": fetchedRecord.ipvStartedOn,
						":clientName": fetchedRecord.clientName,
						":redirectUri": fetchedRecord.redirectUri,
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
						this.logger.error( { message: "Missing nameParts fields required for IPV_F2F_CRI_VC_CONSUMED event type" }, { messageCode: MessageCodes.MISSING_MANDATORY_FIELDS });
						throw new AppError(HttpCodesEnum.SERVER_ERROR, `Missing info in sqs ${Constants.AUTH_IPV_AUTHORISATION_REQUESTED} event`);
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
						this.logger.error( { message: "Missing post_office_visit_details fields required for F2F_DOCUMENT_UPLOADED event type" }, { messageCode: MessageCodes.MISSING_MANDATORY_FIELDS });
						throw new AppError(HttpCodesEnum.SERVER_ERROR, `Missing info in sqs ${Constants.F2F_DOCUMENT_UPLOADED} event`);
					}
					updateExpression = "SET documentUploadedOn = :documentUploadedOn, postOfficeVisitDetails = :postOfficeVisitDetails";
					expressionAttributeValues = {
						":documentUploadedOn": returnRecord.documentUploadedOn,
						":postOfficeVisitDetails": returnRecord.postOfficeVisitDetails,
					};
					break;
				}
				case Constants.AUTH_DELETE_ACCOUNT:
				case Constants.IPV_F2F_USER_CANCEL_END: {
					updateExpression = "SET accountDeletedOn = :accountDeletedOn, userEmail = :userEmail, nameParts = :nameParts, clientName = :clientName,  redirectUri = :redirectUri";
					expressionAttributeValues = {
						":accountDeletedOn": returnRecord.accountDeletedOn,
						":userEmail": returnRecord.userEmail,
						":nameParts":returnRecord.nameParts,
						":clientName": returnRecord.clientName,
						":redirectUri": returnRecord.redirectUri,
					};
					break;
				}
				default:
					this.logger.error({ message: "Unexpected event received in SQS queue:", eventName });
					throw new AppError(HttpCodesEnum.SERVER_ERROR, "Unexpected event received");
			}

			if (!updateExpression || !expressionAttributeValues) {
				this.logger.error({ message: "Missing config to update DynamoDB for event:", eventName });
				throw new AppError(HttpCodesEnum.SERVER_ERROR, "Missing event config");
			}

			if (eventName === Constants.AUTH_IPV_AUTHORISATION_REQUESTED) {
				const saveEventData = await this.iprServiceAuth.saveEventData(userId, updateExpression, expressionAttributeValues);
				return {
					statusCode: HttpCodesEnum.CREATED,
					eventBody: saveEventData ? saveEventData : "OK",
				};
			} else {
				const saveEventData = await this.iprServiceSession.saveEventData(userId, updateExpression, expressionAttributeValues);
				return {
					statusCode: HttpCodesEnum.CREATED,
					eventBody: saveEventData ? saveEventData : "OK",
				};
			}

		} catch (error: any) {
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
