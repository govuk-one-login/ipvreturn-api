import { Metrics } from "@aws-lambda-powertools/metrics";
import { Logger } from "@aws-lambda-powertools/logger";
import { SQSEvent } from "aws-lambda";
import { VALID_SQS_EVENT } from "../data/sqs-events";
import { SendEmailProcessor } from "../../../services/SendEmailProcessor";
import { SendEmailService } from "../../../services/SendEmailService";
import { IPRService } from "../../../services/IPRService";
import { mock } from "jest-mock-extended";
import { EmailResponse } from "../../../models/EmailResponse";
import { absoluteTimeNow } from "../../../utils/DateTimeUtils";
import {unmarshall} from "@aws-sdk/util-dynamodb";
import {SessionEvent} from "../../../models/SessionEvent";

let sendEmailProcessorTest: SendEmailProcessor;
const mockGovNotifyService = mock<SendEmailService>();
const mockIprService = mock<IPRService>();
// pragma: allowlist nextline secret
const GOVUKNOTIFY_API_KEY = "sdhohofsdf";
const SESSION_EVENTS_TABLE = "session-table";
const logger = mock<Logger>();
const metrics = new Metrics({ namespace: "IPR" });
let sqsEvent: SQSEvent;
let mockSessionEvent: SessionEvent;
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

