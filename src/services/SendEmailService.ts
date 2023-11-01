// @ts-ignore
import { NotifyClient } from "notifications-node-client";
import { EmailResponse } from "../models/EmailResponse";
import { GovNotifyErrorMapper } from "./GovNotifyErrorMapper";
import { EnvironmentVariables } from "./EnvironmentVariables";
import { Logger } from "@aws-lambda-powertools/logger";
import { HttpCodesEnum } from "../models/enums/HttpCodesEnum";
import { AppError } from "../utils/AppError";
import { sleep } from "../utils/Sleep";
import { ServicesEnum } from "../models/enums/ServicesEnum";
import { Constants } from "../utils/Constants";
import { DocumentTypes } from "../models/enums/DocumentTypes";

/**
 * Class to send emails using gov notify service
 */
export class SendEmailService {
  
	private govNotify: NotifyClient;

	private govNotifyErrorMapper: GovNotifyErrorMapper;

	private static instance: SendEmailService;

	private readonly environmentVariables: EnvironmentVariables;

	private readonly logger: Logger;

	/**
	 * Constructor sets up the client needed to use gov notify service with API key read from env var
	 *
	 * @param environmentVariables
	 * @private
	 */
	private constructor(logger: Logger, GOVUKNOTIFY_API_KEY: string, govnotifyServiceId: string) {
		this.logger = logger;
		this.environmentVariables = new EnvironmentVariables(logger, ServicesEnum.GOV_NOTIFY_SERVICE);
		this.govNotify = new NotifyClient(this.environmentVariables.govukNotifyApiUrl(), govnotifyServiceId, GOVUKNOTIFY_API_KEY);
		this.govNotifyErrorMapper = new GovNotifyErrorMapper();
	}

	static getInstance(logger: Logger, GOVUKNOTIFY_API_KEY: string, govnotifyServiceId: string): SendEmailService {
		if (!this.instance) {
			this.instance = new SendEmailService(logger, GOVUKNOTIFY_API_KEY, govnotifyServiceId);
		}
		return this.instance;
	}

	async sendEmail(message: any, emailType: string): Promise<EmailResponse> {
		const { govNotify, environmentVariables, logger } = this;
		const templateId = emailType === Constants.VIST_PO_EMAIL_STATIC ? environmentVariables.getEmailTemplateId() : environmentVariables.getDynamicEmailTemplateId();
		const personalisation = {
			"first name": message.firstName,
			"last name": message.lastName,
			"return_journey_URL": environmentVariables.returnJourneyUrl(),
			...(emailType === Constants.VIST_PO_EMAIL_DYNAMIC && {
				"chosen_photo_ID": DocumentTypes[message.documentType as keyof typeof DocumentTypes],
				"id_expiry_date": this.getFullFormattedDate(message.documentExpiryDate),
				"branch_name_and_address": message.poAddress,
				"date": message.poVisitDate,
				"time": message.poVisitTime.replace(/\s/g, ""),
			}),
		};

		const options = { personalisation, reference: message.referenceId };
		const maxRetries = environmentVariables.maxRetries();

		for (let retryCount = 0; retryCount <= maxRetries; retryCount++) {
			logger.debug(`trying to send ${emailType} message ${SendEmailService.name} ${new Date().toISOString()}`, {
				templateId,
				retryCount,
			});

			try {
				const emailResponse = await govNotify.sendEmail(templateId, message.emailAddress, options);
				logger.info("Sending Email Type:", { emailType });
				logger.debug("Response status after sending Email", SendEmailService.name, emailResponse.status);
				return new EmailResponse(new Date().toISOString(), "", emailResponse.status);
			} catch (err: any) {
				logger.error("GOV UK Notify threw an error");

				if (err.response) {
					logger.error(`GOV UK Notify error ${SendEmailService.name}`, {
						statusCode: err.response.data.status_code,
						errors: err.response.data.errors,
					});
				}

				const appError: any = this.govNotifyErrorMapper.map(err.response.data.status_code, err.response.data.errors[0].message);

				if (appError.obj!.shouldRetry && retryCount < maxRetries) {
					logger.error(`Mapped error ${SendEmailService.name}`, { appError });
					logger.error(`Retrying to send the email. Sleeping for ${environmentVariables.backoffPeriod()} ms ${SendEmailService.name} ${new Date().toISOString()}`, { retryCount });
					await sleep(environmentVariables.backoffPeriod());
				} else {
					logger.error("Mapped error", SendEmailService.name, appError.message);
					throw appError;
				}
			}
		}

		logger.error(`Failed to send Email even after ${maxRetries} retries.`);
		throw new AppError(HttpCodesEnum.SERVER_ERROR, `Failed to send Email even after ${maxRetries} retries.`);
	}

	getFullFormattedDate(date: any): string {
		return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
	}
}

