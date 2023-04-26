import { Logger } from "@aws-lambda-powertools/logger";
import { SQSEvent } from "aws-lambda";
// @ts-ignore
import { NotifyClient } from "notifications-node-client";
import { VALID_SQS_EVENT } from "../data/sqs-events";
import { SendEmailProcessor } from "../../../services/SendEmailProcessor";
import { SendEmailService } from "../../../services/SendEmailService";
import { mock } from "jest-mock-extended";
import { EmailResponse } from "../../../models/EmailResponse";
import { Email } from "../../../models/Email";
import { AppError } from "../../../utils/AppError";
import {HttpCodesEnum} from "../../../models/enums/HttpCodesEnum";

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
		sqsEvent = VALID_SQS_EVENT;
	});

	beforeEach(() => {
		jest.clearAllMocks();
		sqsEvent = VALID_SQS_EVENT;
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

	it("SendEmailService fails when GovNotify throws an error", async () => {
		mockGovNotify.sendEmail.mockImplementation(() => {
			throw new AppError(HttpCodesEnum.BAD_REQUEST, "Using team-only API key");
		});
		const eventBody = JSON.parse(sqsEvent.Records[0].body);
		const email = Email.parseRequest(JSON.stringify(eventBody.Message));
		await expect(sendEmailServiceTest.sendEmail(email)).rejects.toThrow();
	});

});
