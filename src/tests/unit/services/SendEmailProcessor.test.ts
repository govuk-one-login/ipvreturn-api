/* eslint-disable @typescript-eslint/unbound-method */
import { Metrics } from "@aws-lambda-powertools/metrics";
import { Logger } from "@aws-lambda-powertools/logger";
import { SQSEvent } from "aws-lambda";
import { VALID_GOV_NOTIFY_HANDLER_SQS_EVENT, VALID_GOV_NOTIFY_HANDLER_SQS_EVENT_DYNAMIC_EMAIL } from "../../data/sqs-events";
import { SendEmailProcessor } from "../../../services/SendEmailProcessor";
import { SendEmailService } from "../../../services/SendEmailService";
import { IPRService } from "../../../services/IPRService";
import { mock } from "jest-mock-extended";
import { EmailResponse } from "../../../models/EmailResponse";
import { absoluteTimeNow } from "../../../utils/DateTimeUtils";
import { ExtSessionEvent, SessionEvent } from "../../../models/SessionEvent";
import { Email, DynamicEmail } from "../../../models/Email";
import { Constants } from "../../../utils/Constants";

let sendEmailProcessorTest: SendEmailProcessor;
const mockGovNotifyService = mock<SendEmailService>();
const mockIprService = mock<IPRService>();
// pragma: allowlist nextline secret
const GOVUKNOTIFY_API_KEY = "sdhohofsdf";
const SESSION_EVENTS_TABLE = "session-table";
const logger = mock<Logger>();
const metrics = new Metrics({ namespace: "IPR" });
let sqsEvent: SQSEvent;
let sqsEventNewEmail: SQSEvent;
let mockSessionEvent: SessionEvent;
let mockExtSessionEvent: ExtSessionEvent;
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

function getMockExtSessionEventItem(): ExtSessionEvent {
	const sess: ExtSessionEvent = {
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
		postOfficeInfo: [
			  {
				address: "1 The Street, Funkytown",
				location: [
					{
						latitude: 0.34322,
						longitude: -42.48372,						  
					},
					  
				],
				name: "Post Office Name",
				post_code: "N1 2AA",
			},			  
		],
		postOfficeVisitDetails: [
			  {
				post_office_date_of_visit: "7 September 2023",
				post_office_time_of_visit: "4:43 pm",
				  
			  },
		],
		documentExpiryDate: "2030-11-21",
		documentType: "PASSPORT",
		documentUploadedOn: 1685821541,		  
	};
	return sess;
}

