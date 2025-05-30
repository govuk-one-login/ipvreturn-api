import { Metrics, MetricUnits } from "@aws-lambda-powertools/metrics";
import { mock } from "jest-mock-extended";
import { Logger } from "@aws-lambda-powertools/logger";
import { Response } from "../../../utils/Response";
import { HttpCodesEnum } from "../../../utils/HttpCodesEnum";
import {
	MockFailingKmsJwtAdapter,
	MockFailingKmsSigningJwtAdapter,
	MockKmsJwtAdapter,
} from "../utils/MockJwtVerifierSigner";
import { SessionProcessor } from "../../../services/SessionProcessor";
import { IPRServiceSession } from "../../../services/IPRServiceSession";
import { SessionEvent } from "../../../models/SessionEvent";
import { MISSING_AUTH_CODE, VALID_SESSION } from "../data/session-events";
import { SessionEventStatusEnum } from "../../../models/enums/SessionEventStatusEnum";
import axios from "axios";
import { stsClient } from "../../../utils/StsClient";
import { absoluteTimeNow } from "../../../utils/DateTimeUtils";
import { JWTPayload } from "jose";
import { MessageCodes } from "../../../models/enums/MessageCodes";
import * as TxmaEventUtils from "../../../utils/TxmaEvent";

/* eslint @typescript-eslint/unbound-method: 0 */
let sessionProcessorTest: SessionProcessor;
const mockIprService = mock<IPRServiceSession>();
let mockSessionEvent: SessionEvent;
const MOCK_ISSUER = "mock-issuer";
const validPayload = {
	iss: "issuer",
	sub: "userId",
	aud: "oidc-client-id",
	exp: absoluteTimeNow() + 1000,
	iat: absoluteTimeNow(),
	nonce: "nonce",
};
const wrongPayload : JWTPayload = {
	iss: "issuer",
	sub: "userId",
	aud: "wrong_id",
	exp: absoluteTimeNow() + 1000,
	iat: absoluteTimeNow(),
	nonce: "nonce",
};
const passingKmsJwtAdapterFactory = () => new MockKmsJwtAdapter(true, validPayload);
const failingKmsJwtAdapterFactory = () => new MockKmsJwtAdapter(false, validPayload);
const failingKmsJwtSigningAdapterFactory = () => new MockFailingKmsSigningJwtAdapter();
const failingKmsJwtDecodeAdapterFactory = () => new MockFailingKmsJwtAdapter();

const logger = mock<Logger>();
const metrics = mock<Metrics>();
jest.mock("axios");
const mockStsClient = jest.mocked(stsClient);
const validRequest = VALID_SESSION;
const CLIENT_ID = "oidc-client-id";
jest.spyOn(TxmaEventUtils, "buildCoreEventFields");

function getMockSessionEventItem(): SessionEvent {
	const sess: SessionEvent = {
		userId: "userId",
		clientName: "ipv",
		clientSessionId: "sdfssg",
		userEmail: "testuser@test.gov.uk",
		notified: true,
		ipvStartedOn: 1681902001,
		journeyWentAsyncOn: 1681902002,
		readyToResumeOn: 1681902003,
		redirectUri: "http://redirect.url",
		nameParts: [
			{
				type: "GivenName",
				value: "ANGELA",
			},
			{
				type: "GivenName",
				value: "ZOE",
			},
			{
				type: "FamilyName",
				value: "UK SPECIMEN",
			},
		],
	};
	return sess;
}

