import { Metrics } from "@aws-lambda-powertools/metrics";
import { Logger } from "@aws-lambda-powertools/logger";
import { PostEventProcessor } from "../../../services/PostEventProcessor";
import { mock } from "jest-mock-extended";
import { IPRService } from "../../../services/IPRService";
import { HttpCodesEnum } from "../../../models/enums/HttpCodesEnum";
import { absoluteTimeNow } from "../../../utils/DateTimeUtils";
import { AppError } from "../../../utils/AppError";

let postEventProcessor: PostEventProcessor;
const mockIprService = mock<IPRService>();
const mockLogger = mock<Logger>();

const metrics = new Metrics({ namespace: "F2F" });
const AUTH_IPV_AUTHORISATION_REQUESTED_EVENT = "{\n\t\"event_id\":\"588f4a66-f75a-4728-9f7b-8afd865c233c\",\n\t\"client_id\":\"ekwU\",\n\t\"clientLandingPageUrl\":\"REDIRECT_URL\",\n\t\"event_name\":\"AUTH_IPV_AUTHORISATION_REQUESTED\",\n\t\"redirect_uri\":\"www.localhost.com\",\n\t\"rp_name\":\"replay\",\n\t\"timestamp\":\"1681902001\",\n\t\"timestamp_formatted\":\"2023-04-19T11:00:01.000Z\",\n\t\"user\":{\n\t\t \"user_id\":\"01333e01-dde3-412f-a484-5555\",\n\t\t \"email\":\"jest@test.com\"\n\t}\n}";
const F2F_YOTI_START_EVENT = "{\n   \"event_id\":\"588f4a66-f75a-4728-9f7b-8afd865c233d\",\n   \"client_id\":\"ekwU\",\n   \"component_id\":\"UNKNOWN\",\n   \"event_name\":\"F2F_YOTI_START\",\n   \"redirect_uri\":\"www.localhost.com\",\n   \"rp_name\":\"replay\",\n   \"timestamp\":1681902001,\n   \"timestamp_formatted\":\"2023-04-19T11:00:01.000Z\",\n   \"user\":{\n\t\t \"user_id\":\"01333e01-dde3-412f-a484-4444\",\n\t\t \"email\":\"jest@test.com\"\n\t}\n}";
const IPV_F2F_CRI_VC_CONSUMED_EVENT = "{\"event_id\":\"588f4a66-f75a-4728-9f7b-8afd865c233e\",\"client_id\":\"ekwU\",\"component_id\":\"UNKNOWN\",\"event_name\":\"IPV_F2F_CRI_VC_CONSUMED\",\"redirect_uri\":\"www.localhost.com\",\"rp_name\":\"replay\",\"timestamp\":1681902001,\"timestamp_formatted\":\"2023-04-19T11:00:01.000Z\",\"user\":{\"user_id\":\"01333e01-dde3-412f-a484-4444\",\"email\":\"e914e32172adcdad6c0906f7e5a0f4f43a6e99847c4370df783c7142f71ba454\"},\"restricted\":{\"nameParts\":[{\"type\":\"GivenName\",\"value\":\"ANGELA\"},{\"type\":\"GivenName\",\"value\":\"ZOE\"},{\"type\":\"FamilyName\",\"value\":\"UK SPECIMEN\"}]}}";
const AUTH_DELETE_ACCOUNT_EVENT = "{\n   \"event_id\":\"588f4a66-f75a-4728-9f7b-8afd865c233f\",\n   \"client_id\":\"ekwU\",\n   \"component_id\":\"UNKNOWN\",\n   \"event_name\":\"AUTH_DELETE_ACCOUNT\",\n   \"redirect_uri\":\"www.localhost.com\",\n   \"rp_name\":\"replay\",\n   \"timestamp\":1681902001,\n   \"timestamp_formatted\":\"2023-04-19T11:00:01.000Z\",\n   \"user\":{\n      \"user_id\":\"01333e01-dde3-412f-a484-3333\",\n      \"email\":\"e914e32172adcdad6c0906f7e5a0f4f43a6e99847c4370df783c7142f71ba454\"\n   }\n}";


