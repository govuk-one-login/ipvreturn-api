import { Logger } from "@aws-lambda-powertools/logger";
import { SQSEvent } from "aws-lambda";
// @ts-ignore
import { NotifyClient } from "notifications-node-client";
import { VALID_GOV_NOTIFY_HANDLER_SQS_EVENT, VALID_GOV_NOTIFY_HANDLER_SQS_EVENT_DYNAMIC_EMAIL } from "../../data/sqs-events";
import { SendEmailService } from "../../../services/SendEmailService";
import { mock } from "jest-mock-extended";
import { EmailResponse } from "../../../models/EmailResponse";
import { Email, DynamicEmail } from "../../../models/Email";
import { Constants } from "../../../utils/Constants";

const mockGovNotify = mock<NotifyClient>();
let sendEmailServiceTest: SendEmailService;
// pragma: allowlist nextline secret
const GOVUKNOTIFY_API_KEY = "sdhohofsdf";
const logger = mock<Logger>();
let sqsEvent: SQSEvent;
let sqsEventNewEmail: SQSEvent;

describe("SendEmailProcessor", () => {
	beforeAll(() => {
		sendEmailServiceTest = SendEmailService.getInstance(logger, GOVUKNOTIFY_API_KEY, "serviceId");
		// @ts-ignore
		sendEmailServiceTest.govNotify = mockGovNotify;
		sqsEvent = VALID_GOV_NOTIFY_HANDLER_SQS_EVENT;
		sqsEventNewEmail = VALID_GOV_NOTIFY_HANDLER_SQS_EVENT_DYNAMIC_EMAIL;
	});

	beforeEach(() => {
		jest.clearAllMocks();
		sqsEvent = VALID_GOV_NOTIFY_HANDLER_SQS_EVENT;
		sqsEventNewEmail = VALID_GOV_NOTIFY_HANDLER_SQS_EVENT_DYNAMIC_EMAIL;
	});

	it("Returns EmailResponse when oldEmail is sent successfully", async () => {
		const mockEmailResponse = new EmailResponse(new Date().toISOString(), "", 201);
		mockGovNotify.sendEmail.mockResolvedValue(mockEmailResponse);
		const eventBody = JSON.parse(sqsEvent.Records[0].body);
		const email = Email.parseRequest(JSON.stringify(eventBody.Message));
		const emailResponse = await sendEmailServiceTest.sendEmail(email, Constants.VIST_PO_EMAIL_STATIC);

		expect(mockGovNotify.sendEmail).toHaveBeenCalledWith("old-template-id", "test.user@digital.cabinet-office.gov.uk", {
    		"personalisation": {
				"first name": "Frederick",
				"last name": "Flintstone",
				"return_journey_URL": "www.test.com/return_journey_url",
			},
    		reference: expect.anything(),
    	});

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
		await expect(sendEmailServiceTest.sendEmail(email, Constants.VIST_PO_EMAIL_STATIC)).rejects.toThrow();
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
		await expect(sendEmailServiceTest.sendEmail(email, Constants.VIST_PO_EMAIL_STATIC)).rejects.toThrow();
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
		await expect(sendEmailServiceTest.sendEmail(email, Constants.VIST_PO_EMAIL_STATIC)).rejects.toThrow();
		expect(mockGovNotify.sendEmail).toHaveBeenCalledTimes(4);
	});

	it("Returns EmailResponse when newEmail is sent successfully", async () => {
		const mockEmailResponse = new EmailResponse(new Date().toISOString(), "", 201);
		mockGovNotify.sendEmail.mockResolvedValue(mockEmailResponse);
		const eventBody = JSON.parse(sqsEventNewEmail.Records[0].body);
		const newEmail = DynamicEmail.parseRequest(JSON.stringify(eventBody.Message));
		const emailResponse = await sendEmailServiceTest.sendEmail(newEmail, Constants.VIST_PO_EMAIL_DYNAMIC);

		expect(mockGovNotify.sendEmail).toHaveBeenCalledWith("new-template-id", "test.user@digital.cabinet-office.gov.uk", {
    		"personalisation": {
				"first name": "Frederick",
				"last name": "Flintstone",
				"return_journey_URL": "www.test.com/return_journey_url",
				"branch_name_and_address": "1 The Street, Funkytown N1 2AA",
				"chosen_photo_ID": "passport",
				"date": "7 September 2023",
				"time": "4:43pm",
				"id_expiry_date": "21 November 2030",
			},
    		reference: expect.anything(),
    	});

		expect(mockGovNotify.sendEmail).toHaveBeenCalledTimes(1);
		expect(emailResponse.emailFailureMessage).toBe("");
	});

});
