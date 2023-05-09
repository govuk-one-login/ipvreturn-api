import { Logger } from "@aws-lambda-powertools/logger";
import { AppError } from "../utils/AppError";
import { HttpCodesEnum } from "../models/enums/HttpCodesEnum";
import { Constants } from "../utils/Constants";
import { ServicesEnum } from "../models/enums/ServicesEnum";

/**
 * Class to read, store, and return environment variables used by this lambda
 */
export class EnvironmentVariables {

	private readonly GOVUKNOTIFY_TEMPLATE_ID = process.env.GOVUKNOTIFY_TEMPLATE_ID;

	private GOVUKNOTIFY_MAX_RETRIES = process.env.GOVUKNOTIFY_MAX_RETRIES;

	private GOVUKNOTIFY_BACKOFF_PERIOD_MS = process.env.GOVUKNOTIFY_BACKOFF_PERIOD_MS;

	private readonly GOVUKNOTIFY_API_KEY_SSM_PATH = process.env.GOVUKNOTIFY_API_KEY_SSM_PATH;

	private readonly RETURN_JOURNEY_URL = process.env.RETURN_JOURNEY_URL;

	private readonly SESSION_EVENTS_TABLE = process.env.SESSION_EVENTS_TABLE;
	
	private readonly SESSION_RECORD_TTL = process.env.SESSION_RECORD_TTL;

	/*
	 * This function performs validation on env variable values.
	 * If certain variables have unexpected values the constructor will throw an error and/or log an error message
	 */
	private verifyEnvVariablesByServiceType(serviceType: ServicesEnum, logger: Logger): void {
		switch (serviceType) {
			case ServicesEnum.GOV_NOTIFY_SERVICE: {
				if (!this.GOVUKNOTIFY_API_KEY_SSM_PATH || this.GOVUKNOTIFY_API_KEY_SSM_PATH.trim().length === 0 ||
					!this.RETURN_JOURNEY_URL || this.RETURN_JOURNEY_URL.trim().length === 0) {
					logger.error(`GovNotifyService - Misconfigured external API's key ${EnvironmentVariables.name}`);
					throw new AppError(HttpCodesEnum.SERVER_ERROR, Constants.ENV_VAR_UNDEFINED);
				}

				if (!this.GOVUKNOTIFY_BACKOFF_PERIOD_MS
					|| this.GOVUKNOTIFY_BACKOFF_PERIOD_MS.trim().length === 0
					|| +this.GOVUKNOTIFY_BACKOFF_PERIOD_MS.trim() === 0
					|| +this.GOVUKNOTIFY_BACKOFF_PERIOD_MS.trim() >= 60000) {
					this.GOVUKNOTIFY_BACKOFF_PERIOD_MS = "20000";
					logger.warn("GOVUKNOTIFY_BACKOFF_PERIOD_MS env var is not set. Setting to default - 20000");
				}

				if (!this.GOVUKNOTIFY_MAX_RETRIES
					|| this.GOVUKNOTIFY_MAX_RETRIES.trim().length === 0
					|| +this.GOVUKNOTIFY_MAX_RETRIES.trim() >= 100) {
					this.GOVUKNOTIFY_MAX_RETRIES = "3";
					logger.warn("GOVUKNOTIFY_MAX_RETRIES env var is not set. Setting to default - 3");
				}
				break;
			}
			case ServicesEnum.POST_EVENT_SERVICE: {
				if (!this.SESSION_EVENTS_TABLE || this.SESSION_EVENTS_TABLE.trim().length === 0) {
					logger.error("PostEvent Handler - Missing SessionEvents Tablename");
					throw new AppError(HttpCodesEnum.SERVER_ERROR, Constants.ENV_VAR_UNDEFINED);
				}

				if (!this.SESSION_RECORD_TTL || this.SESSION_RECORD_TTL.trim().length === 0) {
					logger.error("PostEvent Handler - Missing SESSION_RECORD_TTL");
					throw new AppError(HttpCodesEnum.SERVER_ERROR, Constants.ENV_VAR_UNDEFINED);
				}
				break;
			}
			default:
				break;
		}
	}

	/**
	 * Constructor reads all necessary environment variables by ServiceType
	 */
	constructor(logger: Logger, serviceType: ServicesEnum) {
		this.verifyEnvVariablesByServiceType(serviceType, logger);
	}

	/**
	 * Accessor methods for env variable values
	 */

	getEmailTemplateId(logger: Logger): any {
		if (!this.GOVUKNOTIFY_TEMPLATE_ID || this.GOVUKNOTIFY_TEMPLATE_ID.trim().length === 0) {
			logger.error(`GovNotifyService - Misconfigured external API's key ${EnvironmentVariables.name}`);
			throw new AppError(HttpCodesEnum.SERVER_ERROR, Constants.ENV_VAR_UNDEFINED);
		}
		return this.GOVUKNOTIFY_TEMPLATE_ID;
	}

	maxRetries(): number {
		return +this.GOVUKNOTIFY_MAX_RETRIES!;
	}

	backoffPeriod(): number {
		return +this.GOVUKNOTIFY_BACKOFF_PERIOD_MS!;
	}

	govNotifyApiKeySsmPath(): any {
		return this.GOVUKNOTIFY_API_KEY_SSM_PATH;
	}

	returnJourneyUrl(): any {
		return this.RETURN_JOURNEY_URL;
	}

	sessionEventsTable(): any {
		return this.SESSION_EVENTS_TABLE;
	}

	sessionRecordTTL(): any {
		return this.SESSION_RECORD_TTL
	}

}
