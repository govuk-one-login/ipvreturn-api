import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { AppError } from "../utils/AppError";
import { HttpCodesEnum } from "../models/enums/HttpCodesEnum";
import { Constants } from "../utils/Constants";
import { IPRService } from "./IPRService";
import { EnvironmentVariables } from "./EnvironmentVariables";
import { ServicesEnum } from "../models/enums/ServicesEnum";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
import { buildGovNotifyEventFields } from "../utils/GovNotifyEvent";
import { MessageCodes } from "../models/enums/MessageCodes";
import { personalIdentityUtils } from "../utils/PersonalIdentityUtils";


export class FallbackEmailProcessor {
	private static instance: FallbackEmailProcessor;

	private readonly logger: Logger;

	private readonly metrics: Metrics;

	private readonly environmentVariables: EnvironmentVariables;

	private readonly iprService: IPRService;

	constructor(logger: Logger, metrics: Metrics) {
		this.logger = logger;
		this.metrics = metrics;
		this.environmentVariables = new EnvironmentVariables(logger, ServicesEnum.FALLBACK_EMAIL_SERVICE);
		this.iprService = IPRService.getInstance(this.environmentVariables.sessionEventsTable(), this.logger, createDynamoDbClient());
	}

	static getInstance(logger: Logger, metrics: Metrics): FallbackEmailProcessor {
		if (!FallbackEmailProcessor.instance) {
			FallbackEmailProcessor.instance = new FallbackEmailProcessor(logger, metrics);
		}
		return FallbackEmailProcessor.instance;
	}

	async processRequest(): Promise<any> {

		const SessionRecordsToRetry = await this.iprService.getSessionsToRetry();

		if (SessionRecordsToRetry.length === 0) {
			this.logger.info("No Sessions Records found matching retry conditions");
			return { statusCode: HttpCodesEnum.OK, body: "No Sessions Records found matching retry conditions" };
		}

		let emailType: string;
		
		for (const item of SessionRecordsToRetry) {
			try { 
				if (item.nameParts) {
					emailType = Constants.VISIT_PO_EMAIL_STATIC;
					this.logger.info({ message: `Trying to send ${emailType} message to GovNotify handler` });
					const nameParts = personalIdentityUtils.getNames(item.nameParts);
					await this.iprService.sendToGovNotify(buildGovNotifyEventFields(nameParts, item, emailType, this.logger));
				} else {
					emailType = Constants.VISIT_PO_EMAIL_FALLBACK;
					this.logger.info({ message: `Trying to send ${emailType} message to GovNotify handler` });
					await this.iprService.sendToGovNotify(buildGovNotifyEventFields(null, item, emailType, this.logger));
				}

				// Update the DB table with notified flag set to true
				try {
					const updateExpression = "SET notified = :notified";
					const expressionAttributeValues = {
						":notified": true,
					};
					await this.iprService.saveEventData(item.userId, updateExpression, expressionAttributeValues);
					this.logger.info({ message: "Updated the session event record with notified flag" });
				} catch (error: any) {
					this.logger.error("");
					throw new AppError(HttpCodesEnum.SERVER_ERROR, error.message);
				}
			} catch (error) {
				this.logger.error("FAILED_TO_WRITE_GOV_NOTIFY", {
					reason: "Processing Event session data, failed to post fallback email message to GovNotify SQS Queue",
					error,
				}, { messageCode: MessageCodes.FAILED_TO_WRITE_GOV_NOTIFY });
				throw new AppError(HttpCodesEnum.SERVER_ERROR, "An error occurred when sending fallback email message to GovNotify handler");
			}	
		}
	}
}
