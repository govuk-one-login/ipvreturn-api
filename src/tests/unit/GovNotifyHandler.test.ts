import { mock } from "jest-mock-extended";
import { lambdaHandler } from "../../GovNotifyHandler";
import { SendEmailProcessor } from "../../services/SendEmailProcessor";
import { VALID_GOV_NOTIFY_HANDLER_SQS_EVENT } from "../data/sqs-events";
import { AppError } from "../../utils/AppError";
import { HttpCodesEnum } from "../../models/enums/HttpCodesEnum";
import { EnvironmentVariables } from "../../services/EnvironmentVariables";

const mockedSendEmailRequestProcessor = mock<SendEmailProcessor>();

jest.mock("../../services/SendEmailProcessor", () => {
	return {
		SendEmailProcessor: jest.fn(() => mockedSendEmailRequestProcessor),
	};
});

jest.mock("../../utils/Config", () => {
	return {
		getParameter: jest.fn(() => {return "dgsdgsg";}),
	};
});

jest.mock("../../services/EnvironmentVariables");


describe("GovNotifyHandler", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		process.env.GOVUKNOTIFY_API_KEY_SSM_PATH = "/test/ssm-path";
		process.env.RETURN_JOURNEY_URL = "testReturnJourneyUrl";
		process.env.TXMA_QUEUE_URL = "testQueueUrl";
		process.env.SESSION_EVENTS_TABLE = "testTable";
		process.env.GOVUKNOTIFY_API = "testApi";
		process.env.GOVUKNOTIFY_DYNAMIC_EMAIL_TEMPLATE_ID = "testDynamicTemplateId";
		process.env.GOVUKNOTIFY_TEMPLATE_ID = "testTemplateId";
		process.env.GOVUKNOTIFY_FALLBACK_EMAIL_TEMPLATE_ID = "testFallbackTemplateId";

		(EnvironmentVariables as jest.Mock).mockImplementation(() => ({
			clientIdSsmPath: jest.fn().mockReturnValue("/test/client-id-path"),
			kmsKeyArn: jest.fn().mockReturnValue("test-kms-key-arn"),
			sessionEventsTable: jest.fn().mockReturnValue("test-session-events-table"),
			oidcUrl: jest.fn().mockReturnValue("https://test-oidc-url.com"),
			returnRedirectUrl: jest.fn().mockReturnValue("https://test-return-redirect-url.com"),
			assumeRoleWithWebIdentityArn: jest.fn().mockReturnValue("test-assume-role-arn"),
			oidcJwtAssertionTokenExpiry: jest.fn().mockReturnValue("900"),
			componentId: jest.fn().mockReturnValue("test-component-id"),
		}));
	});

	afterEach(() => {
		delete process.env.GOVUKNOTIFY_API_KEY_SSM_PATH;
		delete process.env.RETURN_JOURNEY_URL;
		delete process.env.TXMA_QUEUE_URL;
		delete process.env.SESSION_EVENTS_TABLE;
		delete process.env.GOVUKNOTIFY_API;
		delete process.env.GOVUKNOTIFY_DYNAMIC_EMAIL_TEMPLATE_ID;
		delete process.env.GOVUKNOTIFY_TEMPLATE_ID;
		delete process.env.GOVUKNOTIFY_FALLBACK_EMAIL_TEMPLATE_ID;
	});

	it("return success response for govNotify", async () => {
		SendEmailProcessor.getInstance = jest.fn().mockReturnValue(mockedSendEmailRequestProcessor);
		await lambdaHandler(VALID_GOV_NOTIFY_HANDLER_SQS_EVENT, "IPR");

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockedSendEmailRequestProcessor.processRequest).toHaveBeenCalledTimes(1);
	});

	it("returns Bad request when number of records in the SQS message is more than 1", async () => {
		const event = { "Records": [] };
		const response = await lambdaHandler(event, "IPR");
		expect(response.batchItemFailures[0].itemIdentifier).toBe("");
	});

	it("errors when email processor throws AppError", async () => {
		SendEmailProcessor.getInstance = jest.fn().mockImplementation(() => {
			throw new AppError(HttpCodesEnum.SERVER_ERROR, "emailSending - failed: got error while sending email.");
		});
		const response = await lambdaHandler(VALID_GOV_NOTIFY_HANDLER_SQS_EVENT, "IPR");
		expect(response.batchItemFailures[0].itemIdentifier).toBe("");
	});
});
