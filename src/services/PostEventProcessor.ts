import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";

import { AppError } from "../utils/AppError";
import { HttpCodesEnum } from "../models/enums/HttpCodesEnum";
import { Constants } from "../utils/Constants";
import { IPRService } from "./IPRService";
import { EnvironmentVariables } from "./EnvironmentVariables";
import { ServicesEnum } from "../models/enums/ServicesEnum";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
import { IpvStartedOnEvent, JourneyWentAsyncOnEvent, ReadyToResumeOnEvent, AccountDeletedOnEvent } from "../models/IPREventTypes";


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
			const eventDetails = JSON.parse(eventBody);
			const eventName = eventDetails.event_name;
			const userDetails = eventDetails.user;

			let eventData, updateExpression, expressionAttributeValues;

			switch (eventName) {
				case Constants.AUTH_IPV_AUTHORISATION_REQUESTED: {
					eventData = {
						userId: userDetails.user_id,
						ipvStartedOn: eventDetails.timestamp,
						userEmail: userDetails.email,
						nameParts: [],
						clientName: eventDetails.client_id,
						redirectUri: eventDetails.component_id
					};
					updateExpression = "SET ipvStartedOn = :ipvStartedOn, userEmail = :userEmail, nameParts = :nameParts, clientName = :clientName,  redirectUri = :redirectUri";
					expressionAttributeValues = {
						":ipvStartedOn": eventData.ipvStartedOn,
						":userEmail": eventData.userEmail,
						":nameParts": eventData.nameParts,
						":clientName": eventData.clientName,
						":redirectUri": eventData.redirectUri,
					};
					break;
				}
				case Constants.F2F_YOTI_START: {
					eventData = {
						userId: userDetails.sub,
						journeyWentAsyncOn: eventDetails.timestamp,
					};

					updateExpression = "SET journeyWentAsyncOn = :journeyWentAsyncOn";
					expressionAttributeValues = {
						":journeyWentAsyncOn": eventData.journeyWentAsyncOn,
					};
					break;
				}
				case Constants.IPV_F2F_CRI_VC_CONSUMED: {
					eventData = {
						userId: userDetails.user_id,
						readyToResumeOn: eventDetails.timestamp,
					};

					updateExpression = "SET readyToResumeOn = :readyToResumeOn";
					expressionAttributeValues = {
						":readyToResumeOn": eventData.readyToResumeOn,
					};
					break;
				}
				case Constants.AUTH_DELETE_ACCOUNT: {
					eventData = {
						userId: userDetails.user_id,
						accountDeletedOn: eventDetails.timestamp,
						userEmail: "",
						nameParts: [],
						clientName: "",
						redirectUri: "",
					};

					updateExpression = "SET accountDeletedOn = :accountDeletedOn, userEmail = :userEmail, nameParts = :nameParts, clientName = :clientName,  redirectUri = :redirectUri";
					expressionAttributeValues = {
						":accountDeletedOn": eventData.accountDeletedOn,
						":userEmail": eventData.userEmail,
						":nameParts": eventData.nameParts,
						":clientName": eventData.clientName,
						":redirectUri": eventData.redirectUri,
					};
					break;
				}
				default:
					this.logger.error({ message: "Unexpected event received in SQS queue:", eventName });
					throw new AppError(HttpCodesEnum.SERVER_ERROR, "Unexpected event received");
			}

			if (!eventData || !updateExpression || !expressionAttributeValues) {
				this.logger.error({ message: "Missing config to update DynamboDB for event:", eventName });
				throw new AppError(HttpCodesEnum.SERVER_ERROR, "Missing event config");
			}
			
			const saveEventData = await this.iprService.saveEventData(eventData.userId, updateExpression, expressionAttributeValues);

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
