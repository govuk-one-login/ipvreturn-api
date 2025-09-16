import { ValidationHelper } from "../utils/ValidationHelper";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics, MetricUnits } from "@aws-lambda-powertools/metrics";
import { ExtSessionEvent, SessionEvent } from "../models/SessionEvent";
import { HttpCodesEnum } from "../models/enums/HttpCodesEnum";
import { buildGovNotifyEventFields } from "../utils/GovNotifyEvent";
import { EnvironmentVariables } from "./EnvironmentVariables";
import { ServicesEnum } from "../models/enums/ServicesEnum";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
import { IPRServiceSession } from "./IPRServiceSession";
import { AppError } from "../utils/AppError";
import { MessageCodes } from "../models/enums/MessageCodes";
import { Constants } from "../utils/Constants";

export class SessionEventProcessor {

	private static instance: SessionEventProcessor;

	private readonly logger: Logger;

	private readonly metrics: Metrics;

	private readonly validationHelper: ValidationHelper;

	private readonly iprService: IPRServiceSession;

	private readonly environmentVariables: EnvironmentVariables;

	constructor(logger: Logger, metrics: Metrics) {
		this.logger = logger;
		this.environmentVariables = new EnvironmentVariables(logger, ServicesEnum.STREAM_PROCESSOR_SERVICE);
		this.validationHelper = new ValidationHelper();
		this.metrics = metrics;
		this.iprService = IPRServiceSession.getInstance(this.environmentVariables.sessionEventsTable(), this.logger, createDynamoDbClient());
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

		const isVCFailure = this.validationHelper.isVCGenerationFailure(sessionEvent.errorDescription ); 
		if (isVCFailure && sessionEvent.readyToResumeOn) {
			// Send VC generation failure email
			await this.sendEmailMessageToGovNotify(sessionEventData, Constants.VC_GENERATION_FAILURE_EMAIL);	
		} else {	
			// send visit email
			let emailType = Constants.VIST_PO_EMAIL_DYNAMIC;

			// Validate if documentUploadedOn exists
			if (!sessionEventData.documentUploadedOn || !(sessionEventData.documentUploadedOn > 0)) {
				this.logger.info({ message: "documentUploadedOn is not yet populated, sending the static template email." });
				// Send the static template email
				emailType = Constants.VIST_PO_EMAIL_STATIC;
				sessionEventData = new SessionEvent(sessionEventData);	
			} 	
			let data;
			try {
				// Validate for fields and confirm the emailType
				data = await this.validationHelper.validateSessionEvent(sessionEventData, emailType, this.logger);
				// ignored so as not log PII
				/* eslint-disable @typescript-eslint/no-unused-vars */	
			} catch (error)	{
				sessionEventData = new SessionEvent(sessionEventData);
				data = { sessionEvent: sessionEventData, emailType: Constants.VISIT_PO_EMAIL_FALLBACK };
			}
			
			// Send the email notification message
			await this.sendEmailMessageToGovNotify(data.sessionEvent, data.emailType);	
		}	

		// Update the DB table with notified flag set to true
		try {
			const updateExpression = "SET notified = :notified";
			const expressionAttributeValues = {
				":notified": true,
			};
			await this.iprService.saveEventData(sessionEventData.userId, updateExpression, expressionAttributeValues);
			this.logger.info({ message: "Updated the session event record with notified flag" });
			this.metrics.addMetric("SessionEventProcessor_successfully_processed_events", MetricUnits.Count, 1);
		} catch (error: any) {
			throw new AppError(HttpCodesEnum.SERVER_ERROR, error.message);
		}
	}

	async sendEmailMessageToGovNotify(sessionEvent: ExtSessionEvent | SessionEvent, emailType: string): Promise<void> {		
		
		// Send SQS message to GovNotify queue to send email to the user.
		try {
			this.logger.info({ message: `Trying to send  ${emailType} type message to GovNotify handler` });

			await this.iprService.sendToGovNotify(buildGovNotifyEventFields(sessionEvent, emailType, this.logger));
			this.metrics.addMetric(
				emailType === Constants.VC_GENERATION_FAILURE_EMAIL ? "VC_generation_failure_email_added_to_queue" : "visit_email_added_to_queue",
				MetricUnits.Count,
				1
			);	
		} catch (error) {
			this.logger.error("FAILED_TO_WRITE_GOV_NOTIFY", {
				reason: `Processing Event session data, failed to post ${emailType} type message to GovNotify SQS Queue`,
				error,
			}, { messageCode: MessageCodes.FAILED_TO_WRITE_GOV_NOTIFY });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, `An error occurred when sending ${emailType} type message to GovNotify handler`);
		}
	}
}

