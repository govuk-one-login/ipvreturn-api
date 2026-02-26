import { Metrics } from "@aws-lambda-powertools/metrics";
import { Logger } from "@aws-lambda-powertools/logger";
import { createDynamoDbClient } from "../../../utils/DynamoDBFactory";
import { PostEventProcessor } from "../../../services/PostEventProcessor";
import { mock } from "jest-mock-extended";
import { IPRServiceSession } from "../../../services/IPRServiceSession";
import { IPRServiceAuth } from "../../../services/IPRServiceAuth";
import { HttpCodesEnum } from "../../../models/enums/HttpCodesEnum";
import { MessageCodes } from "../../../models/enums/MessageCodes";
import { ReturnSQSEvent } from "../../../models/ReturnSQSEvent";
import { absoluteTimeNow } from "../../../utils/DateTimeUtils";
import { AppError } from "../../../utils/AppError";
import { Constants } from "../../../utils/Constants";
import {
	VALID_IPV_F2F_RESTART_TXMA_EVENT_STRING,
	VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT_STRING,
	VALID_F2F_DOCUMENT_UPLOADED_TXMA_EVENT,
	VALID_F2F_YOTI_START_TXMA_EVENT_STRING, VALID_F2F_YOTI_START_WITH_PO_DOC_DETAILS_TXMA_EVENT,
	VALID_IPV_F2F_CRI_VC_CONSUMED_TXMA_EVENT_STRING,
	VALID_IPV_F2F_CRI_VC_CONSUMED_WITH_DOC_EXPIRYDATE_TXMA_EVENT_STRING,
	VALID_IPV_F2F_CRI_VC_ERROR_TXMA_EVENT_STRING,
	VALID_F2F_YOTI_START_TXMA_EVENT,
} from "../../data/sqs-events";
import { constants } from "../../api/utils/ApiConstants";

let postEventProcessorMockSessionService: PostEventProcessor;
let postEventProcessorMockServices: PostEventProcessor;
let iprServiceAuth: IPRServiceAuth;
const tableName = "MYTABLE";
const mockDynamoDbClient = jest.mocked(createDynamoDbClient());
const mockIprServiceSession = mock<IPRServiceSession>();
const mockIprServiceAuth = mock<IPRServiceAuth>();
const mockLogger = mock<Logger>();

const metrics = new Metrics({ namespace: "F2F" });

