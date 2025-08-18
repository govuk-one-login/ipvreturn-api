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

export class POFailureEventProcessor {

	private static instance: POFailureEventProcessor;

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

	static getInstance(logger: Logger, metrics: Metrics): POFailureEventProcessor {
		if (!POFailureEventProcessor.instance) {
			POFailureEventProcessor.instance = new POFailureEventProcessor(logger, metrics);
		}
		return POFailureEventProcessor.instance;
	}

	async processRequest(sessionEvent: any): Promise<void> {
		// Fetch complete session record from DynamoDB to get email-related fields (nameParts, userEmail, etc.)
		const completeSessionRecord = await this.iprService.getSessionBySub(sessionEvent.userId);
		if (!completeSessionRecord) {
			this.logger.error("Session record not found for PO failure event", { messageCode: MessageCodes.SESSION_NOT_FOUND });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, "Session record not found for PO failure event");
		}

		this.logger.appendKeys({ govuk_signin_journey_id: completeSessionRecord.clientSessionId });

		// Validate the notified field is set to false
		if (completeSessionRecord.poFailureNotified) {
			this.logger.warn("User is already notified for this PO failure event.", { messageCode: MessageCodes.USER_ALREADY_NOTIFIED });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, "User is already notified for this PO failure event.");
		}

		// Send the PO failure email notification message
		await this.sendPOFailureEmailToGovNotify(completeSessionRecord);

		// Update the DB table with PO failure notified flag set to true
		try {
			const updateExpression = "SET poFailureNotified = :poFailureNotified";
			const expressionAttributeValues = {
				":poFailureNotified": true,
			};
			await this.iprService.saveEventData(sessionEvent.userId, updateExpression, expressionAttributeValues);
			this.logger.info({ message: "Updated the PO failure event record with poFailureNotified flag" });
			this.metrics.addMetric("POFailureEventProcessor_successfully_processed_events", MetricUnits.Count, 1);
		} catch (error: any) {
			throw new AppError(HttpCodesEnum.SERVER_ERROR, error.message);
		}
	}

	async sendPOFailureEmailToGovNotify(sessionEvent: ExtSessionEvent | SessionEvent): Promise<void> {
		// Send SQS message to GovNotify queue to send PO failure email to the user.
		try {
			this.logger.info({ message: "Trying to send PO_FAILURE_EMAIL type message to GovNotify handler" });

			await this.iprService.sendToGovNotify(buildGovNotifyEventFields(sessionEvent, Constants.PO_FAILURE_EMAIL, this.logger));
			this.metrics.addMetric("PO_failure_email_added_to_queue", MetricUnits.Count, 1);
		} catch (error) {
			this.logger.error("FAILED_TO_WRITE_GOV_NOTIFY", {
				reason: "Processing Event session data, failed to post PO_FAILURE_EMAIL type message to GovNotify SQS Queue",
				error,
			}, { messageCode: MessageCodes.FAILED_TO_WRITE_GOV_NOTIFY });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, "An error occurred when sending PO_FAILURE_EMAIL type message to GovNotify handler");
		}
	}
}