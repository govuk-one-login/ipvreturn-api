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
			if (!eventDetails.user && !eventName) {
				this.logger.error({ message: "Missing user details or event name in event", eventDetails });
				throw new AppError(HttpCodesEnum.SERVER_ERROR, "Missing info in sqs event");
			}
			const userDetails = eventDetails.user;

			if (!userDetails.user_id || !eventDetails.timestamp) {
				this.logger.error({ message: "Missing required fields user_id and timestamp in event payload", eventDetails, userDetails });
				throw new AppError(HttpCodesEnum.SERVER_ERROR, "Missing info in sqs event");
			}

			const userId = userDetails.user_id;
			// Do not process the event if the event is already processed or flagged for deletion
			const isFlaggedForDeletionOrEventAlreadyProcessed = await this.iprService.isFlaggedForDeletionOrEventAlreadyProcessed(userId, eventName);
			if (isFlaggedForDeletionOrEventAlreadyProcessed) {
				this.logger.info({ message: "Record flagged for deletion or event already processed, skipping update", userId });
				return "Record flagged for deletion or event already processed, skipping update";
			}

			let updateExpression, expressionAttributeValues;
			const expiresOn = absoluteTimeNow() + Number(this.environmentVariables.sessionReturnRecordTtl());
			const returnRecord = new SessionReturnRecord(eventDetails, expiresOn );
			switch (eventName) {
				case Constants.AUTH_IPV_AUTHORISATION_REQUESTED: {
					if (!userDetails.email || !eventDetails.client_id || !eventDetails.component_id || eventDetails.component_id === "UNKNOWN") { 
						this.logger.error({ message: `Missing fields required for ${Constants.AUTH_IPV_AUTHORISATION_REQUESTED} event type, or component_id is UNKNOWN`, eventDetails, userDetails });
						throw new AppError(HttpCodesEnum.SERVER_ERROR, `Missing info in sqs ${Constants.AUTH_IPV_AUTHORISATION_REQUESTED} event`);
					}
					updateExpression = "SET ipvStartedOn = :ipvStartedOn, userEmail = :userEmail, nameParts = :nameParts, clientName = :clientName,  redirectUri = :redirectUri, expiresOn = :expiresOn";
					expressionAttributeValues = {
						":userEmail": returnRecord.userEmail,
						":ipvStartedOn": returnRecord.ipvStartedOn,
						":nameParts": [],
						":clientName": returnRecord.clientName,
						":redirectUri": returnRecord.redirectUri,
						":expiresOn": returnRecord.expiresDate,
					};
					break;
				}
				case Constants.F2F_YOTI_START: {
					updateExpression = "SET journeyWentAsyncOn = :journeyWentAsyncOn";
					expressionAttributeValues = {
						":journeyWentAsyncOn": returnRecord.journeyWentAsyncOn,
					};
					break;
				}
				case Constants.IPV_F2F_CRI_VC_CONSUMED: {
					updateExpression = "SET readyToResumeOn = :readyToResumeOn";
					expressionAttributeValues = {
						":readyToResumeOn": returnRecord.readyToResumeOn,
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
			
			const saveEventData = await this.iprService.saveEventData(userId, updateExpression, expressionAttributeValues);

			return {
				statusCode: HttpCodesEnum.CREATED,
				eventBody: saveEventData ? saveEventData : "OK",
			};

		} catch (error: any) {
			this.logger.error({ message: "Cannot parse event data", eventBody });
			throw new AppError( HttpCodesEnum.BAD_REQUEST, "Cannot parse event data");
		}
	}
}
