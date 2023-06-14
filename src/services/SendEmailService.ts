// @ts-ignore
import { NotifyClient } from "notifications-node-client";

import { EmailResponse } from "../models/EmailResponse";
import { Email } from "../models/Email";
import { GovNotifyErrorMapper } from "./GovNotifyErrorMapper";
import { EnvironmentVariables } from "./EnvironmentVariables";
import { Logger } from "@aws-lambda-powertools/logger";
import { HttpCodesEnum } from "../models/enums/HttpCodesEnum";
import { AppError } from "../utils/AppError";
import { sleep } from "../utils/Sleep";
import { ServicesEnum } from "../models/enums/ServicesEnum";

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
    private constructor(logger: Logger, GOVUKNOTIFY_API_KEY: string) {
    	this.logger = logger;
    	this.environmentVariables = new EnvironmentVariables(logger, ServicesEnum.GOV_NOTIFY_SERVICE);
    	this.govNotify = new NotifyClient(GOVUKNOTIFY_API_KEY);
    	this.govNotifyErrorMapper = new GovNotifyErrorMapper();
    }

    static getInstance(logger: Logger, GOVUKNOTIFY_API_KEY: string): SendEmailService {
    	if (!this.instance) {
    		this.instance = new SendEmailService(logger, GOVUKNOTIFY_API_KEY);
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
    async sendEmail(message: Email): Promise<EmailResponse> {
    	const personalisation = {
    		"first name": message.firstName,
    		"last name": message.lastName,
    		"return_journey_URL": this.environmentVariables.returnJourneyUrl(),
    	};

    	const options = {
    		personalisation,
    		reference: message.referenceId,
    	};

    	this.logger.debug("sendEmail", SendEmailService.name);

    	let retryCount = 0;
    	//retry for maxRetry count configured value if fails
    	while (retryCount <= this.environmentVariables.maxRetries()) {
    		this.logger.debug(`sendEmail - trying to send email message ${SendEmailService.name} ${new Date().toISOString()}`, {
    			templateId: this.environmentVariables.getEmailTemplateId(this.logger),
    			options,
    			retryCount,
    		});

    		try {
    			const emailResponse = await this.govNotify.sendEmail(this.environmentVariables.getEmailTemplateId(this.logger), message.emailAddress, options);
    			this.logger.debug("sendEmail - response status after sending Email", SendEmailService.name, emailResponse.status);
    			return new EmailResponse(new Date().toISOString(), "", emailResponse.status);
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

}