describe("SessionProcessor", () => {
	beforeEach(() => {
		jest.clearAllMocks();

		process.env.KMS_KEY_ARN = "mock-kms-key-arn";
		process.env.OIDC_URL = "https://mock-oidc-url.com";
		process.env.OIDC_JWT_ASSERTION_TOKEN_EXP = "900";
		process.env.ASSUMEROLE_WITH_WEB_IDENTITY_ARN = "mock-assume-role-arn";
		process.env.SESSION_EVENTS_TABLE = "mock-session-events-table";
		process.env.RETURN_REDIRECT_URL = "https://mock-redirect-url.com";
		process.env.ISSUER = MOCK_ISSUER;

		mockSessionEvent = getMockSessionEventItem();
		sessionProcessorTest = new SessionProcessor(logger, metrics, CLIENT_ID);

		// @ts-expect-error private access manipulation used for testing
		sessionProcessorTest.kmsJwtAdapter = passingKmsJwtAdapterFactory();
		mockSessionEvent = getMockSessionEventItem();
		const oidcConfig = { data:{ issuer: "issuer", jwks_uri: "jwks_url" } };
		// @ts-expect-error private access manipulation used for testing
		axios.get.mockResolvedValueOnce(oidcConfig);
		const credential = {
			AccessKeyId: "AccessKeyId",
			SecAccessKey: "SecAccessKey",
			SessionToken: "SessionToken",
		};
		IPRServiceSession.getInstance = jest.fn().mockReturnValue(mockIprService);
		const mockGetCredentials = jest.fn().mockReturnValue({ Credentials: credential });
		mockStsClient.assumeRoleWithWebIdentity = mockGetCredentials;
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("Return 401 when auth_code is missing in the request", async () => {
		const out: Response = await sessionProcessorTest.processRequest(MISSING_AUTH_CODE);
		expect(out.body).toBe("Missing authCode to generate id_token");
		expect(out.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				messageCode: MessageCodes.MISSING_CONFIGURATION,
			}),
		);
		expect(metrics.addMetric).not.toHaveBeenNthCalledWith(1, "User_redirected_from_IPR", MetricUnits.Count, 1);
	});

	it("Return 500 ServerError when an error occurred while retrieving id_token from OIDC endpoint", async () => {
		// @ts-expect-error writing resolved promise
		axios.post.mockRejectedValueOnce(new Error("error"));
		const out: Response = await sessionProcessorTest.processRequest(validRequest);

		expect(out.body).toBe("An error occurred when fetching OIDC token response");
		expect(out.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				messageCode: MessageCodes.UNEXPECTED_ERROR_FETCHING_OIDC_TOKEN,
			}),
		);
		expect(metrics.addMetric).not.toHaveBeenNthCalledWith(1, "User_redirected_from_IPR", MetricUnits.Count, 1);
	});

	it("Return 500 ServerError when failed to decode the id_token jwt", async () => {
		// @ts-expect-error writing resolved promise
		axios.post.mockResolvedValueOnce({ data:{ id_token: "id_token_jwt" } });
		// @ts-expect-error private access manipulation used for testing
		sessionProcessorTest.kmsJwtAdapter = failingKmsJwtDecodeAdapterFactory();
		const out: Response = await sessionProcessorTest.processRequest(validRequest);

		expect(out.body).toBe("Invalid request: Rejected jwt");
		expect(out.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				messageCode: MessageCodes.FAILED_DECODING_JWT,
			}),
		);
		expect(metrics.addMetric).not.toHaveBeenNthCalledWith(1, "User_redirected_from_IPR", MetricUnits.Count, 1);
	});

	it("Return 500 ServerError when failed to sign the client_assertion_jwt", async () => {
		// @ts-expect-error private access manipulation used for testing
		sessionProcessorTest.kmsJwtAdapter = failingKmsJwtSigningAdapterFactory();
		const out: Response = await sessionProcessorTest.processRequest(validRequest);

		expect(out.body).toBe("Failed to sign the client_assertion Jwt");
		expect(out.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				messageCode: MessageCodes.ERROR_SIGNING_JWT,
			}),
		);
		expect(metrics.addMetric).not.toHaveBeenNthCalledWith(1, "User_redirected_from_IPR", MetricUnits.Count, 1);
	});

	it("Return 401 when verification of id_token fails", async () => {
		// @ts-expect-error writing resolved promise
		axios.post.mockResolvedValueOnce({ data:{ id_token: "id_token_jwt" } });
		// @ts-expect-error private access manipulation used for testing
		sessionProcessorTest.kmsJwtAdapter = failingKmsJwtAdapterFactory();
		const out: Response = await sessionProcessorTest.processRequest(validRequest);

		expect(out.body).toBe("JWT verification failed");
		expect(out.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				messageCode: MessageCodes.FAILED_VERIFYING_JWT,
			}),
		);
		expect(metrics.addMetric).not.toHaveBeenNthCalledWith(1, "User_redirected_from_IPR", MetricUnits.Count, 1);
	});

	it.each([
		"iss",
		"aud",
		"sub",
		"exp",
		"iat",
	])("Return 401 when verification of jwt claims fails", async (claim) => {
		// @ts-expect-error writing resolved promise
		axios.post.mockResolvedValueOnce({ data:{ id_token: "id_token_jwt" } });
		wrongPayload[claim] = "";
		// @ts-expect-error private access manipulation used for testing
		sessionProcessorTest.kmsJwtAdapter = new MockKmsJwtAdapter(true, wrongPayload);
		const out: Response = await sessionProcessorTest.processRequest(validRequest);

		expect(out.body).toBe("JWT validation/verification failed");
		expect(out.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				messageCode: MessageCodes.FAILED_VALIDATING_JWT,
			}),
		);
		expect(metrics.addMetric).not.toHaveBeenNthCalledWith(1, "User_redirected_from_IPR", MetricUnits.Count, 1);
	});

	it("Return 401 Unauthorized error when session event not found for a given userId", async () => {
		// @ts-expect-error writing resolved promise
		axios.post.mockResolvedValueOnce({ data:{ id_token: "id_token_jwt" } });
		// @ts-expect-error writing resolved promise
		mockIprService.getSessionBySub.mockReturnValue(null);
		const out: Response = await sessionProcessorTest.processRequest(validRequest);

		expect(mockIprService.getSessionBySub).toHaveBeenCalledTimes(1);
		expect(out.body).toBe("No session event found for this userId");
		expect(out.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				messageCode: MessageCodes.SESSION_NOT_FOUND,
			}),
		);
		expect(metrics.addMetric).not.toHaveBeenNthCalledWith(1, "User_redirected_from_IPR", MetricUnits.Count, 1);
	});

	it("Return successful response with 200 OK when session event data was retrieved and returns redirect_uri", async () => {
		// @ts-expect-error writing resolved promise
		axios.post.mockResolvedValueOnce({ data:{ id_token: "id_token_jwt" } });
		// @ts-expect-error writing resolved promise
		mockIprService.getSessionBySub.mockReturnValue(mockSessionEvent);
		const out: Response = await sessionProcessorTest.processRequest(validRequest);

		expect(mockIprService.getSessionBySub).toHaveBeenCalledTimes(1);

		expect(out.body).toEqual(JSON.stringify({
			status: SessionEventStatusEnum.COMPLETED,
			redirect_uri: mockSessionEvent.redirectUri,
		}));
		expect(out.statusCode).toBe(HttpCodesEnum.OK);
		expect(metrics.addMetric).toHaveBeenNthCalledWith(1, "User_redirected_from_IPR", MetricUnits.Count, 1);
	});

	describe("should send correct TXMA event", () => {
		beforeEach(() => {
			jest.useFakeTimers();
			jest.setSystemTime(new Date(1585695600000)); // == 2020-03-31T23:00:00.000
		});

		it("ip_address is X_FORWARDED_FOR if header is present", async () => {
			// @ts-expect-error writing resolved promise
			axios.post.mockResolvedValueOnce({ data:{ id_token: "id_token_jwt" } });
			// @ts-expect-error writing resolved promise
			mockIprService.getSessionBySub.mockReturnValue(mockSessionEvent);
			// @ts-expect-error private access manipulation used for testing
			jest.spyOn(sessionProcessorTest.validationHelper, "isJwtValid").mockReturnValue("");
			const validSession = JSON.parse(JSON.stringify(VALID_SESSION));
			await sessionProcessorTest.processRequest(validSession);

			expect(mockIprService.sendToTXMA).toHaveBeenCalledWith(
				{
					"event_name": "IPR_USER_REDIRECTED",
					"event_timestamp_ms": 1585695600000,
					"component_id": MOCK_ISSUER,
					"extensions": { "previous_govuk_signin_journey_id": "sdfssg" },
					"timestamp": 1585695600,
					"user": { "ip_address": "1.1.1", "user_id": "userId" },
				},
				"ABCDEFG",
			);
			expect(metrics.addMetric).toHaveBeenNthCalledWith(1, "User_redirected_from_IPR", MetricUnits.Count, 1);
		});

		it("ip_address is source IP if no X_FORWARDED_FOR header is present", async () => {
			// @ts-expect-error writing resolved promise
			axios.post.mockResolvedValueOnce({ data:{ id_token: "id_token_jwt" } });
			// @ts-expect-error writing resolved promise
			mockIprService.getSessionBySub.mockReturnValue(mockSessionEvent);
			// @ts-expect-error private access manipulation used for testing
			jest.spyOn(sessionProcessorTest.validationHelper, "isJwtValid").mockReturnValue("");
			const missingXForwardedFor = { ...VALID_SESSION, headers: { "txma-audit-encoded": "ABCDEFG" }, requestContext: { identity: { sourceIp: "2.2.2" } } };
			const missingXForwardedForSession = JSON.parse(JSON.stringify(missingXForwardedFor));

			await sessionProcessorTest.processRequest(missingXForwardedForSession);

			expect(mockIprService.sendToTXMA).toHaveBeenCalledWith(
				{
					"event_name": "IPR_USER_REDIRECTED",
					"event_timestamp_ms": 1585695600000,
					"component_id": MOCK_ISSUER,
					"extensions": { "previous_govuk_signin_journey_id": "sdfssg" },
					"timestamp": 1585695600,
					"user": { "ip_address": "2.2.2", "user_id": "userId" },
				},
				"ABCDEFG",
			);
			expect(metrics.addMetric).toHaveBeenNthCalledWith(1, "User_redirected_from_IPR", MetricUnits.Count, 1);
		});

		it("when no headers are included defaults are used", async () => {
			// @ts-expect-error writing resolved promise
			axios.post.mockResolvedValueOnce({ data:{ id_token: "id_token_jwt" } });
			// @ts-expect-error writing resolved promise
			mockIprService.getSessionBySub.mockReturnValue(mockSessionEvent);
			// @ts-expect-error private access manipulation used for testing
			jest.spyOn(sessionProcessorTest.validationHelper, "isJwtValid").mockReturnValue("");
			const sessionWithOutHeaders = JSON.parse(JSON.stringify(VALID_SESSION));
			delete sessionWithOutHeaders.headers;
			console.log("result", await sessionProcessorTest.processRequest(sessionWithOutHeaders));
			expect(mockIprService.sendToTXMA).toHaveBeenCalledWith(
				{
					"event_name": "IPR_USER_REDIRECTED",
					"event_timestamp_ms": 1585695600000,
					"component_id": MOCK_ISSUER,
					"extensions": { "previous_govuk_signin_journey_id": "sdfssg" },
					"timestamp": 1585695600,
					"user": { "ip_address": "", "user_id": "userId" },
				},
				undefined,
			);
			expect(metrics.addMetric).toHaveBeenNthCalledWith(1, "User_redirected_from_IPR", MetricUnits.Count, 1);
		});
	});

	it.each([
		"journeyWentAsyncOn",
		"ipvStartedOn",
		"readyToResumeOn",
	])("Throws 200 OK status with pending status when session event record is missing necessary Event timestamps fields", async (attribute) => {
		// @ts-expect-error writing resolved promise
		axios.post.mockResolvedValueOnce({ data:{ id_token: "id_token_jwt" } });
		// @ts-expect-error private access manipulation used for testing
		delete mockSessionEvent[attribute];
		// @ts-expect-error writing resolved promise
		mockIprService.getSessionBySub.mockReturnValue(mockSessionEvent);
		const out: Response = await sessionProcessorTest.processRequest(validRequest);

		expect(mockIprService.getSessionBySub).toHaveBeenCalledTimes(1);
		expect(out.body).toEqual(JSON.stringify({
			status: SessionEventStatusEnum.PENDING,
			message: `${attribute} is not yet populated, unable to process the DB record.`,
		}));
		expect(out.statusCode).toBe(HttpCodesEnum.OK);
		expect(metrics.addMetric).not.toHaveBeenNthCalledWith(1, "User_redirected_from_IPR", MetricUnits.Count, 1);
		expect(metrics.addMetric).toHaveBeenNthCalledWith(1, "User_entered_IPR_in_incorrect_state", MetricUnits.Count, 1);
	});

	it("Throws 401 Unauthorized error when User is not yet notified", async () => {
		// @ts-expect-error writing resolved promise
		axios.post.mockResolvedValueOnce({ data:{ id_token: "id_token_jwt" } });
		mockSessionEvent.notified = false;
		// @ts-expect-error writing resolved promise
		mockIprService.getSessionBySub.mockReturnValue(mockSessionEvent);
		const out: Response = await sessionProcessorTest.processRequest(validRequest);

		expect(mockIprService.getSessionBySub).toHaveBeenCalledTimes(1);
		expect(out.body).toBe("User is not yet notified for this session event.");
		expect(out.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				messageCode: MessageCodes.USER_NOT_NOTIFIED,
			}),
		);
		expect(metrics.addMetric).not.toHaveBeenNthCalledWith(1, "User_redirected_from_IPR", MetricUnits.Count, 1);
	});
});
