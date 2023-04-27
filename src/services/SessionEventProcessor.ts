import { ValidationHelper } from "../utils/ValidationHelper";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { SessionEvent } from "../models/SessionEvent";
import { HttpCodesEnum } from "../models/enums/HttpCodesEnum";
import { Response } from "../utils/Response";
import { buildGovNotifyEventFields } from "../utils/GovNotifyEvent";
import { IprService } from "./IprService";

export class SessionEventProcessor {

    private static instance: SessionEventProcessor;

    private readonly logger: Logger;

    private readonly metrics: Metrics;

    private readonly validationHelper: ValidationHelper;

	private readonly iprService: IprService;

	constructor(logger: Logger, metrics: Metrics) {
    	this.logger = logger;
    	this.validationHelper = new ValidationHelper();
    	this.metrics = metrics;
		this.iprService = IprService.getInstance(this.logger);
	}

	static getInstance(logger: Logger, metrics: Metrics): SessionEventProcessor {
    	if (!SessionEventProcessor.instance) {
			SessionEventProcessor.instance = new SessionEventProcessor(logger, metrics);
    	}
    	return SessionEventProcessor.instance;
	}

	async processRequest(sessionEvent: any): Promise<Response> {
		const sessionEventData: SessionEvent = SessionEvent.parseRequest(JSON.stringify(sessionEvent));

    	this.logger.debug("Session Event data for reference: ", { sessionEventData });
		// Check the eventName was last updated with IPV_F2F_CRI_VC_CONSUMED
		if (sessionEventData.eventName !== "IPV_F2F_CRI_VC_CONSUMED") {
			this.logger.error(`EventName is in wrong state: Expected state- IPV_F2F_CRI_VC_CONSUMED, actual state- ${sessionEventData.eventName}`);
			return new Response(HttpCodesEnum.SERVER_ERROR, `EventName is in wrong state: Expected state- IPV_F2F_CRI_VC_CONSUMED, actual state- ${sessionEventData.eventName}`);
		}

		// Validate the notified field is set to false
		if (sessionEventData.notified) {
			this.logger.error("User is already notified for this session event.");
			return new Response(HttpCodesEnum.SERVER_ERROR, "User is already notified for this session event.");
		}
		// Validate all necessary fields are populated before processing the data.
		await this.validationHelper.validateModel(sessionEventData, this.logger);

		// Send SQS message to GovNotify queue to send email to the user.
		try {
			await this.iprService.sendToGovNotify(buildGovNotifyEventFields(sessionEventData.email, sessionEventData.firstName, sessionEventData.lastName));
		} catch (error) {
			const userId = sessionEventData.userId;
			this.logger.error("FAILED_TO_WRITE_GOV_NOTIFY", {
				userId,
				reason: "Processing Event session data, failed to post message to GovNotify SQS Queue",
				error,
			});
			return new Response(HttpCodesEnum.SERVER_ERROR, "An error occurred when sending message to GovNotify handler");
		}
		// Update the DB table with notified flag set to true

    	return new Response( HttpCodesEnum.OK, "Success");
	}
}

