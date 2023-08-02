import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";

import { AppError } from "../utils/AppError";
import { HttpCodesEnum } from "../models/enums/HttpCodesEnum";
import { Constants } from "../utils/Constants";
import { IPRService } from "./IPRService";
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

			if (!this.checkIfValidString([userDetails.user_id])) {
				this.logger.error({ message: "Missing or invalid value for userDetails.user_id in event payload" }, { messageCode: MessageCodes.MISSING_MANDATORY_FIELDS });
				throw new AppError(HttpCodesEnum.SERVER_ERROR, "Missing info in sqs event");
			}

			const userId = userDetails.user_id;
			// Do not process the event if the event is already processed or flagged for deletion
			const isFlaggedForDeletionOrEventAlreadyProcessed = await this.iprService.isFlaggedForDeletionOrEventAlreadyProcessed(userId, eventName);
			if (isFlaggedForDeletionOrEventAlreadyProcessed) {
				this.logger.info( { message: "Record flagged for deletion or event already processed, skipping update" });
				return "Record flagged for deletion or event already processed, skipping update";
			}

			let updateExpression, expressionAttributeValues: { [key: string]: any }, expiresOn;

			//Set default TTL to 12hrs to expire any records not meant for F2F
			expiresOn = absoluteTimeNow() + this.environmentVariables.initialSessionReturnRecordTtlSecs();

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
					updateExpression = "SET journeyWentAsyncOn = :journeyWentAsyncOn, expiresOn = :expiresOn";
					expressionAttributeValues = {
						":journeyWentAsyncOn": returnRecord.journeyWentAsyncOn,
						":expiresOn": returnRecord.expiresDate,
					};
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
					break;
				}
				case Constants.AUTH_DELETE_ACCOUNT: {
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
				this.logger.error({ message: "Missing config to update DynamboDB for event:", eventName });
				throw new AppError(HttpCodesEnum.SERVER_ERROR, "Missing event config");
			}

			if (returnRecord.clientSessionId) {
				updateExpression += ", clientSessionId = :clientSessionId";
				expressionAttributeValues[":clientSessionId"] = returnRecord.clientSessionId;
			} else {
				this.logger.info(`No govuk_signin_journey_id in ${eventName} event`);
			}

			const saveEventData = await this.iprService.saveEventData(userId, updateExpression, expressionAttributeValues);

			return {
				statusCode: HttpCodesEnum.CREATED,
				eventBody: saveEventData ? saveEventData : "OK",
			};

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
