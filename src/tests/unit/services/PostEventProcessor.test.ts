import { Metrics } from "@aws-lambda-powertools/metrics";
import { Logger } from "@aws-lambda-powertools/logger";
import { PostEventProcessor } from "../../../services/PostEventProcessor";
import { mock } from "jest-mock-extended";
import { IPRService } from "../../../services/IPRService";
import { HttpCodesEnum } from "../../../models/enums/HttpCodesEnum";
import { MessageCodes } from "../../../models/enums/MessageCodes";
import { ReturnSQSEvent } from "../../../models/ReturnSQSEvent";
import { absoluteTimeNow } from "../../../utils/DateTimeUtils";
import { AppError } from "../../../utils/AppError";
import { Constants } from "../../../utils/Constants";
import {
	VALID_AUTH_DELETE_ACCOUNT_TXMA_EVENT_STRING,
	VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT_STRING,
	VALID_F2F_YOTI_START_TXMA_EVENT_STRING,
	VALID_IPV_F2F_CRI_VC_CONSUMED_TXMA_EVENT_STRING,
} from "../../data/sqs-events";

let postEventProcessor: PostEventProcessor;
const mockIprService = mock<IPRService>();
const mockLogger = mock<Logger>();

const metrics = new Metrics({ namespace: "F2F" });

