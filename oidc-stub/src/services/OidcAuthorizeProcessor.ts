import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";

export class OidcAuthorizeProcessor {
    private static instance: OidcAuthorizeProcessor;

    private readonly logger: Logger;
	
    constructor(logger: Logger) {
    	this.logger = logger;
    }

    static getInstance(logger: Logger, metrics: Metrics): OidcAuthorizeProcessor {
		if (!OidcAuthorizeProcessor.instance) {
    		OidcAuthorizeProcessor.instance = new OidcAuthorizeProcessor(logger);
    	}
    	return OidcAuthorizeProcessor.instance;
    }

    /***
	 * Authorization endpoint
     * GET /authorize
     */
    async returnAuthCode(event: any): Promise<any> {
		this.logger.info({ message: "Generating AuthCode" });
		// Return static value for FE to retrieve the user details from DDB
		const authorizationCode = "01333e01-dde3-412f-a484-4444";
		const redirectUri = event.queryStringParameters.redirect_uri;
		const redirectUrl = `${redirectUri}?code=${authorizationCode}&state=${authorizationCode}`;
		this.logger.info({ message: "Successfully generated authorizationCode, redirectUrl: ", redirectUrl });
		return {
			statusCode: HttpCodesEnum.FOUND,
			headers: {
				Location: redirectUrl
			}
		}
    }

}
