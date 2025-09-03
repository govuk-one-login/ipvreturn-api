import { mock } from "jest-mock-extended";
import { lambdaHandler } from "../../StreamProcessorHandler";
import { HttpCodesEnum } from "../../models/enums/HttpCodesEnum";
import { SessionEventProcessor } from "../../services/SessionEventProcessor";
import { POFailureEventProcessor } from "../../services/POFailureEventProcessor";
import { EventNameEnum, VALID_DYNAMODB_STREAM_EVENT, VALID_DYNAMODB_STREAM_EVENT_PO_FAILURE } from "./data/dynamodb-stream-record";
import { AppError } from "../../utils/AppError";

const mockedSessionEventProcessor = mock<SessionEventProcessor>();
const mockedPOFailureEventProcessor = mock<POFailureEventProcessor>();

describe("StreamProcessorHandler", () => {
	it("return success response for streamProcessor", async () => {
		SessionEventProcessor.getInstance = jest.fn().mockReturnValue(mockedSessionEventProcessor);
		await lambdaHandler(VALID_DYNAMODB_STREAM_EVENT, "IPR");
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockedSessionEventProcessor.processRequest).toHaveBeenCalledTimes(1);
	});

	it("returns Bad request when number of records in the DynamoDBStreamEvent is not equal to 1", async () => {
		const event = { "Records": [] };
		const response = await lambdaHandler(event, "IPR");
		expect(response).toEqual({ "batchItemFailures": [] });
	});

	it("errors when stream processor throws AppError", async () => {
		SessionEventProcessor.getInstance = jest.fn().mockImplementation(() => {
			throw new AppError(HttpCodesEnum.SERVER_ERROR, "");
		});
		const response = await lambdaHandler(VALID_DYNAMODB_STREAM_EVENT, "IPR");
		expect(response).toEqual({ "batchItemFailures": [] });
	});

	it("logs message when the record eventName doesnt match MODIFY state", async () => {
		const event = VALID_DYNAMODB_STREAM_EVENT;
		//Update the eventName to be INSERT
		event.Records[0].eventName = EventNameEnum.INSERT;
		const response = await lambdaHandler(event, "IPR");
		expect(response).toEqual({ "batchItemFailures": [] });
	});

	it("return success response for POFailureEventProcessor", async () => {
		POFailureEventProcessor.getInstance = jest.fn().mockReturnValue(mockedPOFailureEventProcessor);
		await lambdaHandler(VALID_DYNAMODB_STREAM_EVENT_PO_FAILURE, "IPR");
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockedPOFailureEventProcessor.processRequest).toHaveBeenCalledTimes(1);
	});
});