describe("SendEmailProcessor", () => {
	beforeAll(() => {
		sendEmailProcessorTest = new SendEmailProcessor(logger, metrics, GOVUKNOTIFY_API_KEY, SESSION_EVENTS_TABLE);
		// @ts-ignore
		sendEmailProcessorTest.govNotifyService = mockGovNotifyService;
		// @ts-ignore
		sendEmailProcessorTest.iprService = mockIprService;
		sqsEvent = VALID_SQS_EVENT;
		mockSessionEvent = getMockSessionEventItem();
	});

	beforeEach(() => {
		jest.clearAllMocks();
		sqsEvent = VALID_SQS_EVENT;
		mockSessionEvent = getMockSessionEventItem();
	});

	it("Returns success response when all required Email attributes exists", async () => {
		const expectedDateTime = new Date().toISOString();
		const mockEmailResponse = new EmailResponse(expectedDateTime, "", 201);
		mockGovNotifyService.sendEmail.mockResolvedValue(mockEmailResponse);
		const eventBody = JSON.parse(sqsEvent.Records[0].body);
		// @ts-ignore
		mockIprService.getSessionBySub.mockReturnValue(mockSessionEvent);
		const emailResponse = await sendEmailProcessorTest.processRequest(eventBody);

		expect(emailResponse.emailSentDateTime).toEqual(expectedDateTime);
		expect(emailResponse.emailFailureMessage).toBe("");
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockIprService.sendToTXMA).toHaveBeenCalledTimes(1);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockIprService.sendToTXMA).toHaveBeenCalledWith({
			event_name: "IPR_RESULT_NOTIFICATION_EMAILED",
			timestamp: absoluteTimeNow(),
			user: {
				email: "test.user@digital.cabinet-office.gov.uk",
				user_id: "user_id",
			},
		});
	});

	it.each([
		"userId",
		"firstName",
		"lastName",
		"emailAddress",
	])("Throws error when event body message is missing required attributes", async (attribute) => {
		const eventBody = JSON.parse(sqsEvent.Records[0].body);
		const eventBodyMessage = eventBody.Message;
		delete eventBodyMessage[attribute];
		eventBody.Message = eventBodyMessage;
		await expect(sendEmailProcessorTest.processRequest(eventBody)).rejects.toThrow();
	});

	it.each([
		"userId",
		"firstName",
		"lastName",
		"emailAddress",
	])("Throws error when the Email modal validation fails", async (attribute) => {
		const eventBody = JSON.parse(sqsEvent.Records[0].body);
		const eventBodyMessage = eventBody.Message;
		eventBodyMessage[attribute] = 0;
		eventBody.Message = eventBodyMessage;
		await expect(sendEmailProcessorTest.processRequest(eventBody)).rejects.toThrow();
	});

	it("Return 200 when write to txMA fails", async () => {
		const expectedDateTime = new Date().toISOString();
		const mockEmailResponse = new EmailResponse(expectedDateTime, "", 201);
		mockGovNotifyService.sendEmail.mockResolvedValue(mockEmailResponse);
		const eventBody = JSON.parse(sqsEvent.Records[0].body);
		mockIprService.sendToTXMA.mockRejectedValue({});

		const emailResponse = await sendEmailProcessorTest.processRequest(eventBody);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockIprService.sendToTXMA).toHaveBeenCalledTimes(1);

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(logger.error).toHaveBeenCalledWith("Failed to write TXMA event IPR_RESULT_NOTIFICATION_EMAILED to SQS queue.", { "messageCode": "FAILED_TO_WRITE_TXMA" });

	});

	it.each([
		"journeyWentAsyncOn",
		"ipvStartedOn",
		"readyToResumeOn",
	])("Throws error when session event record is missing necessary Event timestamps fields", async (attribute) => {
		const eventBody = JSON.parse(sqsEvent.Records[0].body);
		const eventBodyMessage = eventBody.Message;
		eventBody.Message = eventBodyMessage;
		// @ts-ignore
		delete mockSessionEvent[attribute];
		// @ts-ignore
		mockIprService.getSessionBySub.mockReturnValue(mockSessionEvent);
		await expect(sendEmailProcessorTest.processRequest(eventBody)).rejects.toThrow();
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockIprService.getSessionBySub).toHaveBeenCalledTimes(1);
		expect(logger.warn).toHaveBeenCalledWith(`${attribute} is not yet populated, unable to process the DB record.` , { "messageCode": "MISSING_MANDATORY_FIELDS_IN_SESSION_EVENT" });

	});

	it.each([
		"userEmail",
		"nameParts",
		"clientName",
		"redirectUri",
	])("Throws error when session event record is missing necessary fields %s", async (attribute) => {
		const eventBody = JSON.parse(sqsEvent.Records[0].body);
		const eventBodyMessage = eventBody.Message;
		eventBody.Message = eventBodyMessage;
		// @ts-ignore
		delete mockSessionEvent[attribute];
		// @ts-ignore
		mockIprService.getSessionBySub.mockReturnValue(mockSessionEvent);
		await expect(sendEmailProcessorTest.processRequest(eventBody)).rejects.toThrow();
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockIprService.getSessionBySub).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith("Unable to process the DB record as the necessary fields are not populated." , { "messageCode": "MISSING_MANDATORY_FIELDS_IN_SESSION_EVENT" });

	});

	it("Throws error when notified flag is not set to true for the user session event record", async () => {
		const eventBody = JSON.parse(sqsEvent.Records[0].body);
		const eventBodyMessage = eventBody.Message;
		eventBody.Message = eventBodyMessage;
		mockSessionEvent.notified = false;
		// @ts-ignore
		mockIprService.getSessionBySub.mockReturnValue(mockSessionEvent);
		await expect(sendEmailProcessorTest.processRequest(eventBody)).rejects.toThrow();
		expect(logger.error).toHaveBeenCalledWith("Notified flag is not set to true for this user session event" , { "messageCode": "NOTIFIED_FLAG_NOT_SET_TO_TRUE" });

	});

	it("Throws error when the session event record was not found for the userId", async () => {
		const eventBody = JSON.parse(sqsEvent.Records[0].body);
		const eventBodyMessage = eventBody.Message;
		eventBody.Message = eventBodyMessage;
		mockSessionEvent.notified = false;
		// @ts-ignore
		mockIprService.getSessionBySub.mockReturnValue(null);
		await expect(sendEmailProcessorTest.processRequest(eventBody)).rejects.toThrow();
		expect(logger.error).toHaveBeenCalledWith("No session event found for this userId" , { "messageCode": "SESSION_NOT_FOUND" });

	});

});
