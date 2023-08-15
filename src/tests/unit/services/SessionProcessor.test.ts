import { Metrics } from "@aws-lambda-powertools/metrics";
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
import { IPRService } from "../../../services/IPRService";
import { SessionEvent } from "../../../models/SessionEvent";
import { MISSING_AUTH_CODE, VALID_SESSION } from "../data/session-events";
import { SessionEventStatusEnum } from "../../../models/enums/SessionEventStatusEnum";
import axios from "axios";
import { stsClient } from "../../../utils/StsClient";
import { absoluteTimeNow } from "../../../utils/DateTimeUtils";
import { JWTPayload } from "jose";
import { MessageCodes } from "../../../models/enums/MessageCodes";
/* eslint @typescript-eslint/unbound-method: 0 */
/* eslint jest/unbound-method: error */
let sessionProcessorTest: SessionProcessor;
const mockIprService = mock<IPRService>();
let mockSessionEvent: SessionEvent;
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
const passingKmsJwtAdapterFactory = (_signingKeys: string) => new MockKmsJwtAdapter(true, validPayload);
const failingKmsJwtAdapterFactory = (_signingKeys: string) => new MockKmsJwtAdapter(false, validPayload);
const failingKmsJwtSigningAdapterFactory = (_signingKeys: string) => new MockFailingKmsSigningJwtAdapter();
const failingKmsJwtDecodeAdapterFactory = (_signingKeys: string) => new MockFailingKmsJwtAdapter();

const logger = mock<Logger>();
const metrics = new Metrics({ namespace: "CIC" });
jest.mock("axios");
const mockStsClient = jest.mocked(stsClient);
const validRequest = VALID_SESSION;
const CLIENT_ID = "oidc-client-id";

function getMockSessionEventItem(): SessionEvent {
	const sess: SessionEvent = {
		userId: "userId",
		clientName: "ipv",
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
	beforeAll(() => {
		mockSessionEvent = getMockSessionEventItem();
		sessionProcessorTest = new SessionProcessor(logger, metrics, CLIENT_ID);
	});

	beforeEach(() => {
		jest.clearAllMocks();
		// @ts-ignore
		sessionProcessorTest.kmsJwtAdapter = passingKmsJwtAdapterFactory();
		mockSessionEvent = getMockSessionEventItem();
		const oidcConfig = { data:{ issuer: "issuer", jwks_uri: "jwks_url" } };
		// @ts-ignore
		axios.get.mockResolvedValueOnce(oidcConfig);
		const credential = {
			AccessKeyId: "AccessKeyId",
			SecAccessKey: "SecAccessKey",
			SessionToken: "SessionToken",
		};
		IPRService.getInstance = jest.fn().mockReturnValue(mockIprService);
		const mockGetCredentials = jest.fn().mockReturnValue({ Credentials: credential });
		mockStsClient.assumeRoleWithWebIdentity = mockGetCredentials;
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
	});

	it("Return 500 ServerError when an error occurred while retrieving id_token from OIDC endpoint", async () => {
		// @ts-ignore
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
	});

	it("Return 500 ServerError when failed to decode the id_token jwt", async () => {
		// @ts-ignore
		axios.post.mockResolvedValueOnce({ data:{ id_token: "id_token_jwt" } });
		// @ts-ignore
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
	});

	it("Return 500 ServerError when failed to sign the client_assertion_jwt", async () => {
		// @ts-ignore
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
	});

	it("Return 401 when verification of id_token fails", async () => {
		// @ts-ignore
		axios.post.mockResolvedValueOnce({ data:{ id_token: "id_token_jwt" } });
		// @ts-ignore
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
	});

	it.each([
		"iss",
		"aud",
		"sub",
		"exp",
		"iat",
	])("Return 401 when verification of jwt claims fails", async (claim) => {
		// @ts-ignore
		axios.post.mockResolvedValueOnce({ data:{ id_token: "id_token_jwt" } });
		wrongPayload[claim] = "";
		// @ts-ignore
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
	});

	it("Return 401 Unauthorized error when session event not found for a given userId", async () => {
		// @ts-ignore
		axios.post.mockResolvedValueOnce({ data:{ id_token: "id_token_jwt" } });
		// @ts-ignore
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
	});

	it("Return successful response with 200 OK when session event data was retrieved and returns redirect_uri", async () => {
		// @ts-ignore
		axios.post.mockResolvedValueOnce({ data:{ id_token: "id_token_jwt" } });
		// @ts-ignore
		mockIprService.getSessionBySub.mockReturnValue(mockSessionEvent);
		const out: Response = await sessionProcessorTest.processRequest(validRequest);

		expect(mockIprService.getSessionBySub).toHaveBeenCalledTimes(1);

		expect(out.body).toEqual(JSON.stringify({
			status: SessionEventStatusEnum.COMPLETED,
			redirect_uri: mockSessionEvent.redirectUri,
		}));
		expect(out.statusCode).toBe(HttpCodesEnum.OK);
	});

	it.each([
		"journeyWentAsyncOn",
		"ipvStartedOn",
		"readyToResumeOn",
	])("Throws 200 OK status with pending status when session event record is missing necessary Event timestamps fields", async (attribute) => {
		// @ts-ignore
		axios.post.mockResolvedValueOnce({ data:{ id_token: "id_token_jwt" } });
		// @ts-ignore
		delete mockSessionEvent[attribute];
		// @ts-ignore
		mockIprService.getSessionBySub.mockReturnValue(mockSessionEvent);
		const out: Response = await sessionProcessorTest.processRequest(validRequest);

		expect(mockIprService.getSessionBySub).toHaveBeenCalledTimes(1);
		expect(out.body).toEqual(JSON.stringify({
			status: SessionEventStatusEnum.PENDING,
			message: `${attribute} is not yet populated, unable to process the DB record.`,
		}));
		expect(out.statusCode).toBe(HttpCodesEnum.OK);
	});

	it("Throws 401 Unauthorized error when User is not yet notified", async () => {
		// @ts-ignore
		axios.post.mockResolvedValueOnce({ data:{ id_token: "id_token_jwt" } });
		// @ts-ignore
		mockSessionEvent.notified = false;
		// @ts-ignore
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
	});
});
