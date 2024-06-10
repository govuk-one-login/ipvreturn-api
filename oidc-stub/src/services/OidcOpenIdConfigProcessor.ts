import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { checkRequiredEnvVars } from "../utils/EnvironmentVarUtils";

export class OidcOpenIdConfigProcessor {
    private static instance: OidcOpenIdConfigProcessor;

    private readonly logger: Logger;
	
    constructor(logger: Logger) {
    	this.logger = logger;
    }

    static getInstance(logger: Logger, metrics: Metrics): OidcOpenIdConfigProcessor {
		if (!checkRequiredEnvVars(["OIDC_URL"])) throw new Error("Missing Configuration");
    	if (!OidcOpenIdConfigProcessor.instance) {
    		OidcOpenIdConfigProcessor.instance = new OidcOpenIdConfigProcessor(logger);
    	}
    	return OidcOpenIdConfigProcessor.instance;
    }

    /***
     * GET /.well-known/openid-configuration
     */
    async returnOpenIdConfig(): Promise<any> {
    	this.logger.info({ message: "Fetching OpenId configuration response" });
		const baseUrl = process.env.OIDC_URL;
		return {
			statusCode: HttpCodesEnum.OK,
			body: JSON.stringify({
				"authorization_endpoint": baseUrl+"authorize",
				"token_endpoint": baseUrl+"token",
				"registration_endpoint": baseUrl +"connect/register",
				"issuer": baseUrl,
				"jwks_uri": baseUrl+".well-known/jwks.json",
				"scopes_supported": [
				  "openid",
				  "email",
				  "phone",
				  "offline_access"
				],
				"response_types_supported": [
				  "code"
				],
				"grant_types_supported": [
				  "authorization_code"
				],
				"token_endpoint_auth_methods_supported": [
				  "private_key_jwt",
				  "client_secret_post"
				],
				"token_endpoint_auth_signing_alg_values_supported": [
				  "RS256",
				  "RS384",
				  "RS512",
				  "PS256",
				  "PS384",
				  "PS512"
				],
				"ui_locales_supported": [
				  "en",
				  "cy"
				],
				"service_documentation": "https://docs.sign-in.service.gov.uk/",
				"op_policy_uri": "https://signin.staging.account.gov.uk/privacy-notice",
				"op_tos_uri": "https://signin.staging.account.gov.uk/terms-and-conditions",
				"request_parameter_supported": true,
				"trustmarks": baseUrl+"trustmark",
				"subject_types_supported": [
				  "public",
				  "pairwise"
				],
				"userinfo_endpoint": baseUrl+"userinfo",
				"end_session_endpoint": baseUrl+"logout",
				"id_token_signing_alg_values_supported": [
				  "ES256",
				  "RS256"
				],
				"claim_types_supported": [
				  "normal"
				],
				"claims_supported": [
				  "sub",
				  "email",
				  "email_verified",
				  "phone_number",
				  "phone_number_verified",
				  "wallet_subject_id",
				  "https://vocab.account.gov.uk/v1/passport",
				  "https://vocab.account.gov.uk/v1/socialSecurityRecord",
				  "https://vocab.account.gov.uk/v1/drivingPermit",
				  "https://vocab.account.gov.uk/v1/coreIdentityJWT",
				  "https://vocab.account.gov.uk/v1/address",
				  "https://vocab.account.gov.uk/v1/inheritedIdentityJWT",
				  "https://vocab.account.gov.uk/v1/returnCode"
				],
				"request_uri_parameter_supported": false,
				"backchannel_logout_supported": true,
				"backchannel_logout_session_supported": false
			}
		),
		};
    }

}