describe("PostEventProcessor", () => {
	beforeAll(() => {
		jest.useFakeTimers();
		const fakeTime = 1684933200.123;
		jest.setSystemTime(new Date(fakeTime * 1000)); // 2023-05-24T13:00:00.123Z
		iprServiceAuth = new IPRServiceAuth(tableName, mockLogger, mockDynamoDbClient);
		postEventProcessorMockSessionService = new PostEventProcessor(mockLogger, metrics);
		postEventProcessorMockServices = new PostEventProcessor(mockLogger, metrics);
		// @ts-expect-error private access manipulation used for testing
		postEventProcessorMockServices.iprServiceSession = mockIprServiceSession;
		// @ts-expect-error private access manipulation used for testing
		postEventProcessorMockServices.iprServiceAuth = mockIprServiceAuth;
		// @ts-expect-error private access manipulation used for testing
		postEventProcessorMockSessionService.iprServiceSession = mockIprServiceSession;
		// @ts-expect-error private access manipulation used for testing
		postEventProcessorMockSessionService.iprServiceAuth = iprServiceAuth;
		mockIprServiceSession.saveEventData.mockResolvedValue();
		mockIprServiceAuth.saveEventData.mockResolvedValue();
		mockIprServiceSession.obfuscateJSONValues.mockResolvedValue({ "event_name":"IPR_RESULT_NOTIFICATION_EMAILED", "user":{ "user_id":"***" }, "timestamp":"***" });
	});

	beforeEach(() => {
		jest.resetAllMocks();
	});

	it("Returns success response when call to save event data is successful", async () => {
		const response = await postEventProcessorMockServices.processRequest(VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT_STRING);
		expect(response.statusCode).toBe(HttpCodesEnum.CREATED);
		expect(response.eventBody).toBe("OK");
	});

	it("Early exits if event is already processed", async () => {
		process.env.REDRIVE_ENABLED="false";
		mockIprServiceSession.isFlaggedForDeletionOrEventAlreadyProcessed.mockResolvedValue(true);
		const response = await postEventProcessorMockServices.processRequest(VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT_STRING);
		expect(response).toBe("Record flagged for deletion or event already processed, skipping update");
		process.env.REDRIVE_ENABLED=undefined;
	});

	it("Does not early exits if event is already processed if redrive enabled", async () => {
		process.env.REDRIVE_ENABLED="true";
		mockIprServiceSession.isFlaggedForDeletionOrEventAlreadyProcessed.mockResolvedValue(true);
		const response = await postEventProcessorMockServices.processRequest(VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT_STRING);
		expect(response.statusCode).toBe(HttpCodesEnum.CREATED);
		expect(response.eventBody).toBe("OK");
		process.env.REDRIVE_ENABLED=undefined;
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
		await expect(postEventProcessorMockSessionService.processRequest(JSON.stringify(AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_USER_MISSING))).rejects.toThrow(
			new AppError(HttpCodesEnum.SERVER_ERROR, "Cannot parse event data"),
		);
		 
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
				user_id: "01333e01-dde3-412f-a484-4444",
				email: "jest@test.com",
			},
		};
		await expect(postEventProcessorMockSessionService.processRequest(JSON.stringify(AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_NAME_MISSING))).rejects.toThrow(
			new AppError(HttpCodesEnum.SERVER_ERROR, "Cannot parse event data"),
		);
		 
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
				user_id: "01333e01-dde3-412f-a484-4444",
				email: "jest@test.com",
			},
		};
		await expect(postEventProcessorMockSessionService.processRequest(JSON.stringify(AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_NAME_SPACES))).rejects.toThrow(
			new AppError(HttpCodesEnum.SERVER_ERROR, "Cannot parse event data"),
		);
		 
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
				user_id: "01333e01-dde3-412f-a484-4444",
				email: "jest@test.com",
			},
		};
		await expect(postEventProcessorMockSessionService.processRequest(JSON.stringify(AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_TIMESTAMP_MISSING))).rejects.toThrow(
			new AppError(HttpCodesEnum.SERVER_ERROR, "Cannot parse event data"),
		);
		 
		expect(mockLogger.error).toHaveBeenNthCalledWith(1, { "message":"Missing or invalid value for any or all of event name, timestamp in the incoming SQS event" }, { "messageCode": "MISSING_MANDATORY_FIELDS_IN_SQS_EVENT" });
	});

	describe("AUTH_IPV_AUTHORISATION_REQUESTED event", () => {
		it("Calls saveEventData with appropriate payload for AUTH_IPV_AUTHORISATION_REQUESTED event", async () => {
			await postEventProcessorMockServices.processRequest(VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT_STRING);
			const expiresOn = absoluteTimeNow() + Number(process.env.AUTH_EVENT_TTL_SECS!);
			 
			expect(mockIprServiceAuth.saveEventData).toHaveBeenCalledWith("01333e01-dde3-412f-a484-4444", "SET ipvStartedOn = :ipvStartedOn, userEmail = :userEmail, clientName = :clientName,  redirectUri = :redirectUri, expiresOn = :expiresOn", { ":clientName": "ekwU", ":ipvStartedOn": 1681902001, ":redirectUri": "REDIRECT_URL", ":userEmail": constants.API_TEST_EMAIL_ADDRESS, ":expiresOn": expiresOn });
		});

		it("Logs a warning if user.email is missing", async () => {
			const AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_MISSING_EMAIL: ReturnSQSEvent = {
				event_id: "588f4a66-f75a-4728-9f7b-8afd865c233c",
				client_id: "ekwU",
				clientLandingPageUrl: "REDIRECT_URL",
				event_name: "AUTH_IPV_AUTHORISATION_REQUESTED",
				timestamp: 1681902001,
				event_timestamp_ms: 1681902001713,
				timestamp_formatted: "2023-04-19T11:00:01.000Z",
				user: {
					user_id: "01333e01-dde3-412f-a484-4444",
				},
			};
			const result = await postEventProcessorMockServices.processRequest(JSON.stringify(AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_MISSING_EMAIL));
			 
			expect(mockLogger.warn).toHaveBeenCalledWith({ message: "Missing or invalid value for any or all of userDetails.email, eventDetails.client_id fields required for AUTH_IPV_AUTHORISATION_REQUESTED event type" }, { messageCode: MessageCodes.MISSING_MANDATORY_FIELDS });
			expect(result).toBe(`Missing info in sqs ${Constants.AUTH_IPV_AUTHORISATION_REQUESTED} event, it is unlikely that this event was meant for F2F`);
		});

		it("Adds redirectUri from client id if clientLandingPageUrl is missing", async () => {
			const AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_MISSING_LANDINGURL: ReturnSQSEvent = {
				event_id: "588f4a66-f75a-4728-9f7b-8afd865c233c",
				client_id: "ekwU",
				event_name: "AUTH_IPV_AUTHORISATION_REQUESTED",
				timestamp: 1681902001,
				event_timestamp_ms: 1681902001713,
				timestamp_formatted: "2023-04-19T11:00:01.000Z",
				user: {
					user_id: "01333e01-dde3-412f-a484-4444",
					email: "test@jest.com",
				}
			};
			await postEventProcessorMockServices.processRequest(JSON.stringify(AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_MISSING_LANDINGURL));
			expect(mockIprServiceAuth.saveEventData).toHaveBeenCalledWith("01333e01-dde3-412f-a484-4444", "SET ipvStartedOn = :ipvStartedOn, userEmail = :userEmail, clientName = :clientName,  redirectUri = :redirectUri, expiresOn = :expiresOn", { 
				":userEmail": "test@jest.com",
				":ipvStartedOn": 1681902001,
				":clientName": "ekwU",
				":redirectUri": "https://home.account.gov.uk/your-services",
				":expiresOn": absoluteTimeNow() + Number(process.env.AUTH_EVENT_TTL_SECS),
			});
		});

		it.each([
			["HPAUPxK87FyljocDdQxijxdti08", "https://www.gov.uk/driver-vehicles-account"],
			["Hp9xO0Wda9EcI_2IO8OGeYJyrT0", ""],
			["RqFZ83csmS4Mi4Y7s7ohD9-ekwU", ""],
			["zFeCxrwpLCUHFm-C4_CztwWtLfQ", ""],
			["VsAkrtMBzAosSveAv4xsuUDyiSs", ""],
			["kvGpTatgWm3YqXHbG41eOdDf91k", ""],
			["Gk-D7WMvytB44Nze7oEC5KcThQZ4yl7sAA", ""],
			["XwwVDyl5oJKtK0DVsuw3sICWkPU", ""],
			["iJNgycwBNEWGQvkuiLxOdVmVzG9", "https://www.gov.uk/browse/driving/disability-health-condition"],
			["LUIZbIuJ_xVZxwhkNAApcO4O_6o", ""],
			["IJ_TuVEgIqAWT2mCe9b5uocMyNs", ""],
		])("Adds specific redirectUri from client id if clientLandingPageUrl is missing and client is known", async (clientId, clientLandingPageUrl ) => {
			const AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_MISSING_LANDINGURL: ReturnSQSEvent = {
				event_id: "588f4a66-f75a-4728-9f7b-8afd865c233c",
				client_id: clientId,
				event_name: "AUTH_IPV_AUTHORISATION_REQUESTED",
				timestamp: 1681902001,
				event_timestamp_ms: 1681902001713,
				timestamp_formatted: "2023-04-19T11:00:01.000Z",
				user: {
					user_id: "01333e01-dde3-412f-a484-4444",
					email: "test@jest.com",
				}
			};

			if (clientLandingPageUrl === "") {
				clientLandingPageUrl = "https://home.account.gov.uk/your-services";
			}

			await postEventProcessorMockServices.processRequest(JSON.stringify(AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_MISSING_LANDINGURL));
			expect(mockIprServiceAuth.saveEventData).toHaveBeenCalledWith("01333e01-dde3-412f-a484-4444", "SET ipvStartedOn = :ipvStartedOn, userEmail = :userEmail, clientName = :clientName,  redirectUri = :redirectUri, expiresOn = :expiresOn", { 
				":userEmail": "test@jest.com",
				":ipvStartedOn": 1681902001,
				":clientName": clientId,
				":redirectUri": clientLandingPageUrl,
				":expiresOn": absoluteTimeNow() + Number(process.env.AUTH_EVENT_TTL_SECS),
			});
		});

		it("Throws error if clientLandingPageUrl is only spaces", async () => {
			const AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_URL_SPACES: ReturnSQSEvent = {
				event_id: "588f4a66-f75a-4728-9f7b-8afd865c233c",
				client_id: "ekwU",
				clientLandingPageUrl: "  ",
				event_name: "AUTH_IPV_AUTHORISATION_REQUESTED",
				timestamp: 1681902001,
				event_timestamp_ms: 1681902001713,
				timestamp_formatted: "2023-04-19T11:00:01.000Z",
				user: {
					user_id: "01333e01-dde3-412f-a484-4444",
					email: "test@jest.com",
				},
			};
			await postEventProcessorMockServices.processRequest(JSON.stringify(AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_URL_SPACES));
			expect(mockIprServiceAuth.saveEventData).toHaveBeenCalledWith("01333e01-dde3-412f-a484-4444", "SET ipvStartedOn = :ipvStartedOn, userEmail = :userEmail, clientName = :clientName,  redirectUri = :redirectUri, expiresOn = :expiresOn", { 
				":userEmail": "test@jest.com",
				":ipvStartedOn": 1681902001,
				":clientName": "ekwU",
				":redirectUri": "https://home.account.gov.uk/your-services",
				":expiresOn": absoluteTimeNow() + Number(process.env.AUTH_EVENT_TTL_SECS),
			});
		});
	});

	describe("IPV_F2F_CRI_VC_CONSUMED_EVENT event", () => {
		it("Calls saveEventData with appropriate payload for IPV_F2F_CRI_VC_CONSUMED_EVENT event", async () => {
			await postEventProcessorMockServices.processRequest(VALID_IPV_F2F_CRI_VC_CONSUMED_TXMA_EVENT_STRING);
			 
			expect(mockIprServiceSession.saveEventData).toHaveBeenCalledWith("01333e01-dde3-412f-a484-4444", "SET readyToResumeOn = :readyToResumeOn, nameParts = :nameParts", { ":readyToResumeOn": 1681902001, ":nameParts": [{ "type": "GivenName", "value": "ANGELA" }, { "type": "GivenName", "value": "ZOE" }, { "type":"FamilyName", "value":"UK SPECIMEN" }] });
			// Check if it logs about docExpiryDate missing
			 
			expect(mockLogger.info).toHaveBeenNthCalledWith(3, "No docExpiryDate in IPV_F2F_CRI_VC_CONSUMED event");
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
			await expect(postEventProcessorMockServices.processRequest(JSON.stringify(IPV_F2F_CRI_VC_CONSUMED_EVENT_INVALID))).rejects.toThrow(
				new AppError(HttpCodesEnum.SERVER_ERROR, "Cannot parse event data"),
			);
			 
			expect(mockLogger.error).toHaveBeenNthCalledWith(1, { "message":"Missing nameParts fields required for IPV_F2F_CRI_VC_CONSUMED event type" }, { "messageCode": "MISSING_MANDATORY_FIELDS_IN_SQS_EVENT" });
		});

		it("Calls saveEventData with appropriate payload for IPV_F2F_CRI_VC_CONSUMED_EVENT event with docExpiryDate field", async () => {
			await postEventProcessorMockServices.processRequest(VALID_IPV_F2F_CRI_VC_CONSUMED_WITH_DOC_EXPIRYDATE_TXMA_EVENT_STRING);
			 
			expect(mockIprServiceSession.saveEventData).toHaveBeenCalledWith("01333e01-dde3-412f-a484-4444", "SET readyToResumeOn = :readyToResumeOn, nameParts = :nameParts, documentExpiryDate = :documentExpiryDate", { ":readyToResumeOn": 1681902001, ":nameParts": [{ "type": "GivenName", "value": "ANGELA" }, { "type": "GivenName", "value": "ZOE" }, { "type":"FamilyName", "value":"UK SPECIMEN" }], ":documentExpiryDate": "2030-01-01" });
		});
	});

	describe("Without govuk_signin_journey_id", () => {
		it("Calls saveEventData with appropriate payload for F2F_YOTI_START_EVENT event", async () => {
			const Item = {
				userId: "01333e01-dde3-412f-a484-4444",
				userEmail: "test@digital.cabinet-office.gov.uk",
				ipvStartedOn: "test",
				clientName: "test",
				redirectUri: "test",
				expiresOn: absoluteTimeNow() + 1000,
			};
			mockDynamoDbClient.send = jest.fn().mockResolvedValue({ Item });
			await postEventProcessorMockSessionService.processRequest(VALID_F2F_YOTI_START_TXMA_EVENT_STRING);
			const expiresOn = absoluteTimeNow() + Number(process.env.SESSION_RETURN_RECORD_TTL_SECS!);
			 
			expect(mockIprServiceSession.saveEventData).toHaveBeenCalledWith("01333e01-dde3-412f-a484-4444", "SET journeyWentAsyncOn = :journeyWentAsyncOn, expiresOn = :expiresOn, ipvStartedOn = :ipvStartedOn, userEmail = :userEmail, clientName = :clientName, redirectUri = :redirectUri, nameParts = :nameParts",{ ":journeyWentAsyncOn": 1681902001, ":expiresOn": expiresOn, ":ipvStartedOn": "test", ":userEmail": "test@digital.cabinet-office.gov.uk", ":clientName": "test", ":redirectUri": "test" , ":nameParts": [{ "type": "GivenName", "value": "ANGELA" }, { "type": "GivenName", "value": "ZOE" }, { "type":"FamilyName", "value":"UK SPECIMEN" }]});
		});
	
		it("Calls saveEventData with appropriate payload for IPV_F2F_CRI_VC_CONSUMED_EVENT event", async () => {
			await postEventProcessorMockSessionService.processRequest(VALID_IPV_F2F_CRI_VC_CONSUMED_TXMA_EVENT_STRING);
			 
			expect(mockIprServiceSession.saveEventData).toHaveBeenCalledWith("01333e01-dde3-412f-a484-4444", "SET readyToResumeOn = :readyToResumeOn, nameParts = :nameParts", { ":readyToResumeOn": 1681902001, ":nameParts": [{ "type": "GivenName", "value": "ANGELA" }, { "type": "GivenName", "value": "ZOE" }, { "type":"FamilyName", "value":"UK SPECIMEN" }] });
		});

	});

	describe("With govuk_signin_journey_id", () => {
		it("Calls saveEventData with appropriate payload for F2F_YOTI_START_EVENT event", async () => {
			const Item = {
				userId: "01333e01-dde3-412f-a484-4444",
				userEmail: "test@digital.cabinet-office.gov.uk",
				ipvStartedOn: "test",
				clientName: "test",
				redirectUri: "test",
				expiresOn: absoluteTimeNow() + 1000,
			};
			mockDynamoDbClient.send = jest.fn().mockResolvedValue({ Item });
			const YotiStartEvent = JSON.parse(VALID_F2F_YOTI_START_TXMA_EVENT_STRING);
			YotiStartEvent.user.govuk_signin_journey_id = "sdfssg";
			await postEventProcessorMockSessionService.processRequest(JSON.stringify(YotiStartEvent));
			const expiresOn = absoluteTimeNow() + Number(process.env.SESSION_RETURN_RECORD_TTL_SECS!);
			 
			expect(mockIprServiceSession.saveEventData).toHaveBeenCalledWith("01333e01-dde3-412f-a484-4444", "SET journeyWentAsyncOn = :journeyWentAsyncOn, expiresOn = :expiresOn, ipvStartedOn = :ipvStartedOn, userEmail = :userEmail, clientName = :clientName, redirectUri = :redirectUri, nameParts = :nameParts, clientSessionId = :clientSessionId", { ":journeyWentAsyncOn": 1681902001, ":expiresOn": expiresOn, ":clientSessionId": "sdfssg", ":ipvStartedOn": "test", ":userEmail": "test@digital.cabinet-office.gov.uk", ":clientName": "test", ":redirectUri": "test", ":nameParts": [{ "type": "GivenName", "value": "ANGELA" }, { "type": "GivenName", "value": "ZOE" }, { "type":"FamilyName", "value":"UK SPECIMEN" }] });
		});
	
		it("Calls saveEventData with appropriate payload for IPV_F2F_CRI_VC_CONSUMED_EVENT event", async () => {
			const vcCounsumedEvent = JSON.parse(VALID_IPV_F2F_CRI_VC_CONSUMED_TXMA_EVENT_STRING);
			vcCounsumedEvent.user.govuk_signin_journey_id = "sdfssg";
			await postEventProcessorMockSessionService.processRequest(VALID_IPV_F2F_CRI_VC_CONSUMED_TXMA_EVENT_STRING);
			 
			expect(mockIprServiceSession.saveEventData).toHaveBeenCalledWith("01333e01-dde3-412f-a484-4444", "SET readyToResumeOn = :readyToResumeOn, nameParts = :nameParts", { ":readyToResumeOn": 1681902001, ":nameParts": [{ "type": "GivenName", "value": "ANGELA" }, { "type": "GivenName", "value": "ZOE" }, { "type":"FamilyName", "value":"UK SPECIMEN" }] });
		});
	});

	describe("F2F_DOCUMENT_UPLOADED event", () => {
		it("Calls saveEventData with appropriate payload for F2F_DOCUMENT_UPLOADED event", async () => {
			await postEventProcessorMockSessionService.processRequest(JSON.stringify(VALID_F2F_DOCUMENT_UPLOADED_TXMA_EVENT));
			 
			expect(mockIprServiceSession.saveEventData).toHaveBeenCalledWith("01333e01-dde3-412f-a484-4444", "SET documentUploadedOn = :documentUploadedOn, postOfficeVisitDetails = :postOfficeVisitDetails", { ":documentUploadedOn": 1681902001, ":postOfficeVisitDetails": [{ "post_office_date_of_visit": "7 September 2023", "post_office_time_of_visit": "4:43 pm" }] });
		});

		it("Throws error if post_office_visit_details is missing", async () => {
			const F2F_DOCUMENT_UPLOADED_EVENT_INVALID = {
				event_id: "588f4a66-f75a-4728-9f7b-8afd865c233e",
				client_id: "ekwU",
				event_name: "F2F_DOCUMENT_UPLOADED",
				clientLandingPageUrl: "REDIRECT_URL",
				timestamp: 1681902001,
				timestamp_formatted: "2023-04-19T11:00:01.000Z",
				user: {
					user_id: "01333e01-dde3-412f-a484-4444",
				},
				extensions: {},
			};
			await expect(postEventProcessorMockSessionService.processRequest(JSON.stringify(F2F_DOCUMENT_UPLOADED_EVENT_INVALID))).rejects.toThrow(
				new AppError(HttpCodesEnum.SERVER_ERROR, "Cannot parse event data"),
			);
			 
			expect(mockLogger.error).toHaveBeenNthCalledWith(1, { "message":"Missing post_office_visit_details fields required for F2F_DOCUMENT_UPLOADED event type" }, { "messageCode": "MISSING_MANDATORY_FIELDS_IN_SQS_EVENT" });
		});

		it("Throws error if extensions is missing", async () => {
			const F2F_DOCUMENT_UPLOADED_EVENT_INVALID = {
				event_id: "588f4a66-f75a-4728-9f7b-8afd865c233e",
				client_id: "ekwU",
				event_name: "F2F_DOCUMENT_UPLOADED",
				clientLandingPageUrl: "REDIRECT_URL",
				timestamp: 1681902001,
				timestamp_formatted: "2023-04-19T11:00:01.000Z",
				user: {
					user_id: "01333e01-dde3-412f-a484-4444",
				},
			};
			await expect(postEventProcessorMockSessionService.processRequest(JSON.stringify(F2F_DOCUMENT_UPLOADED_EVENT_INVALID))).rejects.toThrow(
				new AppError(HttpCodesEnum.SERVER_ERROR, "Cannot parse event data"),
			);
			 
			expect(mockLogger.error).toHaveBeenNthCalledWith(1, { "message":"Missing post_office_visit_details fields required for F2F_DOCUMENT_UPLOADED event type" }, { "messageCode": "MISSING_MANDATORY_FIELDS_IN_SQS_EVENT" });
		});
	});

	describe("F2F_YOTI_START event", () => {
		const mockAuthItem = {
			userId: "01333e01-dde3-412f-a484-4444",
			userEmail: "test@digital.cabinet-office.gov.uk",
			ipvStartedOn: "test",
			clientName: "test",
			redirectUri: "test",
			expiresOn: absoluteTimeNow() + 1000,
		};

		beforeEach(() => {
			mockDynamoDbClient.send = jest.fn().mockResolvedValue({ Item: mockAuthItem });
		});

		it("Calls saveEventData with appropriate payload for F2F_YOTI_START event", async () => {
			const expiresOn = absoluteTimeNow() + Number(process.env.SESSION_RETURN_RECORD_TTL_SECS!);
			await postEventProcessorMockSessionService.processRequest(JSON.stringify(VALID_F2F_YOTI_START_WITH_PO_DOC_DETAILS_TXMA_EVENT));
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(mockIprServiceSession.saveEventData).toHaveBeenCalledWith("01333e01-dde3-412f-a484-4444", "SET journeyWentAsyncOn = :journeyWentAsyncOn, expiresOn = :expiresOn, ipvStartedOn = :ipvStartedOn, userEmail = :userEmail, clientName = :clientName, redirectUri = :redirectUri, nameParts = :nameParts, postOfficeInfo = :postOfficeInfo, documentType = :documentType, clientSessionId = :clientSessionId", { 
				":journeyWentAsyncOn": 1681902001, 
				":clientName": "test",
				":ipvStartedOn": "test",
				":redirectUri": "test",
				":userEmail": "test@digital.cabinet-office.gov.uk",
				":expiresOn": expiresOn,
				":postOfficeInfo": [
					{
						"name": "Post Office Name",
						"address": "1 The Street, Funkytown",
						"location": [
							{
								"latitude": 0.34322,
								"longitude": -42.48372,
							},
						],
						"post_code": "N1 2AA",
					},
				],
				":documentType": "PASSPORT",
				":clientSessionId": "asdfadsfasdf",
				":nameParts": [
					{ 
						"type": "GivenName", 
						"value": "ANGELA" 
					}, 
					{ 
						"type": "GivenName", 
						
						"value": "ZOE" }, 
					{ 
						"type":"FamilyName", 
						"value":"UK SPECIMEN" 
					}
				]
			});
		});

		it("Logs if post_office_details is missing", async () => {
			const expiresOn = absoluteTimeNow() + Number(process.env.SESSION_RETURN_RECORD_TTL_SECS!);
			const yotiStartEvent = VALID_F2F_YOTI_START_WITH_PO_DOC_DETAILS_TXMA_EVENT;
			delete yotiStartEvent.extensions;
			await postEventProcessorMockSessionService.processRequest(JSON.stringify(yotiStartEvent));
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(mockIprServiceSession.saveEventData).toHaveBeenCalledWith("01333e01-dde3-412f-a484-4444", "SET journeyWentAsyncOn = :journeyWentAsyncOn, expiresOn = :expiresOn, ipvStartedOn = :ipvStartedOn, userEmail = :userEmail, clientName = :clientName, redirectUri = :redirectUri, nameParts = :nameParts, documentType = :documentType, clientSessionId = :clientSessionId", { 
				":journeyWentAsyncOn": 1681902001, 
				":clientName": "test",
				":ipvStartedOn": "test",
				":redirectUri": "test",
				":userEmail": "test@digital.cabinet-office.gov.uk",
				":expiresOn": expiresOn,
				":documentType": "PASSPORT",
				":clientSessionId": "asdfadsfasdf",
				":nameParts": [
					{ 
						"type": "GivenName", 
						"value": "ANGELA" 
					}, 
					{ 
						"type": "GivenName", 
						
						"value": "ZOE" }, 
					{ 
						"type":"FamilyName", 
						"value":"UK SPECIMEN" 
					}
				]
			});
			 
			expect(mockLogger.info).toHaveBeenNthCalledWith(3, "No post_office_details in F2F_YOTI_START event");
		});

		it("Logs if post_office_details and document_details is missing", async () => {
			const expiresOn = absoluteTimeNow() + Number(process.env.SESSION_RETURN_RECORD_TTL_SECS!);
			await postEventProcessorMockSessionService.processRequest(VALID_F2F_YOTI_START_TXMA_EVENT_STRING);
			 
			expect(mockIprServiceSession.saveEventData).toHaveBeenCalledWith("01333e01-dde3-412f-a484-4444", "SET journeyWentAsyncOn = :journeyWentAsyncOn, expiresOn = :expiresOn, ipvStartedOn = :ipvStartedOn, userEmail = :userEmail, clientName = :clientName, redirectUri = :redirectUri, nameParts = :nameParts", { 
				":journeyWentAsyncOn": 1681902001, 
				":clientName": "test",
				":ipvStartedOn": "test",
				":redirectUri": "test",
				":userEmail": "test@digital.cabinet-office.gov.uk",
				":expiresOn": expiresOn,
				":nameParts": [
					{ 
						"type": "GivenName", 
						"value": "ANGELA" 
					}, 
					{ 
						"type": "GivenName", 
						
						"value": "ZOE" }, 
					{ 
						"type":"FamilyName", 
						"value":"UK SPECIMEN" 
					}
				]
			});
			 
			expect(mockLogger.info).toHaveBeenNthCalledWith(3, "No post_office_details in F2F_YOTI_START event");
			 
			expect(mockLogger.info).toHaveBeenNthCalledWith(4, "No document_details in F2F_YOTI_START event");
		});

		it("Checks for record in auth table with relevant userID and throws error if not found", async () => {
			await expect(postEventProcessorMockServices.processRequest(VALID_F2F_YOTI_START_TXMA_EVENT_STRING)).rejects.toThrow(
				new AppError(HttpCodesEnum.BAD_REQUEST, "Cannot parse event data"),
			);
			 
			expect(mockLogger.error).toHaveBeenNthCalledWith(1, { "message": "F2F_YOTI_START event received before AUTH_IPV_AUTHORISATION_REQUESTED event" }, { "messageCode": "SQS_OUT_OF_SYNC" });	
		});

		it("Throws error if nameParts is missing", async () => {

			const yotiStartEventWithoutNameParts = VALID_F2F_YOTI_START_TXMA_EVENT
			delete yotiStartEventWithoutNameParts.restricted;
			
			await expect(postEventProcessorMockSessionService.processRequest(JSON.stringify(yotiStartEventWithoutNameParts))).rejects.toThrow(
				new AppError(HttpCodesEnum.SERVER_ERROR, "Cannot parse event data"),
			);
			 
			expect(mockLogger.error).toHaveBeenNthCalledWith(1, { "message":"Missing nameParts fields required for F2F_YOTI_START event type" }, { "messageCode": "MISSING_MANDATORY_FIELDS_IN_SQS_EVENT" });
		});
	});

	describe("IPV_F2F_RESTART", () => {
		it("throws AppError when IPRServiceSession throws AppError for IPV_F2F_RESTART event", async () => {
			process.env.F2F_RESET_ENABLED = "true";
			mockIprServiceSession.saveEventData.mockImplementation(() => {
				throw new AppError(HttpCodesEnum.SERVER_ERROR, "Error updating session record");
			});
			await expect(postEventProcessorMockServices.processRequest(VALID_IPV_F2F_RESTART_TXMA_EVENT_STRING)).rejects.toThrow(new AppError(HttpCodesEnum.SERVER_ERROR, "Error updating session record"));
			process.env.F2F_RESET_ENABLED = "false";
		});

		it("Calls saveEventData with appropriate payload for IPV_F2F_RESTART event", async () => {
			process.env.F2F_RESET_ENABLED = "true";
			await postEventProcessorMockSessionService.processRequest(VALID_IPV_F2F_RESTART_TXMA_EVENT_STRING);
			 
			expect(mockIprServiceSession.saveEventData).toHaveBeenCalledWith("7561b2c4-7466-4d58-ad02-d52c1b900bf9", "REMOVE nameParts, journeyWentAsyncOn, ipvStartedOn, documentUploadedOn, postOfficeVisitDetails , postOfficeInfo, readyToResumeOn, documentType, notified, documentExpiryDate", {});
			process.env.F2F_RESET_ENABLED = "false";
		});

		it("F2F_RESET_ENABLED toggle off. It does not call saveEventData with appropriate payload for IPV_F2F_RESTART event", async () => {
			process.env.F2F_RESET_ENABLED = "false";
			await postEventProcessorMockSessionService.processRequest(VALID_IPV_F2F_RESTART_TXMA_EVENT_STRING);
			 
			expect(mockIprServiceSession.saveEventData).not.toHaveBeenCalled();
		});
	});

	describe("IPV_F2F_CRI_VC_ERROR event", () => {
		it("Sets readyToResumeOn when error_description indicates VC generation failure", async () => {
			await postEventProcessorMockServices.processRequest(VALID_IPV_F2F_CRI_VC_ERROR_TXMA_EVENT_STRING);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(mockIprServiceSession.saveEventData).toHaveBeenCalledWith(
				"01333e01-dde3-412f-a484-4444", 
				"SET errorDescription = :errorDescription, readyToResumeOn = :readyToResumeOn", 
				{ 
					":errorDescription": "VC generation failed : Unable to create credential",
					":readyToResumeOn": absoluteTimeNow(),
				}
			);
		});

		it("Does NOT set readyToResumeOn when error_description indicates session expired", async () => {
			const sessionExpiredEvent = JSON.parse(VALID_IPV_F2F_CRI_VC_ERROR_TXMA_EVENT_STRING);
			sessionExpiredEvent.extensions.error_description = "Session expired";
			await postEventProcessorMockServices.processRequest(JSON.stringify(sessionExpiredEvent));
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(mockIprServiceSession.saveEventData).toHaveBeenCalledWith(
				"01333e01-dde3-412f-a484-4444", 
				"SET errorDescription = :errorDescription", 
				{ 
					":errorDescription": "Session expired",
				}
			);
		});
	});
});
