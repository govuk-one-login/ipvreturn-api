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
				messageType: "email"
			}
		});
		const updateExpression = "SET notified = :notified";
		const expressionAttributeValues = {
			":notified": true,
		};
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockIprService.saveEventData).toHaveBeenCalledWith(`${sessionEvent.userId}`, updateExpression, expressionAttributeValues);
		expect(response.statusCode).toBe(HttpCodesEnum.OK);
		expect(response.body).toBe("Success");
	});

	it("Throws error when session event record is already processed and user is notified via email", async () => {
		const sessionEvent = unmarshall(streamEvent.Records[0].dynamodb?.NewImage);
		sessionEvent.notified = true;
		const response = await sessionEventProcessorTest.processRequest(sessionEvent);

		expect(response.statusCode).toBe(HttpCodesEnum.SERVER_ERROR);
		expect(response.body).toBe("User is already notified for this session event.");
	});

	it.each([
		"journeyWentAsyncOn",
		"ipvStartedOn",
		"readyToResumeOn",
	])("Throws error when session event record is missing necessary Event timestamps fields", async (attribute) => {
		const sessionEvent = unmarshall(streamEvent.Records[0].dynamodb?.NewImage);
		delete sessionEvent[attribute];
		const response = await sessionEventProcessorTest.processRequest(sessionEvent);

		expect(response.statusCode).toBe(HttpCodesEnum.SERVER_ERROR);
		expect(response.body).toBe(`${attribute} is not yet populated for userId: ${sessionEvent.userId}, unable to process the DB record.`);

	});

	it.each([
		"userEmail",
		"clientName",
		"redirectUri",
	])("Throws error when session event record is missing necessary attributes", async (attribute) => {
		const sessionEvent = unmarshall(streamEvent.Records[0].dynamodb?.NewImage);
		delete sessionEvent[attribute];
		const response = await sessionEventProcessorTest.processRequest(sessionEvent);

		expect(response.statusCode).toBe(HttpCodesEnum.SERVER_ERROR);
		expect(response.body).toBe(`Unable to process the DB record as the necessary fields are not populated for userId: ${sessionEvent.userId}`);
	});

	it("Throws error if failure to send to GovNotify queue", async () => {
		const sessionEvent = unmarshall(streamEvent.Records[0].dynamodb?.NewImage);
		mockIprService.sendToGovNotify.mockRejectedValueOnce("Failed to send to GovNotify Queue");
		const response = await sessionEventProcessorTest.processRequest(sessionEvent);

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockIprService.sendToGovNotify).toHaveBeenCalledTimes(1);
		expect(response.statusCode).toBe(HttpCodesEnum.SERVER_ERROR);
		expect(response.body).toBe("An error occurred when sending message to GovNotify handler");
	});

	it("Throws error if failure to update the session event record with notified flag", async () => {
		const sessionEvent = unmarshall(streamEvent.Records[0].dynamodb?.NewImage);
		mockIprService.saveEventData.mockRejectedValueOnce("Error updating the session event record");
		const response = await sessionEventProcessorTest.processRequest(sessionEvent);

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockIprService.saveEventData).toHaveBeenCalledTimes(1);
		expect(response.statusCode).toBe(HttpCodesEnum.SERVER_ERROR);
	});

});
