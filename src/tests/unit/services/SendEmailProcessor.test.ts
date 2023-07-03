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

let sendEmailProcessorTest: SendEmailProcessor;
const mockGovNotifyService = mock<SendEmailService>();
const mockIprService = mock<IPRService>();
// pragma: allowlist nextline secret
const GOVUKNOTIFY_API_KEY = "sdhohofsdf";
const SESSION_EVENTS_TABLE = "session-table";
const logger = mock<Logger>();
const metrics = new Metrics({ namespace: "IPR" });
let sqsEvent: SQSEvent;

describe("SendEmailProcessor", () => {
	beforeAll(() => {
		sendEmailProcessorTest = new SendEmailProcessor(logger, metrics, GOVUKNOTIFY_API_KEY, SESSION_EVENTS_TABLE);
		// @ts-ignore
		sendEmailProcessorTest.govNotifyService = mockGovNotifyService;
		// @ts-ignore
		sendEmailProcessorTest.iprService = mockIprService;
		sqsEvent = VALID_SQS_EVENT;
	});

	beforeEach(() => {
		jest.clearAllMocks();
		sqsEvent = VALID_SQS_EVENT;
	});

	it("Returns success response when all required Email attributes exists", async () => {
		const expectedDateTime = new Date().toISOString();
		const mockEmailResponse = new EmailResponse(expectedDateTime, "", 201);
		mockGovNotifyService.sendEmail.mockResolvedValue(mockEmailResponse);
		const eventBody = JSON.parse(sqsEvent.Records[0].body);
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

});
