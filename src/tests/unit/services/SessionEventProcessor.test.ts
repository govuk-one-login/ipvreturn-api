/* eslint-disable @typescript-eslint/unbound-method */
import { Metrics } from "@aws-lambda-powertools/metrics";
import { Logger } from "@aws-lambda-powertools/logger";
import { SessionEventProcessor } from "../../../services/SessionEventProcessor";
import { mock } from "jest-mock-extended";
import { DynamoDBStreamEvent } from "aws-lambda";
import { VALID_DYNAMODB_STREAM_EVENT } from "../data/dynamodb-stream-record";
import { IPRService } from "../../../services/IPRService";
const { unmarshall } = require("@aws-sdk/util-dynamodb");

let sessionEventProcessorTest: SessionEventProcessor;
const mockIprService = mock<IPRService>();
const logger = mock<Logger>();
const metrics = new Metrics({ namespace: "F2F" });
let streamEvent: DynamoDBStreamEvent;
jest.spyOn(console, "log").mockImplementation(() => {});

describe("SessionEventProcessor", () => {
	beforeAll(() => {
		sessionEventProcessorTest = new SessionEventProcessor(logger, metrics);
		// @ts-ignore
		sessionEventProcessorTest.iprService = mockIprService;
		streamEvent = VALID_DYNAMODB_STREAM_EVENT;
	});

	beforeEach(() => {
		jest.clearAllMocks();
		streamEvent = VALID_DYNAMODB_STREAM_EVENT;
	});

	it("When all the necessary fields are populated in the session Event record, sends email and updates notified flag", async () => {
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
				messageType: "email",
			},
		});
		expect(mockIprService.saveEventData).toHaveBeenCalledWith(`${sessionEvent.userId}`, updateExpression, expressionAttributeValues);
		expect(logger.appendKeys).toHaveBeenCalledWith({ govuk_signin_journey_id: sessionEvent.clientSessionId });
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
	});

	it.each([
		"userEmail",
		"nameParts",
		"clientName",
		"redirectUri",
	])("Throws error when session event record is missing necessary attribute %s", async (attribute) => {
		const sessionEvent = unmarshall(streamEvent.Records[0].dynamodb?.NewImage);
		delete sessionEvent[attribute];
		await expect(sessionEventProcessorTest.processRequest(sessionEvent)).rejects.toThrow();
	});

	it.each([
		"userEmail",
		"nameParts",
		"clientName",
		"redirectUri",
	])("Throws error when session event record attribute %s is not correct type", async (attribute) => {
		const sessionEvent = unmarshall(streamEvent.Records[0].dynamodb?.NewImage);
		sessionEvent[attribute] = 0;
		await expect(sessionEventProcessorTest.processRequest(sessionEvent)).rejects.toThrow();
	});

	it("Throws error if failure to send to GovNotify queue", async () => {
		const sessionEvent = unmarshall(streamEvent.Records[0].dynamodb?.NewImage);
		mockIprService.sendToGovNotify.mockRejectedValueOnce("Failed to send to GovNotify Queue");
		await expect(sessionEventProcessorTest.processRequest(sessionEvent)).rejects.toThrow();
		expect(mockIprService.sendToGovNotify).toHaveBeenCalledTimes(1);
	});

	it("Throws error if failure to update the session event record with notified flag", async () => {
		const sessionEvent = unmarshall(streamEvent.Records[0].dynamodb?.NewImage);
		mockIprService.saveEventData.mockRejectedValueOnce("Error updating the session event record");
		await expect(sessionEventProcessorTest.processRequest(sessionEvent)).rejects.toThrow();
		expect(mockIprService.saveEventData).toHaveBeenCalledTimes(1);
	});
});
