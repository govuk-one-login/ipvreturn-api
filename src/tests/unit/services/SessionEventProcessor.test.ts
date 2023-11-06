/* eslint-disable @typescript-eslint/unbound-method */
import { Metrics } from "@aws-lambda-powertools/metrics";
import { Logger } from "@aws-lambda-powertools/logger";
import { SessionEventProcessor } from "../../../services/SessionEventProcessor";
import { mock } from "jest-mock-extended";
import { DynamoDBStreamEvent } from "aws-lambda";
import { VALID_DYNAMODB_STREAM_EVENT, VALID_DYNAMODB_STREAM_EVENT_WITH_PO_DETAILS } from "../data/dynamodb-stream-record";
import { IPRService } from "../../../services/IPRService";
import { Constants } from "../../../utils/Constants";
const { unmarshall } = require("@aws-sdk/util-dynamodb");

let sessionEventProcessorTest: SessionEventProcessor;
const mockIprService = mock<IPRService>();
const mockLogger = mock<Logger>();
const metrics = new Metrics({ namespace: "F2F" });
let streamEvent: DynamoDBStreamEvent;
let streamEventWithPoDetails: DynamoDBStreamEvent;
jest.spyOn(console, "log").mockImplementation(() => {});

describe("SessionEventProcessor", () => {
	beforeAll(() => {
		sessionEventProcessorTest = new SessionEventProcessor(mockLogger, metrics);
		// @ts-ignore
		sessionEventProcessorTest.iprService = mockIprService;
		streamEvent = VALID_DYNAMODB_STREAM_EVENT;
		streamEventWithPoDetails = VALID_DYNAMODB_STREAM_EVENT_WITH_PO_DETAILS;
	});

	beforeEach(() => {
		jest.clearAllMocks();
		streamEvent = VALID_DYNAMODB_STREAM_EVENT;
		streamEventWithPoDetails = VALID_DYNAMODB_STREAM_EVENT_WITH_PO_DETAILS;
	});

	it("When all the necessary fields are populated in the session Event record, sends static email and updates notified flag", async () => {
		const sessionEvent = unmarshall(streamEvent.Records[0].dynamodb?.NewImage);
		const updateExpression = "SET notified = :notified";
		const expressionAttributeValues = {
			":notified": true,
		};

		await sessionEventProcessorTest.processRequest(sessionEvent);

		expect(mockIprService.sendToGovNotify).toHaveBeenCalledTimes(1);
		expect(mockIprService.sendToGovNotify).toHaveBeenCalledWith({
			Message: {
				userId: "01333e01-dde3-412f-a484-4444",
				emailAddress: "test.user@digital.cabinet-office.gov.uk",
				firstName: "ANGELA",
				lastName: "UK SPECIMEN",
				messageType: Constants.VIST_PO_EMAIL_STATIC,
			},
		});
		expect(mockIprService.saveEventData).toHaveBeenCalledWith(`${sessionEvent.userId}`, updateExpression, expressionAttributeValues);
		expect(mockLogger.appendKeys).toHaveBeenCalledWith({ govuk_signin_journey_id: sessionEvent.clientSessionId });
		expect(mockLogger.appendKeys).toHaveBeenCalledWith({ govuk_signin_journey_id: sessionEvent.clientSessionId });
	});

	it("Throws error when session event record is already processed and user is notified via email", async () => {
		const sessionEvent = unmarshall(streamEvent.Records[0].dynamodb?.NewImage);
		sessionEvent.notified = true;
		await expect(sessionEventProcessorTest.processRequest(sessionEvent)).rejects.toThrow();
	});

	it.each([
		"journeyWentAsyncOn",
		"ipvStartedOn",
		"readyToResumeOn",
	])("Throws error when session event record is missing necessary Event timestamps fields", async (attribute) => {
		const sessionEvent = unmarshall(streamEvent.Records[0].dynamodb?.NewImage);
		delete sessionEvent[attribute];
		await expect(sessionEventProcessorTest.processRequest(sessionEvent)).rejects.toThrow();
		expect(mockLogger.warn).toHaveBeenNthCalledWith(1, `${attribute} is not yet populated, unable to process the DB record.`, { "messageCode": "MISSING_MANDATORY_FIELDS_IN_SESSION_EVENT" });
	});

	it.each([
		"nameParts",
		"clientName",
		"redirectUri",
	])("Sends fallback template email if missing mandatory attribute %s", async (attribute) => {
		const sessionEvent = unmarshall(streamEvent.Records[0].dynamodb?.NewImage);
		delete sessionEvent[attribute];

		const updateExpression = "SET notified = :notified";
		const expressionAttributeValues = {
			":notified": true,
		};

		await sessionEventProcessorTest.processRequest(sessionEvent);

		expect(mockIprService.sendToGovNotify).toHaveBeenCalledTimes(1);
		expect(mockIprService.sendToGovNotify).toHaveBeenCalledWith({
			Message: {
				userId: "01333e01-dde3-412f-a484-4444",
				emailAddress: "test.user@digital.cabinet-office.gov.uk",
				messageType: Constants.VISIT_PO_EMAIL_FALLBACK,
			},
		});
		expect(mockIprService.saveEventData).toHaveBeenCalledWith(`${sessionEvent.userId}`, updateExpression, expressionAttributeValues);
		expect(mockLogger.appendKeys).toHaveBeenCalledWith({ govuk_signin_journey_id: sessionEvent.clientSessionId });
	});

	it.each([
		"nameParts",
		"clientName",
		"redirectUri",
	])("Sends fallback template email when session event record attribute %s is not correct type", async (attribute) => {
		const sessionEvent = unmarshall(streamEvent.Records[0].dynamodb?.NewImage);
		sessionEvent[attribute] = 0;
		const updateExpression = "SET notified = :notified";
		const expressionAttributeValues = {
			":notified": true,
		};

		await sessionEventProcessorTest.processRequest(sessionEvent);

		expect(mockIprService.sendToGovNotify).toHaveBeenCalledTimes(1);
		expect(mockIprService.sendToGovNotify).toHaveBeenCalledWith({
			Message: {
				userId: "01333e01-dde3-412f-a484-4444",
				emailAddress: "test.user@digital.cabinet-office.gov.uk",
				messageType: Constants.VISIT_PO_EMAIL_FALLBACK,
			},
		});
		expect(mockIprService.saveEventData).toHaveBeenCalledWith(`${sessionEvent.userId}`, updateExpression, expressionAttributeValues);
		expect(mockLogger.appendKeys).toHaveBeenCalledWith({ govuk_signin_journey_id: sessionEvent.clientSessionId });
	});

	it("Throws error if failure to send to GovNotify queue", async () => {
		const sessionEvent = unmarshall(streamEvent.Records[0].dynamodb?.NewImage);
		mockIprService.sendToGovNotify.mockRejectedValueOnce("Failed to send to GovNotify Queue");
		await expect(sessionEventProcessorTest.processRequest(sessionEvent)).rejects.toThrow();
		expect(mockIprService.sendToGovNotify).toHaveBeenCalledTimes(1);
		expect(mockLogger.error).toHaveBeenNthCalledWith(1, "FAILED_TO_WRITE_GOV_NOTIFY", { "error": "Failed to send to GovNotify Queue", "reason": "Processing Event session data, failed to post VIST_PO_EMAIL_STATIC type message to GovNotify SQS Queue" }, { "messageCode": "FAILED_TO_WRITE_GOV_NOTIFY_SQS" });

	});

	it("Throws error if failure to update the session event record with notified flag", async () => {
		const sessionEvent = unmarshall(streamEvent.Records[0].dynamodb?.NewImage);
		mockIprService.saveEventData.mockRejectedValueOnce("Error updating the session event record");
		await expect(sessionEventProcessorTest.processRequest(sessionEvent)).rejects.toThrow();
		expect(mockIprService.saveEventData).toHaveBeenCalledTimes(1);
	});

	it("Returns success response when all the necessary fields to send new template email are populated in the session Event record", async () => {
		const sessionEvent = unmarshall(streamEventWithPoDetails.Records[0].dynamodb?.NewImage);
		await sessionEventProcessorTest.processRequest(sessionEvent);
		expect(mockIprService.sendToGovNotify).toHaveBeenCalledTimes(1);
		expect(mockIprService.sendToGovNotify).toHaveBeenCalledWith({
			Message: {
				userId: "01333e01-dde3-412f-a484-4444",
				emailAddress: "test.user@digital.cabinet-office.gov.uk",
				firstName: "ANGELA",
				lastName: "UK SPECIMEN",
				documentExpiryDate: "2030-01-01",
				documentType: "PASSPORT",
				poAddress: "1 The Street, Funkytown N1 2AA",
    			poVisitDate: "1985-01-25",
    			poVisitTime: "1688477191",
				messageType: Constants.VIST_PO_EMAIL_DYNAMIC,

			},
		});
		const updateExpression = "SET notified = :notified";
		const expressionAttributeValues = {
			":notified": true,
		};
		expect(mockIprService.saveEventData).toHaveBeenCalledWith(`${sessionEvent.userId}`, updateExpression, expressionAttributeValues);
	});

	it("Logs Info message when session event record is missing documentUploadedOn field and hence sending static template email", async () => {
		const sessionEvent = unmarshall(streamEventWithPoDetails.Records[0].dynamodb?.NewImage);
		delete sessionEvent.documentUploadedOn;
		await sessionEventProcessorTest.processRequest(sessionEvent);
		expect(mockLogger.info).toHaveBeenNthCalledWith(1, { "message":"documentUploadedOn is not yet populated, sending the static template email." });
		expect(mockIprService.sendToGovNotify).toHaveBeenCalledTimes(1);
		expect(mockIprService.sendToGovNotify).toHaveBeenCalledWith({
			Message: {
				userId: "01333e01-dde3-412f-a484-4444",
				emailAddress: "test.user@digital.cabinet-office.gov.uk",
				firstName: "ANGELA",
				lastName: "UK SPECIMEN",
				messageType: Constants.VIST_PO_EMAIL_STATIC,
			},
		});
		const updateExpression = "SET notified = :notified";
		const expressionAttributeValues = {
			":notified": true,
		};
		expect(mockIprService.saveEventData).toHaveBeenCalledWith(`${sessionEvent.userId}`, updateExpression, expressionAttributeValues);
	});

	it.each([
		"documentType",
		"documentExpiryDate",
		"postOfficeVisitDetails",
		"postOfficeInfo",
	])("Logs Info message when session event record is missing necessary attribute -  %s, to send new template email and hence falls back to sending static template email", async (attribute) => {
		const sessionEvent = unmarshall(streamEventWithPoDetails.Records[0].dynamodb?.NewImage);
		delete sessionEvent[attribute];
		await sessionEventProcessorTest.processRequest(sessionEvent);	
		expect(mockLogger.info).toHaveBeenNthCalledWith(1, "Unable to process the DB record as the necessary fields to send the dynamic template email are not populated, trying to send the static template email.", { "messageCode": "MISSING_NEW_PO_FIELDS_IN_SESSION_EVENT" });
		expect(mockIprService.sendToGovNotify).toHaveBeenCalledTimes(1);
		expect(mockIprService.sendToGovNotify).toHaveBeenCalledWith({
			Message: {
				userId: "01333e01-dde3-412f-a484-4444",
				emailAddress: "test.user@digital.cabinet-office.gov.uk",
				firstName: "ANGELA",
				lastName: "UK SPECIMEN",
				messageType: Constants.VIST_PO_EMAIL_STATIC,
			},
		});
		const updateExpression = "SET notified = :notified";
		const expressionAttributeValues = {
			":notified": true,
		};
		expect(mockIprService.saveEventData).toHaveBeenCalledWith(`${sessionEvent.userId}`, updateExpression, expressionAttributeValues);
	});

});
