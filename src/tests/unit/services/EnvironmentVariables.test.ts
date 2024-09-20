import { Logger } from "@aws-lambda-powertools/logger";
import { EnvironmentVariables } from "../../../services/EnvironmentVariables";
import { ServicesEnum } from "../../../models/enums/ServicesEnum";

describe("EnvironmentVariables", () => {
	let logger: Logger;
	beforeEach(() => {
		logger = new Logger();
	});

	describe("govUkNotifySsmPath", () => {
		it("should return the value of GOVUKNOTIFY_API_KEY_SSM_PATH", () => {
			const envVars = new EnvironmentVariables(logger, ServicesEnum.GOV_NOTIFY_SERVICE);

			const result = envVars.govNotifyApiKeySsmPath();

			expect(result).toBe("/dev/f2f-gov-notify/lsdkgl");
		});
	});

	describe("returnJourneyUrl", () => {
		it("should return the value of RETURN_JOURNEY_URL", () => {
			const envVars = new EnvironmentVariables(logger, ServicesEnum.GOV_NOTIFY_SERVICE);

			const result = envVars.returnJourneyUrl();

			expect(result).toBe("www.test.com/return_journey_url");
		});
	});

	describe("txmaQueueUrl", () => {
		it("should return the value of TXMA_QUEUE_URL", () => {
			const envVars = new EnvironmentVariables(logger, ServicesEnum.GOV_NOTIFY_SERVICE);

			const result = envVars.txmaQueueUrl();

			expect(result).toBe("MYQUEUE");
		});
	});

	describe("issuer", () => {
		it("should return the value of ISSUER", () => {
			const envVars = new EnvironmentVariables(logger, ServicesEnum.GOV_NOTIFY_SERVICE);

			const result = envVars.issuer();

			expect(result).toBe("ISSUER");
		});
	});

	describe("sessionEventsTable", () => {
		it("should return the value of SESSION_EVENTS_TABLE", () => {
			const envVars = new EnvironmentVariables(logger, ServicesEnum.GOV_NOTIFY_SERVICE);

			const result = envVars.sessionEventsTable();

			expect(result).toBe("SessionEventsTable");
		});
	});

	describe("govukNotifyApi", () => {
		it("should return the value of GOVUKNOTIFY_API", () => {
			const envVars = new EnvironmentVariables(logger, ServicesEnum.GOV_NOTIFY_SERVICE);

			const result = envVars.govukNotifyApiUrl();

			expect(result).toBe("https://test-govnotify-stub");
		});
	});

	describe("kmsKeyArn", () => {
		it("should return the value of KMS_KEY_ARN", () => {
			const envVars = new EnvironmentVariables(logger, ServicesEnum.GOV_NOTIFY_SERVICE);

			const result = envVars.kmsKeyArn();

			expect(result).toBe("key-arn");
		});
	});

	describe("govNotify dynamic email template ID", () => {
		it("should return the value of GOVUKNOTIFY_DYNAMIC_EMAIL_TEMPLATE_ID", () => {
			const envVars = new EnvironmentVariables(logger, ServicesEnum.GOV_NOTIFY_SERVICE);

			const result = envVars.getDynamicEmailTemplateId();

			expect(result).toBe("new-template-id");
		});
	});

	describe("govuk Notify templat ID", () => {
		it("should return the value of GOVUKNOTIFY_TEMPLATE_ID", () => {
			const envVars = new EnvironmentVariables(logger, ServicesEnum.GOV_NOTIFY_SERVICE);

			const result = envVars.getEmailTemplateId();

			expect(result).toBe("old-template-id");
		});
	});

	describe("govUk Notify fallback template ID", () => {
		it("should return the value of GOVUKNOTIFY_FALLBACK_EMAIL_TEMPLATE_ID", () => {
			const envVars = new EnvironmentVariables(logger, ServicesEnum.GOV_NOTIFY_SERVICE);

			const result = envVars.getFallbackEmailTemplateId();

			expect(result).toBe("fallback-template-id");
		});
	});
});