describe("PostEventProcessor", () => {
	beforeAll(() => {
		postEventProcessor = new PostEventProcessor(mockLogger, metrics);
		// @ts-ignore
		postEventProcessor.iprService = mockIprService;
		mockIprService.saveEventData.mockResolvedValueOnce();
	});

	it("Returns success response when call to save event data is successful", async () => {
		const response = await postEventProcessor.processRequest(AUTH_IPV_AUTHORISATION_REQUESTED_EVENT);
		expect(response.statusCode).toBe(HttpCodesEnum.CREATED);
		expect(response.eventBody).toBe("OK");
	});

	it("Calls saveEventData with appropriate payload for AUTH_IPV_AUTHORISATION_REQUESTED event", async () => {
		await postEventProcessor.processRequest(AUTH_IPV_AUTHORISATION_REQUESTED_EVENT);
		const expiresOn = absoluteTimeNow() + Number(process.env.SESSION_RETURN_RECORD_TTL!);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockIprService.saveEventData).toHaveBeenCalledWith("01333e01-dde3-412f-a484-5555", "SET ipvStartedOn = :ipvStartedOn, userEmail = :userEmail, clientName = :clientName,  redirectUri = :redirectUri, expiresOn = :expiresOn", { ":clientName": "ekwU", ":ipvStartedOn": "1681902001", ":redirectUri": "REDIRECT_URL", ":userEmail": "jest@test.com", ":expiresOn": expiresOn });
	});

	it("Calls saveEventData with appropriate payload for F2F_YOTI_START_EVENT event", async () => {
		await postEventProcessor.processRequest(F2F_YOTI_START_EVENT);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockIprService.saveEventData).toHaveBeenCalledWith("01333e01-dde3-412f-a484-4444", "SET journeyWentAsyncOn = :journeyWentAsyncOn", { ":journeyWentAsyncOn": 1681902001 });
	});

	it("Calls saveEventData with appropriate payload for IPV_F2F_CRI_VC_CONSUMED_EVENT event", async () => {
		await postEventProcessor.processRequest(IPV_F2F_CRI_VC_CONSUMED_EVENT);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockIprService.saveEventData).toHaveBeenCalledWith("01333e01-dde3-412f-a484-4444", "SET readyToResumeOn = :readyToResumeOn, nameParts = :nameParts", { ":readyToResumeOn": 1681902001, ":nameParts": [{ "type": "GivenName", "value": "ANGELA" }, { "type": "GivenName", "value": "ZOE" }, { "type":"FamilyName", "value":"UK SPECIMEN" }] });
	});

	it("Calls saveEventData with appropriate payload for AUTH_DELETE_ACCOUNT_EVENT event", async () => {
		await postEventProcessor.processRequest(AUTH_DELETE_ACCOUNT_EVENT);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockIprService.saveEventData).toHaveBeenCalledWith("01333e01-dde3-412f-a484-3333", "SET accountDeletedOn = :accountDeletedOn, userEmail = :userEmail, nameParts = :nameParts, clientName = :clientName,  redirectUri = :redirectUri", { ":accountDeletedOn": 1681902001, ":clientName": "", ":nameParts": [], ":redirectUri": "", ":userEmail": "" });
	});

	it("Throws error if clientLandingPageUrl is missing", async () => {
		const AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_MISSING_LANDINGURL = "{\n\t\"event_id\":\"588f4a66-f75a-4728-9f7b-8afd865c233c\",\n\t\"client_id\":\"ekwU\",\n\t\"event_name\":\"AUTH_IPV_AUTHORISATION_REQUESTED\",\n\t\"redirect_uri\":\"www.localhost.com\",\n\t\"rp_name\":\"replay\",\n\t\"timestamp\":\"1681902001\",\n\t\"timestamp_formatted\":\"2023-04-19T11:00:01.000Z\",\n\t\"user\":{\n\t\t \"user_id\":\"01333e01-dde3-412f-a484-5555\",\n\t\t \"email\":\"jest@test.com\"\n\t}\n}";
		await expect(postEventProcessor.processRequest(AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_MISSING_LANDINGURL)).rejects.toThrow(
			new AppError(HttpCodesEnum.SERVER_ERROR, "Cannot parse event data"),
		);

		expect(mockLogger.error).toHaveBeenNthCalledWith(1, { "message":"Missing or invalid value for any or all of userDetails.email, eventDetails.client_id, eventDetails.clientLandingPageUrl fields required for AUTH_IPV_AUTHORISATION_REQUESTED event type" }, { "messageCode": "MISSING_MANDATORY_FIELDS_IN_SQS_EVENT" });
	});

	it("Throws error if clientLandingPageUrl has spaces", async () => {
		const AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_URL_SPACES = "{\n\t\"event_id\":\"588f4a66-f75a-4728-9f7b-8afd865c233c\",\n\t\"client_id\":\"ekwU\",\n\t\"event_name\":\"AUTH_IPV_AUTHORISATION_REQUESTED\",\n\t\"clientLandingPageUrl\":\"   \",\n\t\"timestamp\":\"1681902001\",\n\t\"timestamp_formatted\":\"2023-04-19T11:00:01.000Z\",\n\t\"user\":{\n\t\t \"user_id\":\"01333e01-dde3-412f-a484-5555\",\n\t\t \"email\":\"jest@test.com\"\n\t}\n}";
		await expect(postEventProcessor.processRequest(AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_URL_SPACES)).rejects.toThrow(
			new AppError(HttpCodesEnum.SERVER_ERROR, "Cannot parse event data"),
		);

		expect(mockLogger.error).toHaveBeenNthCalledWith(1, { "message":"Missing or invalid value for any or all of userDetails.email, eventDetails.client_id, eventDetails.clientLandingPageUrl fields required for AUTH_IPV_AUTHORISATION_REQUESTED event type" }, { "messageCode": "MISSING_MANDATORY_FIELDS_IN_SQS_EVENT" });
	});

	it("Throws error if user object is missing", async () => {
		const AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_USER_MISSING = "{\n\t\"event_id\":\"588f4a66-f75a-4728-9f7b-8afd865c233c\",\n\t\"client_id\":\"ekwU\",\n\t\"event_name\":\"AUTH_IPV_AUTHORISATION_REQUESTED\",\n\t\"clientLandingPageUrl\":\"www.localhost.com\",\n\t\"timestamp\":\"1681902001\",\n\t\"timestamp_formatted\":\"2023-04-19T11:00:01.000Z\"\n}";
		await expect(postEventProcessor.processRequest(AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_USER_MISSING)).rejects.toThrow(
			new AppError(HttpCodesEnum.SERVER_ERROR, "Cannot parse event data"),
		);
		expect(mockLogger.error).toHaveBeenNthCalledWith(1, { "message": "Missing user details in the incoming SQS event" }, { "messageCode": "MISSING_MANDATORY_FIELDS_IN_SQS_EVENT" });

	});

	it("Throws error if eventName is missing", async () => {
		const AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_NAME_MISSING = "{\n\t\"event_id\":\"588f4a66-f75a-4728-9f7b-8afd865c233c\",\n\t\"client_id\":\"ekwU\",\n\t\"redirect_uri\":\"www.localhost.com\",\n\t\"timestamp\":\"1681902001\",\n\t\"timestamp_formatted\":\"2023-04-19T11:00:01.000Z\",\n\t\"user\":{\n\t\t \"user_id\":\"01333e01-dde3-412f-a484-5555\",\n\t\t \"email\":\"jest@test.com\"\n\t}\n}";
		await expect(postEventProcessor.processRequest(AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_NAME_MISSING)).rejects.toThrow(
			new AppError(HttpCodesEnum.SERVER_ERROR, "Cannot parse event data"),
		);
		expect(mockLogger.error).toHaveBeenNthCalledWith(1, { "message": "Missing or invalid value for any or all of event name, timestamp in the incoming SQS event" }, { "messageCode": "MISSING_MANDATORY_FIELDS_IN_SQS_EVENT" });
	});

	it("Throws error if eventName has spaces", async () => {
		const AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_NAME_SPACES = "{\n\t\"event_id\":\"588f4a66-f75a-4728-9f7b-8afd865c233c\",\n\t\"client_id\":\"ekwU\",\n\t\"event_name\":\"  \",\n\t\"redirect_uri\":\"www.localhost.com\",\n\t\"rp_name\":\"replay\",\n\t\"timestamp\":\"1681902001\",\n\t\"timestamp_formatted\":\"2023-04-19T11:00:01.000Z\",\n\t\"user\":{\n\t\t \"user_id\":\"01333e01-dde3-412f-a484-5555\",\n\t\t \"email\":\"jest@test.com\"\n\t}\n}";
		await expect(postEventProcessor.processRequest(AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_NAME_SPACES)).rejects.toThrow(
			new AppError(HttpCodesEnum.SERVER_ERROR, "Cannot parse event data"),
		);
		expect(mockLogger.error).toHaveBeenNthCalledWith(1, { "message": "Missing or invalid value for any or all of event name, timestamp in the incoming SQS event" }, { "messageCode": "MISSING_MANDATORY_FIELDS_IN_SQS_EVENT" });
	});

	it("Throws error if timestamp is missing", async () => {
		const AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_TIMESTAMP_MISSING = "{\n\t\"event_id\":\"588f4a66-f75a-4728-9f7b-8afd865c233c\",\n\t\"client_id\":\"ekwU\",\n\t\"event_name\":\"AUTH_IPV_AUTHORISATION_REQUESTED\",\n\t\"clientLandingPageUrl\":\"www.localhost.com\",\n\t\"timestamp_formatted\":\"2023-04-19T11:00:01.000Z\",\n\t\"user\":{\n\t\t \"user_id\":\"01333e01-dde3-412f-a484-5555\",\n\t\t \"email\":\"jest@test.com\"\n\t}\n}";
		await expect(postEventProcessor.processRequest(AUTH_IPV_AUTHORISATION_REQUESTED_EVENT_TIMESTAMP_MISSING)).rejects.toThrow(
			new AppError(HttpCodesEnum.SERVER_ERROR, "Cannot parse event data"),
		);

		expect(mockLogger.error).toHaveBeenNthCalledWith(1, { "message":"Missing or invalid value for any or all of event name, timestamp in the incoming SQS event" }, { "messageCode": "MISSING_MANDATORY_FIELDS_IN_SQS_EVENT" });
	});

	it("Throws error if restricted is missing", async () => {
		const IPV_F2F_CRI_VC_CONSUMED_EVENT_INVALID = "{\"event_id\":\"588f4a66-f75a-4728-9f7b-8afd865c233e\",\"client_id\":\"ekwU\",\"component_id\":\"UNKNOWN\",\"event_name\":\"IPV_F2F_CRI_VC_CONSUMED\",\"redirect_uri\":\"www.localhost.com\",\"rp_name\":\"replay\",\"timestamp\":1681902001,\"timestamp_formatted\":\"2023-04-19T11:00:01.000Z\",\"user\":{\"user_id\":\"01333e01-dde3-412f-a484-4444\",\"email\":\"e914e32172adcdad6c0906f7e5a0f4f43a6e99847c4370df783c7142f71ba454\"}}";
		await expect(postEventProcessor.processRequest(IPV_F2F_CRI_VC_CONSUMED_EVENT_INVALID)).rejects.toThrow(
			new AppError(HttpCodesEnum.SERVER_ERROR, "Cannot parse event data"),
		);

		expect(mockLogger.error).toHaveBeenNthCalledWith(1, { "message":"Missing nameParts fields required for IPV_F2F_CRI_VC_CONSUMED event type" }, { "messageCode": "MISSING_MANDATORY_FIELDS_IN_SQS_EVENT" });
	});

});
