// @ts-expect-error Ignores import error needs addressed
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
import { Metrics, MetricUnits } from "@aws-lambda-powertools/metrics";

/**
 * Class to send emails using gov notify service
 */
export class SendEmailService {

    private govNotify: NotifyClient;

    private govNotifyErrorMapper: GovNotifyErrorMapper;

    private static instance: SendEmailService;

    private readonly environmentVariables: EnvironmentVariables;

    private readonly logger: Logger;

	private readonly metrics: Metrics;

	/**
	 * Constructor sets up the client needed to use gov notify service with API key read from env var
	 *
	 * @param environmentVariables
	 * @private
	 */
	private constructor(logger: Logger, metrics: Metrics, GOVUKNOTIFY_API_KEY: string, govnotifyServiceId: string) {
    	this.logger = logger;
		this.metrics = metrics;
    	this.environmentVariables = new EnvironmentVariables(logger, ServicesEnum.GOV_NOTIFY_SERVICE);
    	this.govNotify = new NotifyClient(this.environmentVariables.govukNotifyApiUrl(), govnotifyServiceId, GOVUKNOTIFY_API_KEY);
    	this.govNotifyErrorMapper = new GovNotifyErrorMapper();
	}

	static getInstance(logger: Logger, metrics: Metrics, GOVUKNOTIFY_API_KEY: string, govnotifyServiceId: string): SendEmailService {
    	if (!this.instance) {
    		this.instance = new SendEmailService(logger, metrics, GOVUKNOTIFY_API_KEY, govnotifyServiceId);
    	}
    	return this.instance;
	}

	/**
	 * Method to compose send email request
	 * This method receive object containing the data to compose the email and retrieves needed field based on object type (Email | EmailMessage)
	 * it attempts to send the email.
	 * If there is a failure, it checks if the error is retryable. If it is, it retries for the configured max number of times with a cool off period after each try.
	 * If the error is not retryable, an AppError is thrown
	 * If max number of retries is exceeded an AppError is thrown
	 *
	 * @param message
	 * @returns EmailResponse
	 * @throws AppError
	 */

