import { Logger } from "@aws-lambda-powertools/logger";
import { AppError } from "../utils/AppError";
import { HttpCodesEnum } from "../models/enums/HttpCodesEnum";
import { Constants } from "../utils/Constants";
import { ServicesEnum } from "../models/enums/ServicesEnum";
import { MessageCodes } from "../models/enums/MessageCodes";

/**
 * Class to read, store, and return environment variables used by this lambda
 */
export class EnvironmentVariables {

	private readonly GOVUKNOTIFY_API = process.env.GOVUKNOTIFY_API;

	private readonly GOVUKNOTIFY_TEMPLATE_ID = process.env.GOVUKNOTIFY_TEMPLATE_ID;

	private readonly GOVUKNOTIFY_DYNAMIC_EMAIL_TEMPLATE_ID = process.env.GOVUKNOTIFY_DYNAMIC_EMAIL_TEMPLATE_ID;

	private GOVUKNOTIFY_MAX_RETRIES = process.env.GOVUKNOTIFY_MAX_RETRIES;

	private GOVUKNOTIFY_BACKOFF_PERIOD_MS = process.env.GOVUKNOTIFY_BACKOFF_PERIOD_MS;

	private readonly GOVUKNOTIFY_API_KEY_SSM_PATH = process.env.GOVUKNOTIFY_API_KEY_SSM_PATH;

	private readonly RETURN_JOURNEY_URL = process.env.RETURN_JOURNEY_URL;

	private readonly GOV_NOTIFY_QUEUE_URL = process.env.GOV_NOTIFY_QUEUE_URL;

	private readonly SESSION_EVENTS_TABLE = process.env.SESSION_EVENTS_TABLE;
	
	private readonly AUTH_EVENTS_TABLE = process.env.AUTH_EVENTS_TABLE;

	private readonly AUTH_EVENT_TTL_SECS = process.env.AUTH_EVENT_TTL_SECS;

	private readonly SESSION_RETURN_RECORD_TTL_SECS = process.env.SESSION_RETURN_RECORD_TTL_SECS;

	private readonly KMS_KEY_ARN = process.env.KMS_KEY_ARN;

	private readonly OIDC_URL = process.env.OIDC_URL;

	private readonly RETURN_REDIRECT_URL = process.env.RETURN_REDIRECT_URL;

	private readonly ASSUMEROLE_WITH_WEB_IDENTITY_ARN = process.env.ASSUMEROLE_WITH_WEB_IDENTITY_ARN;

	private OIDC_JWT_ASSERTION_TOKEN_EXP = process.env.OIDC_JWT_ASSERTION_TOKEN_EXP;

	private readonly CLIENT_ID_SSM_PATH = process.env.CLIENT_ID_SSM_PATH;

	private readonly TXMA_QUEUE_URL = process.env.TXMA_QUEUE_URL;

	private readonly GOVUKNOTIFY_FALLBACK_EMAIL_TEMPLATE_ID = process.env.GOVUKNOTIFY_FALLBACK_EMAIL_TEMPLATE_ID;

	private readonly GOVUKNOTIFY_VC_GENERATION_FAILURE_EMAIL_TEMPLATE_ID = process.env.GOVUKNOTIFY_VC_GENERATION_FAILURE_EMAIL_TEMPLATE_ID;

  private readonly ISSUER = process.env.ISSUER;

