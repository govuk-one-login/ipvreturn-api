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
		await this.validationHelper.validateModel(message, this.logger);

		const session = await this.getSessionByUserId(message.userId);

		this.validateSession(session);

		const sessionEventData = this.parseSessionEventData(session, message);
		
		const validatedSessionEvent = await this.validationHelper.validateSessionEvent(sessionEventData, message.messageType, this.logger);

		const emailResponse = await this.sendEmailAndLogEvent(message, validatedSessionEvent.emailType, session.clientSessionId);

		return emailResponse;
	}
	
	private async getSessionByUserId(userId: string): Promise<SessionEvent | ExtSessionEvent> {
		const session = await this.iprService.getSessionBySub(userId);
		if (!session) {
			this.logger.error("No session event found for this userId", { messageCode: MessageCodes.SESSION_NOT_FOUND });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, "No session event found for this userId");
		}
		this.logger.appendKeys({
			govuk_signin_journey_id: session.clientSessionId,
		});
		this.logger.info("Session retrieved from session store");
		return session;
	}
	
	private validateSession(session: SessionEvent | ExtSessionEvent): void {
		if (!session.notified) {
			this.logger.error("Notified flag is not set to true for this user session event", { messageCode: MessageCodes.NOTIFIED_FLAG_NOT_SET_TO_TRUE });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, "Notified flag is not set to true for this user session event");
		}
		try {
			this.validationHelper.validateSessionEventFields(session);
		} catch (error: any) {
			this.logger.warn(error.message, { messageCode: MessageCodes.MISSING_MANDATORY_FIELDS_IN_SESSION_EVENT });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, error.message);
		}
	}
	
	private parseSessionEventData(session: SessionEvent | ExtSessionEvent, message: Email | DynamicEmail): SessionEvent | ExtSessionEvent {
		const sessionEventData = message instanceof DynamicEmail
			? ExtSessionEvent.parseRequest(JSON.stringify(session))
			: SessionEvent.parseRequest(JSON.stringify(session));
		return sessionEventData;
	}
	
	private async sendEmailAndLogEvent(
		message: Email | DynamicEmail,
		emailType: string,
		clientSessionId: string,
	): Promise<EmailResponse> {
		const emailResponse: EmailResponse = await this.govNotifyService.sendEmail(message, emailType);
		try {
			await this.iprService.sendToTXMA({
				event_name: "IPR_RESULT_NOTIFICATION_EMAILED",
				...buildCoreEventFields({ email: message.emailAddress, user_id: message.userId }),
				extensions: {
					previous_govuk_signin_journey_id: clientSessionId,
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

