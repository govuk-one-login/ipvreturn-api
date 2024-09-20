import { lambdaHandler } from "../../SessionHandler";
import { VALID_SESSION, INVALID_SESSION } from "./data/session-events";
import { SessionProcessor } from "../../services/SessionProcessor";
import { mock } from "jest-mock-extended";
import { EnvironmentVariables } from "../../services/EnvironmentVariables";

const mockedSessionProcessor = mock<SessionProcessor>();
jest.mock("../../utils/Config", () => {
	return {
		getParameter: jest.fn(() => {return "client-id";}),
	};
});
jest.mock("../../services/EnvironmentVariables");

describe("SessionHandler", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		process.env.COMPONENT_ID = "test-component-id";
		process.env.CLIENT_ID_SSM_PATH = "/test/client-id-path";
		process.env.KMS_KEY_ARN = "test-kms-key-arn";
		process.env.SESSION_EVENTS_TABLE = "test-session-events-table";
		process.env.OIDC_URL = "https://test-oidc-url.com";
		process.env.RETURN_REDIRECT_URL = "https://test-return-redirect-url.com";
		process.env.ASSUMEROLE_WITH_WEB_IDENTITY_ARN = "test-assume-role-arn";
		process.env.TXMA_QUEUE_URL = "https://test-txma-queue-url.com";
		process.env.OIDC_JWT_ASSERTION_TOKEN_EXP = "900";

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
		delete process.env.COMPONENT_ID;
		delete process.env.CLIENT_ID_SSM_PATH;
		delete process.env.KMS_KEY_ARN;
		delete process.env.SESSION_EVENTS_TABLE;
		delete process.env.OIDC_URL;
		delete process.env.RETURN_REDIRECT_URL;
		delete process.env.ASSUMEROLE_WITH_WEB_IDENTITY_ARN;
		delete process.env.TXMA_QUEUE_URL;
		delete process.env.OIDC_JWT_ASSERTION_TOKEN_EXP;
	});


	it("returns an not found response for an invalid resource request", async () => {
		const response = await lambdaHandler(INVALID_SESSION, "IPR");
		expect(response.statusCode).toBe(404);
		expect(response.body).toBe("Resource not found");
	});

	it("returns success response for a valid request payload", async () => {
		SessionProcessor.getInstance = jest.fn().mockReturnValue(mockedSessionProcessor);
		mockedSessionProcessor.processRequest.mockResolvedValue({ statusCode: 200, body: JSON.stringify({ message: "Success" }) });
		const response = await lambdaHandler(VALID_SESSION, "IPR");

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockedSessionProcessor.processRequest).toHaveBeenCalledTimes(1);
		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toEqual({ message: "Success" });
	});
});