  	/*
	 * This function performs validation on env variable values.
	 * If certain variables have unexpected values the constructor will throw an error and/or log an error message
	 */
  	private verifyEnvVariablesByServiceType(serviceType: ServicesEnum, logger: Logger): void {
  		switch (serviceType) {
  			case ServicesEnum.GOV_NOTIFY_SERVICE: {
  				if (!this.GOVUKNOTIFY_API_KEY_SSM_PATH || this.GOVUKNOTIFY_API_KEY_SSM_PATH.trim().length === 0 ||
					!this.RETURN_JOURNEY_URL || this.RETURN_JOURNEY_URL.trim().length === 0 ||
					!this.TXMA_QUEUE_URL || this.TXMA_QUEUE_URL.trim().length === 0 ||
					!this.SESSION_EVENTS_TABLE || this.SESSION_EVENTS_TABLE.trim().length === 0 ||
					!this.GOVUKNOTIFY_API || this.GOVUKNOTIFY_API.trim().length === 0 ||
					!this.GOVUKNOTIFY_DYNAMIC_EMAIL_TEMPLATE_ID || this.GOVUKNOTIFY_DYNAMIC_EMAIL_TEMPLATE_ID.trim().length === 0 ||
					!this.GOVUKNOTIFY_TEMPLATE_ID || this.GOVUKNOTIFY_TEMPLATE_ID.trim().length === 0 ||
					!this.GOVUKNOTIFY_FALLBACK_EMAIL_TEMPLATE_ID || this.GOVUKNOTIFY_FALLBACK_EMAIL_TEMPLATE_ID.trim().length === 0 ||
					!this.GOVUKNOTIFY_VC_GENERATION_FAILURE_EMAIL_TEMPLATE_ID || this.GOVUKNOTIFY_VC_GENERATION_FAILURE_EMAIL_TEMPLATE_ID.trim().length === 0 ||
					!this.ISSUER || this.ISSUER.trim().length === 0) {
  					logger.error({ message: "GovNotifyService - Misconfigured external API's key" }, { messageCode: MessageCodes.MISSING_CONFIGURATION });
  					throw new AppError(HttpCodesEnum.SERVER_ERROR, Constants.ENV_VAR_UNDEFINED);
  				}

  				if (!this.GOVUKNOTIFY_BACKOFF_PERIOD_MS
					|| this.GOVUKNOTIFY_BACKOFF_PERIOD_MS.trim().length === 0
					|| +this.GOVUKNOTIFY_BACKOFF_PERIOD_MS.trim() === 0
					|| +this.GOVUKNOTIFY_BACKOFF_PERIOD_MS.trim() >= 60000) {
  					this.GOVUKNOTIFY_BACKOFF_PERIOD_MS = "20000";
  					logger.warn({ message:"GOVUKNOTIFY_BACKOFF_PERIOD_MS env var is not set. Setting to default - 20000" });
  				}

  				if (!this.GOVUKNOTIFY_MAX_RETRIES
					|| this.GOVUKNOTIFY_MAX_RETRIES.trim().length === 0
					|| +this.GOVUKNOTIFY_MAX_RETRIES.trim() >= 100) {
  					this.GOVUKNOTIFY_MAX_RETRIES = "3";
  					logger.warn({ message: "GOVUKNOTIFY_MAX_RETRIES env var is not set. Setting to default - 3" });
  				}
  				break;
  			}
  			case ServicesEnum.POST_EVENT_SERVICE: {
  				if (!this.SESSION_EVENTS_TABLE || this.SESSION_EVENTS_TABLE.trim().length === 0 ||
					!this.SESSION_RETURN_RECORD_TTL_SECS || !this.AUTH_EVENT_TTL_SECS ) {
  					logger.error({ message: "PostEvent Handler - Missing SessionEvents Tablename or SESSION_RETURN_RECORD_TTL_SECS or INITIAL_SESSION_RECORD_TTL_SECS" }, { messageCode: MessageCodes.MISSING_CONFIGURATION });
  					throw new AppError(HttpCodesEnum.SERVER_ERROR, Constants.ENV_VAR_UNDEFINED);
  				}
  				break;
  			}
  			case ServicesEnum.STREAM_PROCESSOR_SERVICE: {
  				if (!this.GOV_NOTIFY_QUEUE_URL || this.GOV_NOTIFY_QUEUE_URL.trim().length === 0 ||
					!this.SESSION_EVENTS_TABLE || this.SESSION_EVENTS_TABLE.trim().length === 0) {
  					logger.error({ message: "Stream Processor Service - Misconfigured external API's key" }, { messageCode: MessageCodes.MISSING_CONFIGURATION } );
  					throw new AppError(HttpCodesEnum.SERVER_ERROR, Constants.ENV_VAR_UNDEFINED);
  				}
  				break;
  			}
  			case ServicesEnum.GET_SESSION_EVENT_DATA_SERVICE: {
  				if (!this.CLIENT_ID_SSM_PATH || this.CLIENT_ID_SSM_PATH.trim().length === 0 ||
					!this.KMS_KEY_ARN || this.KMS_KEY_ARN.trim().length === 0 ||
					!this.SESSION_EVENTS_TABLE || this.SESSION_EVENTS_TABLE.trim().length === 0 ||
					!this.OIDC_URL || this.OIDC_URL.trim().length === 0 ||
					!this.RETURN_REDIRECT_URL || this.RETURN_REDIRECT_URL.trim().length === 0 ||
					!this.ASSUMEROLE_WITH_WEB_IDENTITY_ARN || this.ASSUMEROLE_WITH_WEB_IDENTITY_ARN.trim().length === 0 ||
					!this.TXMA_QUEUE_URL || this.TXMA_QUEUE_URL.trim().length === 0) {
  					logger.error({ message: "Get Session event data Service - Misconfigured external API's key" }, { messageCode: MessageCodes.MISSING_CONFIGURATION });
  					throw new AppError(HttpCodesEnum.SERVER_ERROR, Constants.ENV_VAR_UNDEFINED);
  				}
  				if (!this.OIDC_JWT_ASSERTION_TOKEN_EXP || this.OIDC_JWT_ASSERTION_TOKEN_EXP.trim().length === 0) {
  					this.OIDC_JWT_ASSERTION_TOKEN_EXP = "900";
  					logger.warn({ message: "OIDC_JWT_ASSERTION_TOKEN_EXP env var is not set. Setting the expiry to default - 15 minutes." });
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

  	getEmailTemplateId(): any {
  		return this.GOVUKNOTIFY_TEMPLATE_ID;
  	}

  	getDynamicEmailTemplateId(): any {
  		return this.GOVUKNOTIFY_DYNAMIC_EMAIL_TEMPLATE_ID;
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

  	authEventsTable(): any {
  		return this.AUTH_EVENTS_TABLE;
  	}

  	authEventTtlSecs(): number {
  		return +this.AUTH_EVENT_TTL_SECS!;
  	}

  	sessionReturnRecordTtlSecs(): number {
  		return +this.SESSION_RETURN_RECORD_TTL_SECS!;
  	}

  	getGovNotifyQueueURL(logger: Logger): string {
  		if (!this.GOV_NOTIFY_QUEUE_URL || this.GOV_NOTIFY_QUEUE_URL.trim().length === 0) {
  			logger.error({ message: "GovNotifyService - Misconfigured external API's key" }, { messageCode: MessageCodes.MISSING_CONFIGURATION });
  			throw new AppError(HttpCodesEnum.SERVER_ERROR, Constants.ENV_VAR_UNDEFINED);
  		}
  		return this.GOV_NOTIFY_QUEUE_URL;
  	}

  	kmsKeyArn(): any {
  		return this.KMS_KEY_ARN;
  	}

  	oidcUrl(): any {
  		return this.OIDC_URL;
  	}

  	clientIdSsmPath(): any {
  		return this.CLIENT_ID_SSM_PATH;
  	}

  	returnRedirectUrl(): any {
  		return this.RETURN_REDIRECT_URL;
  	}

  	assumeRoleWithWebIdentityArn(): any {
  		return this.ASSUMEROLE_WITH_WEB_IDENTITY_ARN;
  	}

  	oidcJwtAssertionTokenExpiry(): any {
  		return this.OIDC_JWT_ASSERTION_TOKEN_EXP;
  	}

  	govukNotifyApiUrl(): any {
  		return this.GOVUKNOTIFY_API;
  	}

  	getFallbackEmailTemplateId(): any {
  		return this.GOVUKNOTIFY_FALLBACK_EMAIL_TEMPLATE_ID;
  	}

  	getVCGenerationFailureEmailTemplateId(): any {
  		return this.GOVUKNOTIFY_VC_GENERATION_FAILURE_EMAIL_TEMPLATE_ID;
  	}

  	issuer(): any {
  		return this.ISSUER;
  	}
}
