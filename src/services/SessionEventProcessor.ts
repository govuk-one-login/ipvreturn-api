import { ValidationHelper } from "../utils/ValidationHelper";
import { personalIdentityUtils } from "../utils/PersonalIdentityUtils";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { SessionEvent } from "../models/SessionEvent";
import { HttpCodesEnum } from "../models/enums/HttpCodesEnum";
import { Response } from "../utils/Response";
import { buildGovNotifyEventFields } from "../utils/GovNotifyEvent";
import { EnvironmentVariables } from "./EnvironmentVariables";
import { ServicesEnum } from "../models/enums/ServicesEnum";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
import { IPRService } from "./IPRService";
import { AppError } from "../utils/AppError";
import { MessageCodes } from "../models/enums/MessageCodes";

export class SessionEventProcessor {

	private static instance: SessionEventProcessor;

	private readonly logger: Logger;

	private readonly metrics: Metrics;

	private readonly validationHelper: ValidationHelper;

	private readonly iprService: IPRService;

	private readonly environmentVariables: EnvironmentVariables;

	constructor(logger: Logger, metrics: Metrics) {
		this.logger = logger;
		this.environmentVariables = new EnvironmentVariables(logger, ServicesEnum.STREAM_PROCESSOR_SERVICE);
		this.validationHelper = new ValidationHelper();
		this.metrics = metrics;
		this.iprService = IPRService.getInstance(this.environmentVariables.sessionEventsTable(), this.logger, createDynamoDbClient());
	}

	static getInstance(logger: Logger, metrics: Metrics): SessionEventProcessor {
		if (!SessionEventProcessor.instance) {
			SessionEventProcessor.instance = new SessionEventProcessor(logger, metrics);
		}
		return SessionEventProcessor.instance;
	}

	async processRequest(sessionEvent: any): Promise<void> {
		const sessionEventData: SessionEvent = SessionEvent.parseRequest(JSON.stringify(sessionEvent));

		// Validate the notified field is set to false
		if (sessionEventData.notified) {
			this.logger.warn("User is already notified for this session event.", { messageCode: MessageCodes.USER_ALREADY_NOTIFIED });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, "User is already notified for this session event.");
		}
		// Validate if the record is missing some fields related to the Events and log the details and stop record processing.
		try {
			this.validationHelper.validateSessionEventFields(sessionEventData);
		} catch (error: any) {
			this.logger.warn(error.message, { messageCode: MessageCodes.MISSING_MANDATORY_FIELDS_IN_SESSION_EVENT });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, error.message);
		}

		// Validate all necessary fields are populated before processing the data.
		try {
			await this.validationHelper.validateModel(sessionEventData, this.logger);
		} catch (error) {
			this.logger.error("Unable to process the DB record as the necessary fields are not populated.", { messageCode: MessageCodes.MISSING_MANDATORY_FIELDS_IN_SESSION_EVENT });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, "Unable to process the DB record as the necessary fields are not populated.");
		}

		// Send SQS message to GovNotify queue to send email to the user.
		try {
			const nameParts = personalIdentityUtils.getNames(sessionEventData.nameParts);
			await this.iprService.sendToGovNotify(buildGovNotifyEventFields(sessionEventData.userId, sessionEventData.userEmail, nameParts.givenNames[0], nameParts.familyNames[0]));
		} catch (error) {
			const userId = sessionEventData.userId;
			this.logger.error("FAILED_TO_WRITE_GOV_NOTIFY", {
				reason: "Processing Event session data, failed to post message to GovNotify SQS Queue",
				error,
			}, { messageCode: MessageCodes.FAILED_TO_WRITE_GOV_NOTIFY });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, "An error occurred when sending message to GovNotify handler");
		}
		// Update the DB table with notified flag set to true
		try {
			const updateExpression = "SET notified = :notified";
			const expressionAttributeValues = {
				":notified": true,
			};
			await this.iprService.saveEventData(sessionEventData.userId, updateExpression, expressionAttributeValues);
			this.logger.info({ message: "Updated the session event record with notified flag" });
		} catch (error: any) {
			throw new AppError(HttpCodesEnum.SERVER_ERROR, error.message);
		}
	}
}

