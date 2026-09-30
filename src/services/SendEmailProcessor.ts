import { Email, DynamicEmail, FallbackEmail, VCGenerationFailureEmail } from "../models/Email";
import { EmailResponse } from "../models/EmailResponse";
import { ValidationHelper } from "../utils/ValidationHelper";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
import { buildCoreEventFields } from "../utils/TxmaEvent";
import { logger } from "@govuk-one-login/cri-logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { SendEmailService } from "./SendEmailService";
import { IPRServiceSession } from "./IPRServiceSession";
import { MessageCodes } from "../models/enums/MessageCodes";
import { AppError } from "../utils/AppError";
import { HttpCodesEnum } from "../models/enums/HttpCodesEnum";
import { ExtSessionEvent, SessionEvent } from "../models/SessionEvent";
import { Constants } from "../utils/Constants";
import { EnvironmentVariables } from "./EnvironmentVariables";
import { ServicesEnum } from "../models/enums/ServicesEnum";

export class SendEmailProcessor {

	private static instance: SendEmailProcessor;

	private readonly metrics: Metrics;

	private readonly sessionEventsTable: string;

	private readonly validationHelper: ValidationHelper;

	private readonly govNotifyService: SendEmailService;

	private readonly iprService: IPRServiceSession;

	private readonly issuer: string;

	constructor(metrics: Metrics, GOVUKNOTIFY_API_KEY: string, govnotifyServiceId: string, sessionEventsTable: string) {
		this.validationHelper = new ValidationHelper();
		this.metrics = metrics;
		this.govNotifyService = SendEmailService.getInstance(this.metrics, GOVUKNOTIFY_API_KEY, govnotifyServiceId);
		this.sessionEventsTable = sessionEventsTable;
		this.iprService = IPRServiceSession.getInstance(this.sessionEventsTable, createDynamoDbClient());

		const environmentVariables = new EnvironmentVariables(ServicesEnum.GOV_NOTIFY_SERVICE);
		this.issuer = environmentVariables.issuer();
	}

	static getInstance(metrics: Metrics, GOVUKNOTIFY_API_KEY: string, govnotifyServiceId: string, sessionEventsTable: string): SendEmailProcessor {
		if (!SendEmailProcessor.instance) {
			SendEmailProcessor.instance = new SendEmailProcessor(metrics, GOVUKNOTIFY_API_KEY, govnotifyServiceId, sessionEventsTable);
		}
		return SendEmailProcessor.instance;
	}

	async processRequest(message: Email | DynamicEmail | FallbackEmail | VCGenerationFailureEmail): Promise<EmailResponse> {
		// Validate Email model
		try {
			await this.validationHelper.validateModel(message);
			// ignored so as not log PII
			/* eslint-disable @typescript-eslint/no-unused-vars */
		} catch (error) {
			logger.error("Failed to Validate Email model data", { messageCode: MessageCodes.MISSING_MANDATORY_FIELDS });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, "Failed to Validate Email model data.");
		}

		//Retrieve session event record for the userId
		let session;
		try {
			session = await this.iprService.getSessionBySub(message.userId);
			if (!session) {
				logger.error("No session event found for this userId", { messageCode: MessageCodes.SESSION_NOT_FOUND });
				throw new AppError(HttpCodesEnum.SERVER_ERROR, "No session event found for this userId");
			}
			logger.appendKeys({
				govuk_signin_journey_id: session.clientSessionId,
			});
			logger.info("Session retrieved from session store");
			// ignored so as not log PII
			/* eslint-disable @typescript-eslint/no-unused-vars */
		} catch (error) {
			logger.error({ message: "getSessionByUserId - failed executing get from dynamodb:" }, { messageCode: MessageCodes.ERROR_RETRIEVING_SESSION });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, "Error retrieving Session");
		}

		// Validate the notified field is set to true
		if (!session.notified) {
			logger.error("Notified flag is not set to true for this user session event", { messageCode: MessageCodes.NOTIFIED_FLAG_NOT_SET_TO_TRUE });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, "Notified flag is not set to true for this user session event");
		}

		// Validate if the record is missing some fields related to the Events and log the details and do not notify the User.
		try {
			this.validationHelper.validateSessionEventFields(session);
		} catch (error: any) {
			logger.warn(error.message, { messageCode: MessageCodes.MISSING_MANDATORY_FIELDS_IN_SESSION_EVENT });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, error.message);
		}
		
		const sessionEventData = message instanceof DynamicEmail ? ExtSessionEvent.parseRequest(JSON.stringify(session)) : SessionEvent.parseRequest(JSON.stringify(session));
		
		let data = { emailType : message.messageType };
		//Skip validating the session record fields if messageType is VISIT_PO_EMAIL_FALLBACK
		if (message.messageType !== Constants.VISIT_PO_EMAIL_FALLBACK) {
			// Validate all necessary fields are populated in the session store before processing the data.
			data = await this.validationHelper.validateSessionEvent(sessionEventData, message.messageType);
		}
		
		const emailResponse: EmailResponse = await this.govNotifyService.sendEmail(message, data.emailType);
		const txmaEmailType = message instanceof VCGenerationFailureEmail ? Constants.F2F_VC_GENERATION_FAILURE : Constants.F2F_RESULT_AVAILABLE;
		await this.iprService.sendToTXMA({
			event_name: "IPR_RESULT_NOTIFICATION_EMAILED",
			...buildCoreEventFields({ email: message.emailAddress, user_id: message.userId }, this.issuer),
			extensions: {
				previous_govuk_signin_journey_id: session.clientSessionId,
				emailType: txmaEmailType,
			},
		});

		logger.info("Response after sending Email message", { emailResponse });
		return emailResponse;
	}
}

