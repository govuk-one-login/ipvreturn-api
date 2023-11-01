export class Constants {

    static readonly DEBUG = "DEBUG";

    static readonly INFO = "INFO";

    static readonly WARN = "WARN";

    static readonly ERROR = "ERROR";

    static readonly ENV_VAR_UNDEFINED = "ENV Variables are undefined";

    static readonly EMAIL_LOGGER_SVC_NAME = "SendEmailHandler";

    static readonly F2F_YOTI_START = "F2F_YOTI_START";

    static readonly AUTH_IPV_AUTHORISATION_REQUESTED = "AUTH_IPV_AUTHORISATION_REQUESTED";

    static readonly IPV_F2F_CRI_VC_CONSUMED = "IPV_F2F_CRI_VC_CONSUMED";

    static readonly F2F_DOCUMENT_UPLOADED = "F2F_DOCUMENT_UPLOADED";

    static readonly AUTH_DELETE_ACCOUNT = "AUTH_DELETE_ACCOUNT";

    static readonly POSTEVENT_LOGGER_SVC_NAME = "PostEventHandler";

    static readonly STREAM_PROCESSOR_LOGGER_SVC_NAME = "RecordStreamHandler";

    static readonly IPVRETURN_METRICS_NAMESPACE = "IPVRETURN-CRI";

    static readonly OIDC_TOKEN_ENDPOINT = "token";

    static readonly OIDC_OPENID_CONFIG_ENDPOINT = ".well-known/openid-configuration";

    static readonly CLIENT_ASSERTION_TYPE = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";

    static readonly GRANT_TYPE = "authorization_code";

    static readonly ROLE_SESSION_NAME = "AssumeRoleWithWebIdentityRole";

    static readonly VIST_PO_EMAIL_STATIC = "VIST_PO_EMAIL_STATIC";

    static readonly VIST_PO_EMAIL_DYNAMIC = "VIST_PO_EMAIL_DYNAMIC";
}

export const TXMA_EVENT_DETAILS = {
	AUTH_REQUESTED: {
		Name: "AUTH_IPV_AUTHORISATION_REQUESTED",
		UpdateExpression: "SET ipvStartedOn = :ipvStartedOn, userEmail = :userEmail, clientName = :clientName,  redirectUri = :redirectUri, expiresOn = :expiresOn",
	},
	YOTI_START: {
		Name: "F2F_YOTI_START",
		UpdateExpression: "SET journeyWentAsyncOn = :journeyWentAsyncOn, expiresOn = :expiresOn",
	},
	VC_CONSUMED: {
		Name: "IPV_F2F_CRI_VC_CONSUMED",
		UpdateExpression: "SET readyToResumeOn = :readyToResumeOn, nameParts = :nameParts",
	},
	DOCUMENT_UPLOADED: {
		Name: "F2F_DOCUMENT_UPLOADED",
		UpdateExpression: "SET documentUploadedOn = :documentUploadedOn, postOfficeVisitDetails = :postOfficeVisitDetails",
	},
	DELETE_ACCOUNT: {
		Name: "AUTH_DELETE_ACCOUNT",
		UpdateExpression: "SET accountDeletedOn = :accountDeletedOn, userEmail = :userEmail, nameParts = :nameParts, clientName = :clientName,  redirectUri = :redirectUri",
	},
};
