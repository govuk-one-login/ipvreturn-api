import { Logger } from "@aws-lambda-powertools/logger";
import { SQSEvent } from "aws-lambda";
// @ts-ignore
import { NotifyClient } from "notifications-node-client";
import { VALID_GOV_NOTIFY_HANDLER_SQS_EVENT } from "../../data/sqs-events";
import { SendEmailProcessor } from "../../../services/SendEmailProcessor";
import { SendEmailService } from "../../../services/SendEmailService";
import { mock } from "jest-mock-extended";
import { EmailResponse } from "../../../models/EmailResponse";
import { Email } from "../../../models/Email";
import { AppError } from "../../../utils/AppError";
import { HttpCodesEnum } from "../../../models/enums/HttpCodesEnum";

const mockGovNotify = mock<NotifyClient>();
let sendEmailServiceTest: SendEmailService;
// pragma: allowlist nextline secret
const GOVUKNOTIFY_API_KEY = "sdhohofsdf";
const logger = mock<Logger>();
let sqsEvent: SQSEvent;

describe("SendEmailProcessor", () => {
	beforeAll(() => {
		sendEmailServiceTest = SendEmailService.getInstance(logger, GOVUKNOTIFY_API_KEY);
		// @ts-ignore
		sendEmailServiceTest.govNotify = mockGovNotify;
		sqsEvent = VALID_GOV_NOTIFY_HANDLER_SQS_EVENT;
	});

	beforeEach(() => {
		jest.clearAllMocks();
		sqsEvent = VALID_GOV_NOTIFY_HANDLER_SQS_EVENT;
	});

	it("Returns EmailResponse when email is sent successfully", async () => {
		const mockEmailResponse = new EmailResponse(new Date().toISOString(), "", 201);
		mockGovNotify.sendEmail.mockResolvedValue(mockEmailResponse);
		const eventBody = JSON.parse(sqsEvent.Records[0].body);
		const email = Email.parseRequest(JSON.stringify(eventBody.Message));
		const emailResponse = await sendEmailServiceTest.sendEmail(email);

		expect(mockGovNotify.sendEmail).toHaveBeenCalledTimes(1);
		expect(emailResponse.emailFailureMessage).toBe("");
	});

	it("SendEmailService fails and doesnt retry when GovNotify throws an error", async () => {
		mockGovNotify.sendEmail.mockRejectedValue( {
			"response": {
				"data": {
					"errors": [
						{
							"error": "BadRequestError",
							"message": "Can't send to this recipient using a team-only API key",
						},
					],
					"status_code": 400,
				},

			},
		});
		const eventBody = JSON.parse(sqsEvent.Records[0].body);
		const email = Email.parseRequest(JSON.stringify(eventBody.Message));
		await expect(sendEmailServiceTest.sendEmail(email)).rejects.toThrow();
		expect(mockGovNotify.sendEmail).toHaveBeenCalledTimes(1);
	});

	it("SendEmailService retries when GovNotify throws a 500 error", async () => {
		mockGovNotify.sendEmail.mockRejectedValue( {
			"response": {
				"data": {
					"errors": [
						{
							"error": "Exception",
							"message": "Internal server error",
						},
					],
					"status_code": 500,
				},

			},
		});

		const eventBody = JSON.parse(sqsEvent.Records[0].body);
		const email = Email.parseRequest(JSON.stringify(eventBody.Message));
		await expect(sendEmailServiceTest.sendEmail(email)).rejects.toThrow();
		expect(mockGovNotify.sendEmail).toHaveBeenCalledTimes(4);
	});

	it("SendEmailService retries when GovNotify throws a 429 error", async () => {
		mockGovNotify.sendEmail.mockRejectedValue( {
			"response": {
				"data": {
					"errors": [
						{
							"error": "TooManyRequestsError",
							"message": "Exceeded send limits (LIMIT NUMBER) for today",
						},
					],
					"status_code": 429,
				},

			},
		});

		const eventBody = JSON.parse(sqsEvent.Records[0].body);
		const email = Email.parseRequest(JSON.stringify(eventBody.Message));
		await expect(sendEmailServiceTest.sendEmail(email)).rejects.toThrow();
		expect(mockGovNotify.sendEmail).toHaveBeenCalledTimes(4);
	});

});
