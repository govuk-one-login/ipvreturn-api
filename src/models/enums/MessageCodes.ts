export enum MessageCodes {
	RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
	SERVER_ERROR = "SERVER_ERROR",
	MISSING_MANDATORY_FIELDS = "MISSING_MANDATORY_FIELDS_IN_SQS_EVENT",
	MISSING_CONFIGURATION = "MISSING_CONFIGURATION",
	INVALID_AUTH_CODE = "INVALID_AUTH_CODE",
	SESSION_NOT_FOUND = "SESSION_NOT_FOUND",
	PERSON_NOT_FOUND = "PERSON_NOT_FOUND",
	STATE_MISMATCH = "STATE_MISMATCH",
	INVALID_CLAIMED_IDENTITY = "INVALID_CLAIMED_IDENTITY",
	ERROR_SIGNING_VC = "ERROR_SIGNING_VC",
	ERROR_WRITING_TXMA = "ERROR_WRITING_TXMA",
	UNRECOGNISED_CLIENT = "UNRECOGNISED_CLIENT",
	FAILED_DECRYPTING_JWE = "FAILED_DECRYPTING_JWE",
	FAILED_DECODING_JWT = "FAILED_DECODING_JWT",
	FAILED_VERIFYING_JWT = "FAILED_VERIFYING_JWT",
	UNEXPECTED_ERROR_SESSION_EXISTS = "UNEXPECTED_ERROR_SESSION_EXISTS",
	FAILED_CREATING_SESSION = "FAILED_CREATING_SESSION",
	FAILED_SAVING_PERSON_IDENTITY = "FAILED_SAVING_PERSON_IDENTITY",
	FAILED_TO_WRITE_TXMA = "FAILED_TO_WRITE_TXMA",
	UNEXPECTED_ERROR_VERIFYING_JWT = "UNEXPECTED_ERROR_VERIFYING_JWT",
	FAILED_VALIDATING_JWT = "FAILED_VALIDATING_JWT",
	SESSION_ALREADY_EXISTS = "SESSION_ALREADY_EXISTS",
	USER_ALREADY_NOTIFIED = "USER_ALREADY_NOTIFIED",
	MISSING_MANDATORY_FIELDS_IN_SESSION_EVENT = "MISSING_MANDATORY_FIELDS_IN_SESSION_EVENT",
	MISSING_NEW_PO_FIELDS_IN_SESSION_EVENT = "MISSING_NEW_PO_FIELDS_IN_SESSION_EVENT",
	FAILED_TO_WRITE_GOV_NOTIFY = "FAILED_TO_WRITE_GOV_NOTIFY_SQS",
	NOTIFIED_FLAG_NOT_SET_TO_TRUE = "NOTIFIED_FLAG_NOT_SET_TO_TRUE",
	ERROR_RETRIEVING_SESSION = "ERROR_RETRIEVING_SESSION",
	MISSING_OIDC_CONFIGURATION = "MISSING_OIDC_CONFIGURATION",
	ERROR_ASSUMING_ROLE_WITH_WEB_IDENTITY = "ERROR_ASSUMING_ROLE_WITH_WEB_IDENTITY",
	USER_NOT_NOTIFIED = "USER_NOT_NOTIFIED",
	ERROR_SIGNING_JWT = "ERROR_SIGNING_JWT",
	UNEXPECTED_ERROR_FETCHING_OIDC_TOKEN = "UNEXPECTED_ERROR_FETCHING_OIDC_TOKEN",
	SESSION_EXPIRED = "SESSION_EXPIRED",
	FAILED_TO_SEND_EMAIL = "FAILED_TO_SEND_EMAIL",
	UNRECOGNISED_EMAIL_TYPE = "UNRECOGNISED_EMAIL_TYPE",
}
