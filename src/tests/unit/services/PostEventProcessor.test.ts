import { Metrics } from "@aws-lambda-powertools/metrics";
import { Logger } from "@aws-lambda-powertools/logger";
import { PostEventProcessor } from "../../../services/PostEventProcessor";
import { mock } from "jest-mock-extended";
import { IPRService } from "../../../services/IPRService";
import { HttpCodesEnum } from "../../../models/enums/HttpCodesEnum";
import { absoluteTimeNow } from "../../../utils/DateTimeUtils";

let postEventProcessorMock: PostEventProcessor;
const mockIprService = mock<IPRService>();
const logger = new Logger({
	logLevel: "DEBUG",
	serviceName: "IPR",
});
const metrics = new Metrics({ namespace: "F2F" });
const AUTH_IPV_AUTHORISATION_REQUESTED_EVENT = "{\n\t\"event_id\":\"588f4a66-f75a-4728-9f7b-8afd865c233c\",\n\t\"client_id\":\"RqFZ83csmS4Mi4Y7s7ohD9-ekwU\",\n\t\"component_id\":\"UNKNOWN\",\n\t\"event_name\":\"AUTH_IPV_AUTHORISATION_REQUESTED\",\n\t\"redirect_uri\":\"www.localhost.com\",\n\t\"rp_name\":\"replay\",\n\t\"timestamp\":\"1681902001\",\n\t\"timestamp_formatted\":\"2023-04-19T11:00:01.000Z\",\n\t\"user\":{\n\t\t \"user_id\":\"01333e01-dde3-412f-a484-5555\",\n\t\t \"email\":\"jest@test.com\"\n\t}\n}";
const F2F_YOTI_START_EVENT = "{\n   \"event_id\":\"588f4a66-f75a-4728-9f7b-8afd865c233d\",\n   \"client_id\":\"RqFZ83csmS4Mi4Y7s7ohD9-ekwU\",\n   \"component_id\":\"UNKNOWN\",\n   \"event_name\":\"F2F_YOTI_START\",\n   \"redirect_uri\":\"www.localhost.com\",\n   \"rp_name\":\"replay\",\n   \"timestamp\":1681902001,\n   \"timestamp_formatted\":\"2023-04-19T11:00:01.000Z\",\n   \"user\":{\n      \"sub\":\"01333e01-dde3-412f-a484-4444\"\n   }\n}";
const IPV_F2F_CRI_VC_CONSUMED_EVENT = "{\n   \"event_id\":\"588f4a66-f75a-4728-9f7b-8afd865c233e\",\n   \"client_id\":\"RqFZ83csmS4Mi4Y7s7ohD9-ekwU\",\n   \"component_id\":\"UNKNOWN\",\n   \"event_name\":\"IPV_F2F_CRI_VC_CONSUMED\",\n   \"redirect_uri\":\"www.localhost.com\",\n   \"rp_name\":\"replay\",\n   \"timestamp\":1681902001,\n   \"timestamp_formatted\":\"2023-04-19T11:00:01.000Z\",\n   \"user\":{\n      \"user_id\":\"01333e01-dde3-412f-a484-4444\",\n      \"email\":\"e914e32172adcdad6c0906f7e5a0f4f43a6e99847c4370df783c7142f71ba454\"\n   }\n}";
const AUTH_DELETE_ACCOUNT_EVENT = "{\n   \"event_id\":\"588f4a66-f75a-4728-9f7b-8afd865c233f\",\n   \"client_id\":\"RqFZ83csmS4Mi4Y7s7ohD9-ekwU\",\n   \"component_id\":\"UNKNOWN\",\n   \"event_name\":\"AUTH_DELETE_ACCOUNT\",\n   \"redirect_uri\":\"www.localhost.com\",\n   \"rp_name\":\"replay\",\n   \"timestamp\":1681902001,\n   \"timestamp_formatted\":\"2023-04-19T11:00:01.000Z\",\n   \"user\":{\n      \"user_id\":\"01333e01-dde3-412f-a484-3333\",\n      \"email\":\"e914e32172adcdad6c0906f7e5a0f4f43a6e99847c4370df783c7142f71ba454\"\n   }\n}";


describe("PostEventProcessor", () => {
	beforeAll(() => {
		postEventProcessorMock = new PostEventProcessor(logger, metrics);
		// @ts-ignore
		postEventProcessorMock.iprService = mockIprService;
		mockIprService.saveEventData.mockResolvedValueOnce();
	});

	it("Returns success response when call to save event data is successful", async () => {
		const response = await postEventProcessorMock.processRequest(AUTH_IPV_AUTHORISATION_REQUESTED_EVENT);
		expect(response.statusCode).toBe(HttpCodesEnum.CREATED);
		expect(response.eventBody).toBe("OK");
	});

	it("Calls saveEventData with appropriate payload for AUTH_IPV_AUTHORISATION_REQUESTED event", async () => {
		await postEventProcessorMock.processRequest(AUTH_IPV_AUTHORISATION_REQUESTED_EVENT);
		const expiresOn = absoluteTimeNow() + Number(process.env.SESSION_RETURN_RECORD_TTL!);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockIprService.saveEventData).toHaveBeenCalledWith("01333e01-dde3-412f-a484-5555", "SET ipvStartedOn = :ipvStartedOn, userEmail = :userEmail, nameParts = :nameParts, clientName = :clientName,  redirectUri = :redirectUri, expiresOn = :expiresOn", { ":clientName": "RqFZ83csmS4Mi4Y7s7ohD9-ekwU", ":ipvStartedOn": "1681902001", ":nameParts": [], ":redirectUri": "UNKNOWN", ":userEmail": "jest@test.com", ":expiresOn": expiresOn });
	});

	it("Calls saveEventData with appropriate payload for F2F_YOTI_START_EVENT event", async () => {
		await postEventProcessorMock.processRequest(F2F_YOTI_START_EVENT);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockIprService.saveEventData).toHaveBeenCalledWith("01333e01-dde3-412f-a484-4444", "SET journeyWentAsyncOn = :journeyWentAsyncOn", { ":journeyWentAsyncOn": 1681902001 });
	});
	
	it("Calls saveEventData with appropriate payload for IPV_F2F_CRI_VC_CONSUMED_EVENT event", async () => {
		await postEventProcessorMock.processRequest(IPV_F2F_CRI_VC_CONSUMED_EVENT);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockIprService.saveEventData).toHaveBeenCalledWith("01333e01-dde3-412f-a484-4444", "SET readyToResumeOn = :readyToResumeOn", { ":readyToResumeOn": 1681902001 });
	});

	it("Calls saveEventData with appropriate payload for AUTH_DELETE_ACCOUNT_EVENT event", async () => {
		await postEventProcessorMock.processRequest(AUTH_DELETE_ACCOUNT_EVENT);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockIprService.saveEventData).toHaveBeenCalledWith("01333e01-dde3-412f-a484-3333", "SET accountDeletedOn = :accountDeletedOn, userEmail = :userEmail, nameParts = :nameParts, clientName = :clientName,  redirectUri = :redirectUri", { ":accountDeletedOn": 1681902001, ":clientName": "", ":nameParts": [], ":redirectUri": "", ":userEmail": "" });
	});
});
