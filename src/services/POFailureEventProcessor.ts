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
		let sessionEventData: any = ExtSessionEvent.parseRequest(JSON.stringify(sessionEvent));

		this.logger.appendKeys({ govuk_signin_journey_id: sessionEventData.clientSessionId });

		// Validate the notified field is set to false
		if (sessionEventData.notified) {
			this.logger.warn("User is already notified for this PO failure event.", { messageCode: MessageCodes.USER_ALREADY_NOTIFIED });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, "User is already notified for this PO failure event.");
		}

		// Send the PO failure email notification message
		await this.sendPOFailureEmailToGovNotify(sessionEventData);

		// Update the DB table with notified flag set to true
		try {
			const updateExpression = "SET notified = :notified";
			const expressionAttributeValues = {
				":notified": true,
			};
			await this.iprService.saveEventData(sessionEventData.userId, updateExpression, expressionAttributeValues);
			this.logger.info({ message: "Updated the PO failure event record with notified flag" });
			this.metrics.addMetric("POFailureEventProcessor_successfully_processed_events", MetricUnits.Count, 1);
		} catch (error: any) {
			throw new AppError(HttpCodesEnum.SERVER_ERROR, error.message);
		}
	}

	async sendPOFailureEmailToGovNotify(sessionEvent: ExtSessionEvent | SessionEvent): Promise<void> {
		throw new Error("Not implemented");
	}
}