describe("SendEmailProcessor", () => {
	beforeAll(() => {
		sendEmailProcessorTest = new SendEmailProcessor(logger, metrics, GOVUKNOTIFY_API_KEY, "serviceId", SESSION_EVENTS_TABLE);
		// @ts-ignore
		sendEmailProcessorTest.govNotifyService = mockGovNotifyService;
		// @ts-ignore
		sendEmailProcessorTest.iprService = mockIprService;
		sqsEvent = VALID_GOV_NOTIFY_HANDLER_SQS_EVENT;
		sqsEventNewEmail = VALID_GOV_NOTIFY_HANDLER_SQS_EVENT_DYNAMIC_EMAIL;
		mockSessionEvent = getMockSessionEventItem();
		mockExtSessionEvent = getMockExtSessionEventItem();
	});

	beforeEach(() => {
		jest.clearAllMocks();
		sqsEvent = VALID_GOV_NOTIFY_HANDLER_SQS_EVENT;
		sqsEventNewEmail = VALID_GOV_NOTIFY_HANDLER_SQS_EVENT_DYNAMIC_EMAIL;
		mockSessionEvent = getMockSessionEventItem();
		mockExtSessionEvent = getMockExtSessionEventItem();
	});

	it("Returns success response when all required Email attributes exists to send oldEmail messageType", async () => {
		const expectedDateTime = new Date().toISOString();
		const mockEmailResponse = new EmailResponse(expectedDateTime, "", 201);
		mockGovNotifyService.sendEmail.mockResolvedValue(mockEmailResponse);
		const eventBody = JSON.parse(sqsEvent.Records[0].body);
		// @ts-ignore
		mockIprService.getSessionBySub.mockReturnValue(mockSessionEvent);
		const message = Email.parseRequest(JSON.stringify(eventBody.Message));
		const emailResponse = await sendEmailProcessorTest.processRequest(message);

		expect(emailResponse.emailSentDateTime).toEqual(expectedDateTime);
		expect(emailResponse.emailFailureMessage).toBe("");
		expect(mockIprService.sendToTXMA).toHaveBeenCalledTimes(1);
		expect(mockIprService.sendToTXMA).toHaveBeenCalledWith({
			event_name: "IPR_RESULT_NOTIFICATION_EMAILED",
			timestamp: absoluteTimeNow(),
			user: {
				email: "test.user@digital.cabinet-office.gov.uk",
				user_id: "user_id",
			},
			extensions: {
				previous_govuk_signin_journey_id: "sdfssg",
			},
		});
	});

	it.each([
		"userId",
		"firstName",
		"lastName",
		"emailAddress",
	])("Throws error when event body message is missing required attributes to send oldEmail", async (attribute) => {
		const eventBody = JSON.parse(sqsEvent.Records[0].body);
		const eventBodyMessage = eventBody.Message;
		delete eventBodyMessage[attribute];
		eventBody.Message = eventBodyMessage;
		const message = Email.parseRequest(JSON.stringify(eventBody.Message));
		await expect(sendEmailProcessorTest.processRequest(message)).rejects.toThrow();
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

	it("when write to txMA fails", async () => {
		const expectedDateTime = new Date().toISOString();
		const mockEmailResponse = new EmailResponse(expectedDateTime, "", 201);
		mockGovNotifyService.sendEmail.mockResolvedValue(mockEmailResponse);
		const eventBody = JSON.parse(sqsEvent.Records[0].body);
		mockIprService.sendToTXMA.mockRejectedValue({});

		const message = Email.parseRequest(JSON.stringify(eventBody.Message));
		const emailResponse = await sendEmailProcessorTest.processRequest(message);
		expect(mockIprService.sendToTXMA).toHaveBeenCalledTimes(1);

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
		const message = Email.parseRequest(JSON.stringify(eventBody.Message));
		await expect(sendEmailProcessorTest.processRequest(message)).rejects.toThrow();
		expect(mockIprService.getSessionBySub).toHaveBeenCalledTimes(1);
		expect(logger.warn).toHaveBeenCalledWith(`${attribute} is not yet populated, unable to process the DB record.`, { "messageCode": "MISSING_MANDATORY_FIELDS_IN_SESSION_EVENT" });

	});

	it.each([
		"userEmail",
		"nameParts",
		"clientName",
		"redirectUri",
	])("Throws error when session event record is missing necessary field %s required to send oldEmail", async (attribute) => {
		const eventBody = JSON.parse(sqsEvent.Records[0].body);
		const eventBodyMessage = eventBody.Message;
		eventBody.Message = eventBodyMessage;
		// @ts-ignore
		delete mockSessionEvent[attribute];
		// @ts-ignore
		mockIprService.getSessionBySub.mockReturnValue(mockSessionEvent);
		const message = Email.parseRequest(JSON.stringify(eventBody.Message));
		await expect(sendEmailProcessorTest.processRequest(message)).rejects.toThrow();
		expect(mockIprService.getSessionBySub).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith("Unable to process the DB record as the necessary fields are not populated to send the old template email.", { "messageCode": "MISSING_MANDATORY_FIELDS_IN_SESSION_EVENT" });

	});

	it("Throws error when notified flag is not set to true for the user session event record", async () => {
		const eventBody = JSON.parse(sqsEvent.Records[0].body);
		const eventBodyMessage = eventBody.Message;
		eventBody.Message = eventBodyMessage;
		mockSessionEvent.notified = false;
		// @ts-ignore
		mockIprService.getSessionBySub.mockReturnValue(mockSessionEvent);
		const message = Email.parseRequest(JSON.stringify(eventBody.Message));
		await expect(sendEmailProcessorTest.processRequest(message)).rejects.toThrow();
		expect(logger.error).toHaveBeenCalledWith("Notified flag is not set to true for this user session event", { "messageCode": "NOTIFIED_FLAG_NOT_SET_TO_TRUE" });

	});

	it("Throws error when the session event record was not found for the userId", async () => {
		const eventBody = JSON.parse(sqsEvent.Records[0].body);
		const eventBodyMessage = eventBody.Message;
		eventBody.Message = eventBodyMessage;
		mockSessionEvent.notified = false;
		// @ts-ignore
		mockIprService.getSessionBySub.mockReturnValue(null);
		const message = Email.parseRequest(JSON.stringify(eventBody.Message));
		await expect(sendEmailProcessorTest.processRequest(message)).rejects.toThrow();
		expect(logger.error).toHaveBeenCalledWith("No session event found for this userId", { "messageCode": "SESSION_NOT_FOUND" });

	});

	it("Returns success response when all required Email attributes exists to send newEmail messageType", async () => {
		const expectedDateTime = new Date().toISOString();
		const mockEmailResponse = new EmailResponse(expectedDateTime, "", 201);
		mockGovNotifyService.sendEmail.mockResolvedValue(mockEmailResponse);
		const eventBody = JSON.parse(sqsEventNewEmail.Records[0].body);
		// @ts-ignore
		mockIprService.getSessionBySub.mockReturnValue(mockExtSessionEvent);
		const newEmailmessage = DynamicEmail.parseRequest(JSON.stringify(eventBody.Message));
		const emailResponse = await sendEmailProcessorTest.processRequest(newEmailmessage);

		expect(mockGovNotifyService.sendEmail).toHaveBeenCalledWith(newEmailmessage, Constants.VIST_PO_EMAIL_DYNAMIC);

		expect(emailResponse.emailSentDateTime).toEqual(expectedDateTime);
		expect(emailResponse.emailFailureMessage).toBe("");
		expect(mockIprService.sendToTXMA).toHaveBeenCalledTimes(1);
		expect(mockIprService.sendToTXMA).toHaveBeenCalledWith({
			event_name: "IPR_RESULT_NOTIFICATION_EMAILED",
			timestamp: absoluteTimeNow(),
			user: {
				email: "test.user@digital.cabinet-office.gov.uk",
				user_id: "user_id",
			},
			extensions: {
				previous_govuk_signin_journey_id: "sdfssg",
			},
		});
	});

	it.each([
		"documentType",
		"documentExpiryDate",
		"postOfficeVisitDetails",
		"postOfficeInfo",
	])("when session event record is missing necessary field %s required to send newEmail, then it falls back to sending oldEMail", async (attribute) => {
		const expectedDateTime = new Date().toISOString();
		const mockEmailResponse = new EmailResponse(expectedDateTime, "", 201);
		mockGovNotifyService.sendEmail.mockResolvedValue(mockEmailResponse);
		const eventBody = JSON.parse(sqsEventNewEmail.Records[0].body);
		const eventBodyMessage = eventBody.Message;
		eventBody.Message = eventBodyMessage;
		// @ts-ignore
		delete mockExtSessionEvent[attribute];
		// @ts-ignore
		mockIprService.getSessionBySub.mockReturnValue(mockExtSessionEvent);
		const newEmailmessage = DynamicEmail.parseRequest(JSON.stringify(eventBody.Message));
		const emailResponse = await sendEmailProcessorTest.processRequest(newEmailmessage);

		expect(mockIprService.getSessionBySub).toHaveBeenCalledTimes(1);
		expect(logger.info).toHaveBeenNthCalledWith(2, "Unable to process the DB record as the necessary fields to send the new template email are not populated, trying to send the old template email.", { "messageCode": "MISSING_NEW_PO_FIELDS_IN_SESSION_EVENT" });
		expect(mockGovNotifyService.sendEmail).toHaveBeenCalledWith(newEmailmessage, Constants.VIST_PO_EMAIL_STATIC);

		expect(emailResponse.emailSentDateTime).toEqual(expectedDateTime);
		expect(emailResponse.emailFailureMessage).toBe("");
		expect(mockIprService.sendToTXMA).toHaveBeenCalledTimes(1);
		expect(mockIprService.sendToTXMA).toHaveBeenCalledWith({
			event_name: "IPR_RESULT_NOTIFICATION_EMAILED",
			timestamp: absoluteTimeNow(),
			user: {
				email: "test.user@digital.cabinet-office.gov.uk",
				user_id: "user_id",
			},
			extensions: {
				previous_govuk_signin_journey_id: "sdfssg",
			},
		});
	});

});
