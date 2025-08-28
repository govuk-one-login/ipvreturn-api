import { mock } from "jest-mock-extended";
import { lambdaHandler } from "../../StreamProcessorHandler";
import { HttpCodesEnum } from "../../models/enums/HttpCodesEnum";
import { SessionEventProcessor } from "../../services/SessionEventProcessor";
import { EventNameEnum, VALID_DYNAMODB_STREAM_EVENT } from "./data/dynamodb-stream-record";
import { AppError } from "../../utils/AppError";

const mockedSessionEventProcessor = mock<SessionEventProcessor>();

describe("StreamProcessorHandler", () => {
	it("return success response for streamProcessor", async () => {
		SessionEventProcessor.getInstance = jest.fn().mockReturnValue(mockedSessionEventProcessor);
		await lambdaHandler(VALID_DYNAMODB_STREAM_EVENT, "IPR");
		 
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

});
