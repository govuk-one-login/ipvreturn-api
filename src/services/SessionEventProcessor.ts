import { ValidationHelper } from "../utils/ValidationHelper";
import { personalIdentityUtils } from "../utils/PersonalIdentityUtils";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { ExtSessionEvent, SessionEvent } from "../models/SessionEvent";
import { HttpCodesEnum } from "../models/enums/HttpCodesEnum";
import { buildGovNotifyEventFields } from "../utils/GovNotifyEvent";
import { EnvironmentVariables } from "./EnvironmentVariables";
import { ServicesEnum } from "../models/enums/ServicesEnum";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
import { IPRService } from "./IPRService";
import { AppError } from "../utils/AppError";
import { MessageCodes } from "../models/enums/MessageCodes";
import { Constants } from "../utils/Constants";

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
		let sessionEventData: any = ExtSessionEvent.parseRequest(JSON.stringify(sessionEvent));

		this.logger.appendKeys({ govuk_signin_journey_id: sessionEventData.clientSessionId });

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

		let emailType = Constants.NEW_EMAIL;

		// Validate if documentUploadedOn exists
		if (!sessionEventData.documentUploadedOn || !(sessionEventData.documentUploadedOn > 0)) {
			this.logger.info({ message: "documentUploadedOn is not yet populated, sending the old template email." });
			// Send the old template email
			emailType = Constants.OLD_EMAIL;
			sessionEventData = new SessionEvent(sessionEventData);	
		} 	
		
		// Validate for fields and confirm the emailType
		const data = await this.validateSessionEvent(sessionEventData, emailType);		
		
		// Send the new template email
		await this.sendEmailMessageToGovNotify(data.sessionEvent, data.emailType);	

		// Update the DB table with notified flag set to true
		try {
			const updateExpression = "SET notified = :notified";
			const expressionAttributeValues = {
				":notified": true,
			};
			await this.iprService.saveEventData(data.sessionEvent.userId, updateExpression, expressionAttributeValues);
			this.logger.info({ message: "Updated the session event record with notified flag" });
		} catch (error: any) {
			throw new AppError(HttpCodesEnum.SERVER_ERROR, error.message);
		}
	}

	async validateSessionEvent(sessionEvent: ExtSessionEvent | SessionEvent, emailType: string): Promise<{ sessionEvent: ExtSessionEvent | SessionEvent; emailType: string }> {
		//Validate all necessary fields are populated required to send the email before processing the data.
		try {
			await this.validationHelper.validateModel(sessionEvent, this.logger);				
		} catch (error) {
			if (emailType === Constants.NEW_EMAIL) {
				this.logger.info("Unable to process the DB record as the necessary fields to send the new template email are not populated, trying to send the old template email.", { messageCode: MessageCodes.MISSING_NEW_PO_FIELDS_IN_SESSION_EVENT });
				// Send the old template email
				sessionEvent = new SessionEvent(sessionEvent);		
				emailType = Constants.OLD_EMAIL;
				// Validate feilds required for sending the old email
				await this.validateSessionEvent(sessionEvent, emailType);
			} else {
				this.logger.error("Unable to process the DB record as the necessary fields are not populated to send the old template email.", { messageCode: MessageCodes.MISSING_MANDATORY_FIELDS_IN_SESSION_EVENT });
				throw new AppError(HttpCodesEnum.SERVER_ERROR, "Unable to process the DB record as the necessary fields are not populated to send the old template email.");			

			}			
		}
		return { sessionEvent, emailType };
	}

	async sendEmailMessageToGovNotify(sessionEvent: ExtSessionEvent | SessionEvent, emailType: string): Promise<void> {		
		
		// Send SQS message to GovNotify queue to send email to the user.
		try {
			this.logger.info({ message: `Trying to send  ${emailType} type message to GovNotify handler` });
			const nameParts = personalIdentityUtils.getNames(sessionEvent.nameParts);
			await this.iprService.sendToGovNotify(buildGovNotifyEventFields(nameParts, sessionEvent, emailType, this.logger));
		} catch (error) {
			this.logger.error("FAILED_TO_WRITE_GOV_NOTIFY", {
				reason: `Processing Event session data, failed to post ${emailType} type message to GovNotify SQS Queue`,
				error,
			}, { messageCode: MessageCodes.FAILED_TO_WRITE_GOV_NOTIFY });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, `An error occurred when sending ${emailType} type message to GovNotify handler`);
		}
	}
}

