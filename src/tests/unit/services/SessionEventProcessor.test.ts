import { Metrics } from "@aws-lambda-powertools/metrics";
import { Logger } from "@aws-lambda-powertools/logger";
import { SessionEventProcessor } from "../../../services/SessionEventProcessor";
import { mock } from "jest-mock-extended";
import { DynamoDBStreamEvent } from "aws-lambda";
import { VALID_DYNAMODB_STREAM_EVENT } from "../data/dynamodb-stream-record";
import { HttpCodesEnum } from "../../../models/enums/HttpCodesEnum";
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

	it("Returns success response when all the necessary fields are populated in the session Event record", async () => {
		const sessionEvent = unmarshall(streamEvent.Records[0].dynamodb?.NewImage);
		const response = await sessionEventProcessorTest.processRequest(sessionEvent);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockIprService.sendToGovNotify).toHaveBeenCalledTimes(1);
		expect(mockIprService.sendToGovNotify).toHaveBeenCalledWith({
			Message: {
				emailAddress: "bhavana.hemanth@digital.cabinet-office.gov.uk",
				firstName: "ANGELA",
				lastName: "UK SPECIMEN",
				messageType: "email",
			},
		});
		const updateExpression = "SET notified = :notified";
		const expressionAttributeValues = {
			":notified": true,
		};
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockIprService.saveEventData).toHaveBeenCalledWith(`${sessionEvent.userId}`, updateExpression, expressionAttributeValues);
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
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockIprService.sendToGovNotify).toHaveBeenCalledTimes(1);
	});

	it("Throws error if failure to update the session event record with notified flag", async () => {
		const sessionEvent = unmarshall(streamEvent.Records[0].dynamodb?.NewImage);
		mockIprService.saveEventData.mockRejectedValueOnce("Error updating the session event record");
		await expect(sessionEventProcessorTest.processRequest(sessionEvent)).rejects.toThrow();
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockIprService.saveEventData).toHaveBeenCalledTimes(1);
	});

});