	async sendEmail(message: any, emailType : string): Promise<EmailResponse> {
    	let templateId;
    	let personalisation;
    	switch (emailType) {
    		case Constants.VIST_PO_EMAIL_STATIC: {
    			// Send Static template email
    			personalisation = {
    				"first name": message.firstName,
    				"last name": message.lastName,
    				"return_journey_URL": this.environmentVariables.returnJourneyUrl(),
    			};
    			templateId = this.environmentVariables.getEmailTemplateId();
    			break;

    		}
    		case Constants.VIST_PO_EMAIL_DYNAMIC: {				
    			// Send Dynamic template email
    			personalisation = {
    				"first name": message.firstName,
    				"last name": message.lastName,
    				"return_journey_URL": this.environmentVariables.returnJourneyUrl(),
    				"chosen_photo_ID": DocumentTypes[message.documentType as keyof typeof DocumentTypes],
    				"id_expiry_date": this.getFullFormattedDate(message.documentExpiryDate),
    				"branch_name_and_address": message.poAddress,
    				"date": message.poVisitDate,
    				"time": message.poVisitTime.replace(/\s/g, ""),
    			};
    			templateId = this.environmentVariables.getDynamicEmailTemplateId();
    			break;
    		}
    		case Constants.VISIT_PO_EMAIL_FALLBACK: {				
    			// Send Fallback template email
    			personalisation = {
    				"return_journey_URL": this.environmentVariables.returnJourneyUrl(),
    			};
    			templateId = this.environmentVariables.getFallbackEmailTemplateId();
    			break;
    		}
    		case Constants.VC_GENERATION_FAILURE_EMAIL: {
    			// Send VC generation failure template email
    			personalisation = {
    				"first name": message.firstName,
    				"last name": message.lastName,
    			};
    			templateId = this.environmentVariables.getVCGenerationFailureEmailTemplateId();
    			break;
    		}
    		default: {
    			this.logger.error(`Unrecognised emailType: ${emailType}, unable to send the email.`);
    			throw new AppError(HttpCodesEnum.SERVER_ERROR, `Unrecognised emailType: ${emailType}, unable to send the email.`);
    		}
    	} 

    	const options = {
    		personalisation,
    		reference: message.referenceId,
    	};

    	this.logger.debug("sendEmail", SendEmailService.name);

    	let retryCount = 0;
    	//retry for maxRetry count configured value if fails
    	while (retryCount <= this.environmentVariables.maxRetries()) {
    		this.logger.debug(`sendEmail - trying to send ${emailType} message ${SendEmailService.name} ${new Date().toISOString()}`, {
    			templateId,
    			retryCount,
    		});

    		try {
    			this.logger.info("govNotify URL: " + this.environmentVariables.govukNotifyApiUrl());
    			const emailResponse = await this.govNotify.sendEmail(templateId, message.emailAddress, options);

				this.recordEmailMetrics(emailType);

    			this.logger.debug("sendEmail - response status after sending Email", SendEmailService.name, emailResponse.status);

    			return new EmailResponse(new Date().toISOString(), "", { emailResponseStatus: emailResponse.status, emailResponseId: emailResponse.data.id });
    		} catch (err: any) {
    			this.logger.error("sendEmail - GOV UK Notify threw an error");

    			if (err.response) {
    				this.logger.error(`GOV UK Notify error ${SendEmailService.name}`, {
    					statusCode: err.response.data.status_code,
    					errors: err.response.data.errors,
    				});
    			}

    			const appError: any = this.govNotifyErrorMapper.map(err.response.data.status_code, err.response.data.errors[0].message);

    			if (appError.obj!.shouldRetry && retryCount < this.environmentVariables.maxRetries()) {
    				this.logger.error(`sendEmail - Mapped error ${SendEmailService.name}`, { appError });
    				this.logger.error(`sendEmail - Retrying to send the email. Sleeping for ${this.environmentVariables.backoffPeriod()} ms ${SendEmailService.name} ${new Date().toISOString()}`, { retryCount });
    				await sleep(this.environmentVariables.backoffPeriod());
    				retryCount++;
    			} else {
    				this.logger.error("sendEmail - Mapped error", SendEmailService.name, appError.message);
    				throw appError;
    			}
    		}
    	}

    	// If the email couldn't be sent after the retries,
    	// an error is thrown
    	this.logger.error(`sendEmail - cannot send Email even after ${this.environmentVariables.maxRetries()} retries.`);
    	throw new AppError(HttpCodesEnum.SERVER_ERROR, `Cannot send Email even after ${this.environmentVariables.maxRetries()} retries.`);
	}

	private recordEmailMetrics(emailType: string): void {
		const singleMetric = this.metrics.singleMetric();
		singleMetric.addDimension("emailType", emailType);

		const metricName =
			emailType === Constants.VC_GENERATION_FAILURE_EMAIL
				? "GovNotify_vc_generation_failure_email_sent"
				: "GovNotify_visit_email_sent";
		singleMetric.addMetric(metricName, MetricUnits.Count, 1);
		const env = process.env.ENV ?? "unknown";

		const totals = this.metrics.singleMetric();
		totals.addDimension("Service", "IPR");
		totals.addDimension("Env", env);
		totals.addMetric("EmailsSent-Total", MetricUnits.Count, 1);

		if (emailType === Constants.VC_GENERATION_FAILURE_EMAIL) {
			const fails = this.metrics.singleMetric();
			fails.addDimension("Service", "IPR");
			fails.addDimension("Env", env);
			fails.addMetric("EmailsSent-VCFailure", MetricUnits.Count, 1);
		}

	}

	getFullFormattedDate(date: any): string {
    	const dateObject = new Date(date);
    	const formattedDate = dateObject.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    	return formattedDate;
	}

}