describe("PostEventProcessor", () => {
	beforeAll(() => {
		jest.useFakeTimers();
		const fakeTime = 1684933200.123;
		jest.setSystemTime(new Date(fakeTime * 1000)); // 2023-05-24T13:00:00.123Z

		postEventProcessor = new PostEventProcessor(mockLogger, metrics);
		// @ts-ignore
		postEventProcessor.iprService = mockIprService;
		mockIprService.saveEventData.mockResolvedValueOnce();
	});

	it("Returns success response when call to save event data is successful", async () => {
		const response = await postEventProcessor.processRequest(VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT_STRING);
		expect(response.statusCode).toBe(HttpCodesEnum.CREATED);
		expect(response.eventBody).toBe("OK");
	});

	it("Throws error if user object is missing", async () => {
		const AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_USER_MISSING = {
			event_id: "588f4a66-f75a-4728-9f7b-8afd865c233c",
			client_id: "ekwU",
			clientLandingPageUrl: "REDIRECT_URL",
			event_name: "AUTH_IPV_AUTHORISATION_REQUESTED",
			timestamp: 1681902001,
			timestamp_formatted: "2023-04-19T11:00:01.000Z",
		};
		await expect(postEventProcessor.processRequest(JSON.stringify(AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_USER_MISSING))).rejects.toThrow(
			new AppError(HttpCodesEnum.SERVER_ERROR, "Cannot parse event data"),
		);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockLogger.error).toHaveBeenNthCalledWith(1, { "message": "Missing user details in the incoming SQS event" }, { "messageCode": "MISSING_MANDATORY_FIELDS_IN_SQS_EVENT" });

	});

	it("Throws error if eventName is missing", async () => {
		const AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_NAME_MISSING = {
			event_id: "588f4a66-f75a-4728-9f7b-8afd865c233c",
			client_id: "ekwU",
			clientLandingPageUrl: "REDIRECT_URL",
			timestamp: 1681902001,
			timestamp_formatted: "2023-04-19T11:00:01.000Z",
			user: {
				user_id: "01333e01-dde3-412f-a484-5555",
				email: "jest@test.com",
			},
		};
		await expect(postEventProcessor.processRequest(JSON.stringify(AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_NAME_MISSING))).rejects.toThrow(
			new AppError(HttpCodesEnum.SERVER_ERROR, "Cannot parse event data"),
		);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockLogger.error).toHaveBeenNthCalledWith(1, { "message": "Missing or invalid value for any or all of event name, timestamp in the incoming SQS event" }, { "messageCode": "MISSING_MANDATORY_FIELDS_IN_SQS_EVENT" });
	});

	it("Throws error if eventName is only spaces", async () => {
		const AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_NAME_SPACES = {
			event_id: "588f4a66-f75a-4728-9f7b-8afd865c233c",
			client_id: "ekwU",
			eventName: "  ",
			clientLandingPageUrl: "REDIRECT_URL",
			timestamp: 1681902001,
			timestamp_formatted: "2023-04-19T11:00:01.000Z",
			user: {
				user_id: "01333e01-dde3-412f-a484-5555",
				email: "jest@test.com",
			},
		};
		await expect(postEventProcessor.processRequest(JSON.stringify(AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_NAME_SPACES))).rejects.toThrow(
			new AppError(HttpCodesEnum.SERVER_ERROR, "Cannot parse event data"),
		);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockLogger.error).toHaveBeenNthCalledWith(1, { "message": "Missing or invalid value for any or all of event name, timestamp in the incoming SQS event" }, { "messageCode": "MISSING_MANDATORY_FIELDS_IN_SQS_EVENT" });
	});

	it("Throws error if timestamp is missing", async () => {
		const AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_TIMESTAMP_MISSING = {
			event_id: "588f4a66-f75a-4728-9f7b-8afd865c233c",
			client_id: "ekwU",
			clientLandingPageUrl: "REDIRECT_URL",
			event_name: "AUTH_IPV_AUTHORISATION_REQUESTED",
			timestamp_formatted: "2023-04-19T11:00:01.000Z",
			user: {
				user_id: "01333e01-dde3-412f-a484-5555",
				email: "jest@test.com",
			},
		};
		await expect(postEventProcessor.processRequest(JSON.stringify(AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_TIMESTAMP_MISSING))).rejects.toThrow(
			new AppError(HttpCodesEnum.SERVER_ERROR, "Cannot parse event data"),
		);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockLogger.error).toHaveBeenNthCalledWith(1, { "message":"Missing or invalid value for any or all of event name, timestamp in the incoming SQS event" }, { "messageCode": "MISSING_MANDATORY_FIELDS_IN_SQS_EVENT" });
	});

	describe("AUTH_IPV_AUTHORISATION_REQUESTED event", () => {
		it("Calls saveEventData with appropriate payload for AUTH_IPV_AUTHORISATION_REQUESTED event", async () => {
			await postEventProcessor.processRequest(VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT_STRING);
			const expiresOn = absoluteTimeNow() + Number(process.env.INITIAL_SESSION_RECORD_TTL_SECS!);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(mockIprService.saveEventData).toHaveBeenCalledWith("01333e01-dde3-412f-a484-5555", "SET ipvStartedOn = :ipvStartedOn, userEmail = :userEmail, clientName = :clientName,  redirectUri = :redirectUri, expiresOn = :expiresOn", { ":clientName": "ekwU", ":ipvStartedOn": 1681902001, ":redirectUri": "REDIRECT_URL", ":userEmail": "jest@test.com", ":expiresOn": expiresOn });
		});

		it("Logs a warning if user.email is missing", async () => {
			const AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_MISSING_EMAIL: ReturnSQSEvent = {
				event_id: "588f4a66-f75a-4728-9f7b-8afd865c233c",
				client_id: "ekwU",
				clientLandingPageUrl: "REDIRECT_URL",
				event_name: "AUTH_IPV_AUTHORISATION_REQUESTED",
				timestamp: 1681902001,
				timestamp_formatted: "2023-04-19T11:00:01.000Z",
				user: {
					user_id: "01333e01-dde3-412f-a484-5555",
				},
			};
			const result = await postEventProcessor.processRequest(JSON.stringify(AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_MISSING_EMAIL));
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(mockLogger.warn).toHaveBeenCalledWith({ message: "Missing or invalid value for any or all of userDetails.email, eventDetails.client_id, eventDetails.clientLandingPageUrl fields required for AUTH_IPV_AUTHORISATION_REQUESTED event type" }, { messageCode: MessageCodes.MISSING_MANDATORY_FIELDS });
			expect(result).toBe(`Missing info in sqs ${Constants.AUTH_IPV_AUTHORISATION_REQUESTED} event, it is unlikely that this event was meant for F2F`);
		});

		it("Throws error if clientLandingPageUrl is missing", async () => {
			const AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_MISSING_LANDINGURL: ReturnSQSEvent = {
				event_id: "588f4a66-f75a-4728-9f7b-8afd865c233c",
				client_id: "ekwU",
				event_name: "AUTH_IPV_AUTHORISATION_REQUESTED",
				timestamp: 1681902001,
				timestamp_formatted: "2023-04-19T11:00:01.000Z",
				user: {
					user_id: "01333e01-dde3-412f-a484-5555",
					email: "test@jest.com",
				},
			};
			const result = await postEventProcessor.processRequest(JSON.stringify(AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_MISSING_LANDINGURL));
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(mockLogger.warn).toHaveBeenCalledWith({ message: "Missing or invalid value for any or all of userDetails.email, eventDetails.client_id, eventDetails.clientLandingPageUrl fields required for AUTH_IPV_AUTHORISATION_REQUESTED event type" }, { messageCode: MessageCodes.MISSING_MANDATORY_FIELDS });
			expect(result).toBe(`Missing info in sqs ${Constants.AUTH_IPV_AUTHORISATION_REQUESTED} event, it is unlikely that this event was meant for F2F`);
		});

		it("Throws error if clientLandingPageUrl is only spaces", async () => {
			const AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_URL_SPACES: ReturnSQSEvent = {
				event_id: "588f4a66-f75a-4728-9f7b-8afd865c233c",
				client_id: "ekwU",
				clientLandingPageUrl: "  ",
				event_name: "AUTH_IPV_AUTHORISATION_REQUESTED",
				timestamp: 1681902001,
				timestamp_formatted: "2023-04-19T11:00:01.000Z",
				user: {
					user_id: "01333e01-dde3-412f-a484-5555",
					email: "test@jest.com",
				},
			};
			const result = await postEventProcessor.processRequest(JSON.stringify(AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_URL_SPACES));
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(mockLogger.warn).toHaveBeenCalledWith({ message: "Missing or invalid value for any or all of userDetails.email, eventDetails.client_id, eventDetails.clientLandingPageUrl fields required for AUTH_IPV_AUTHORISATION_REQUESTED event type" }, { messageCode: MessageCodes.MISSING_MANDATORY_FIELDS });
			expect(result).toBe(`Missing info in sqs ${Constants.AUTH_IPV_AUTHORISATION_REQUESTED} event, it is unlikely that this event was meant for F2F`);
		});
	});

	describe("IPV_F2F_CRI_VC_CONSUMED_EVENT event", () => {
		it("Calls saveEventData with appropriate payload for IPV_F2F_CRI_VC_CONSUMED_EVENT event", async () => {
			await postEventProcessor.processRequest(VALID_IPV_F2F_CRI_VC_CONSUMED_TXMA_EVENT_STRING);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(mockIprService.saveEventData).toHaveBeenCalledWith("01333e01-dde3-412f-a484-4444", "SET readyToResumeOn = :readyToResumeOn, nameParts = :nameParts", { ":readyToResumeOn": 1681902001, ":nameParts": [{ "type": "GivenName", "value": "ANGELA" }, { "type": "GivenName", "value": "ZOE" }, { "type":"FamilyName", "value":"UK SPECIMEN" }] });
		});

		it("Throws error if restricted is missing", async () => {
			const IPV_F2F_CRI_VC_CONSUMED_EVENT_INVALID = {
				event_id: "588f4a66-f75a-4728-9f7b-8afd865c233e",
				client_id: "ekwU",
				event_name: "IPV_F2F_CRI_VC_CONSUMED",
				clientLandingPageUrl: "REDIRECT_URL",
				timestamp: 1681902001,
				timestamp_formatted: "2023-04-19T11:00:01.000Z",
				user: {
					user_id: "01333e01-dde3-412f-a484-4444",
					// pragma: allowlist nextline secret
					email: "e914e32172adcdad6c0906f7e5a0f4f43a6e99847c4370df783c7142f71ba454",
				},
			};
			await expect(postEventProcessor.processRequest(JSON.stringify(IPV_F2F_CRI_VC_CONSUMED_EVENT_INVALID))).rejects.toThrow(
				new AppError(HttpCodesEnum.SERVER_ERROR, "Cannot parse event data"),
			);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(mockLogger.error).toHaveBeenNthCalledWith(1, { "message":"Missing nameParts fields required for IPV_F2F_CRI_VC_CONSUMED event type" }, { "messageCode": "MISSING_MANDATORY_FIELDS_IN_SQS_EVENT" });
		});
	});

	it("Calls saveEventData with appropriate payload for F2F_YOTI_START_EVENT event", async () => {
		await postEventProcessor.processRequest(VALID_F2F_YOTI_START_TXMA_EVENT_STRING);
		const expiresOn = absoluteTimeNow() + Number(process.env.SESSION_RETURN_RECORD_TTL_SECS!);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockIprService.saveEventData).toHaveBeenCalledWith("01333e01-dde3-412f-a484-4444", "SET journeyWentAsyncOn = :journeyWentAsyncOn, expiresOn = :expiresOn", { ":journeyWentAsyncOn": 1681902001, ":expiresOn": expiresOn });
	});

	it("Calls saveEventData with appropriate payload for IPV_F2F_CRI_VC_CONSUMED_EVENT event", async () => {
		await postEventProcessor.processRequest(VALID_IPV_F2F_CRI_VC_CONSUMED_TXMA_EVENT_STRING);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockIprService.saveEventData).toHaveBeenCalledWith("01333e01-dde3-412f-a484-4444", "SET readyToResumeOn = :readyToResumeOn, nameParts = :nameParts", { ":readyToResumeOn": 1681902001, ":nameParts": [{ "type": "GivenName", "value": "ANGELA" }, { "type": "GivenName", "value": "ZOE" }, { "type":"FamilyName", "value":"UK SPECIMEN" }] });
	});

	it("Calls saveEventData with appropriate payload for AUTH_DELETE_ACCOUNT_EVENT event", async () => {
		await postEventProcessor.processRequest(VALID_AUTH_DELETE_ACCOUNT_TXMA_EVENT_STRING);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockIprService.saveEventData).toHaveBeenCalledWith("01333e01-dde3-412f-a484-3333", "SET accountDeletedOn = :accountDeletedOn, userEmail = :userEmail, nameParts = :nameParts, clientName = :clientName,  redirectUri = :redirectUri", { ":accountDeletedOn": 1681902001, ":clientName": "", ":nameParts": [], ":redirectUri": "", ":userEmail": "" });
	});
});
