import { Email, DynamicEmail } from "../models/Email";
import { EmailResponse } from "../models/EmailResponse";
import { ValidationHelper } from "../utils/ValidationHelper";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
import { buildCoreEventFields } from "../utils/TxmaEvent";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { SendEmailService } from "./SendEmailService";
import { IPRService } from "./IPRService";
import { MessageCodes } from "../models/enums/MessageCodes";
import { AppError } from "../utils/AppError";
import { HttpCodesEnum } from "../models/enums/HttpCodesEnum";
import { ExtSessionEvent, SessionEvent } from "../models/SessionEvent";
import { Constants } from "../utils/Constants";

export class SendEmailProcessor {

	private static instance: SendEmailProcessor;

	private readonly logger: Logger;

	private readonly metrics: Metrics;

	private readonly sessionEventsTable: string;

	private readonly validationHelper: ValidationHelper;

	private readonly govNotifyService: SendEmailService;

	private readonly iprService: IPRService;

	constructor(logger: Logger, metrics: Metrics, GOVUKNOTIFY_API_KEY: string, govnotifyServiceId: string, sessionEventsTable: string) {
		this.logger = logger;
		this.validationHelper = new ValidationHelper();
		this.metrics = metrics;
		this.govNotifyService = SendEmailService.getInstance(this.logger, GOVUKNOTIFY_API_KEY, govnotifyServiceId);
		this.sessionEventsTable = sessionEventsTable;
		this.iprService = IPRService.getInstance(this.sessionEventsTable, this.logger, createDynamoDbClient());
	}

	static getInstance(logger: Logger, metrics: Metrics, GOVUKNOTIFY_API_KEY: string, govnotifyServiceId: string, sessionEventsTable: string): SendEmailProcessor {
		if (!SendEmailProcessor.instance) {
			SendEmailProcessor.instance = new SendEmailProcessor(logger, metrics, GOVUKNOTIFY_API_KEY, govnotifyServiceId, sessionEventsTable);
		}
		return SendEmailProcessor.instance;
	}

	async processRequest(message: Email | DynamicEmail): Promise<EmailResponse> {
		let fallbackEventJourney: boolean = false;
		//const message = Email.parseRequest(JSON.stringify(eventBody.Message));
		// Validate Email model
		try {
			await this.validationHelper.validateModel(message, this.logger);
		} catch (error) {
			this.logger.error("Failed to Validate Email model data - Continuing to send fallback email to user", { messageCode: MessageCodes.MISSING_MANDATORY_FIELDS });
			fallbackEventJourney = true;
			// throw new AppError(HttpCodesEnum.SERVER_ERROR, "Failed to Validate Email model data.");
		}

		//Retrieve session event record for the userId
		let session;
		try {
			session = await this.iprService.getSessionBySub(message.userId);
			if (!session) {
				this.logger.error("No session event found for this userId", { messageCode: MessageCodes.SESSION_NOT_FOUND });
				throw new AppError(HttpCodesEnum.SERVER_ERROR, "No session event found for this userId");
			}
			this.logger.appendKeys({
				govuk_signin_journey_id: session.clientSessionId,
			});
			this.logger.info("Session retrieved from session store");

		} catch (error) {
			this.logger.error({ message: "getSessionByUserId - failed executing get from dynamodb:", error }, { messageCode: MessageCodes.ERROR_RETRIEVING_SESSION });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, "Error retrieving Session");
		}

		// Validate the notified field is set to true
		if (!session.notified) {
			this.logger.error("Notified flag is not set to true for this user session event", { messageCode: MessageCodes.NOTIFIED_FLAG_NOT_SET_TO_TRUE });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, "Notified flag is not set to true for this user session event");
		}

		// Validate if the record is missing some fields related to the Events and log the details and do not notify the User.
		try {
			this.validationHelper.validateSessionEventFields(session);
		} catch (error: any) {
			this.logger.warn(error.message, { messageCode: MessageCodes.MISSING_MANDATORY_FIELDS_IN_SESSION_EVENT });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, error.message);
		}
		
		let emailResponse: EmailResponse;

		if (!fallbackEventJourney) {
			const sessionEventData = message instanceof DynamicEmail ? ExtSessionEvent.parseRequest(JSON.stringify(session)) : SessionEvent.parseRequest(JSON.stringify(session));
		
			// Validate all necessary fields are populated in the session store before processing the data.
			const data = await this.validationHelper.validateSessionEvent(sessionEventData, message.messageType, this.logger);

			this.logger.info(`Sending ${data.emailType} Email to user`)
			emailResponse = await this.govNotifyService.sendEmail(message, data.emailType);
		} else {
			this.logger.info("Sending Fallback Email to user")
			emailResponse = await this.govNotifyService.sendEmail(null, Constants.VISIT_PO_EMAIL_FALLBACK);
		}
		
		try {
			await this.iprService.sendToTXMA({
				event_name: "IPR_RESULT_NOTIFICATION_EMAILED",
				...buildCoreEventFields({ email: message.emailAddress, user_id: message.userId }),
				extensions: {
					previous_govuk_signin_journey_id: session.clientSessionId,
				},
			});
		} catch (error) {
			this.logger.error("Failed to write TXMA event IPR_RESULT_NOTIFICATION_EMAILED to SQS queue.", {
				messageCode: MessageCodes.FAILED_TO_WRITE_TXMA,
			});
		}

		this.logger.info("Response after sending Email message", { emailResponse });
		return emailResponse;
	}
}

