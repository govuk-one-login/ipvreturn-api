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
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockedSessionEventProcessor.processRequest).toHaveBeenCalledTimes(1);
	});

	it("returns Bad request when number of records in the DynamoDBStreamEvent is not equal to 1", async () => {
		const event = { "Records": [] };
		const response = await lambdaHandler(event, "IPR");
		expect(response.statusCode).toEqual(HttpCodesEnum.BAD_REQUEST);
		expect(response.body).toBe("Unexpected no of records received");
	});

	it("errors when stream processor throws AppError", async () => {
		SessionEventProcessor.getInstance = jest.fn().mockImplementation(() => {
			throw new AppError(HttpCodesEnum.SERVER_ERROR, "");
		});
		const response = await lambdaHandler(VALID_DYNAMODB_STREAM_EVENT, "IPR");
		expect(response.statusCode).toEqual(HttpCodesEnum.SERVER_ERROR);
		expect(response.body).toBe("An error has occurred");

	});

	it("logs message when the record eventName doesnt match MODIFY state", async () => {
		const event = VALID_DYNAMODB_STREAM_EVENT;
		//Update the eventName to be INSERT
		event.Records[0].eventName = EventNameEnum.INSERT;
		const response = await lambdaHandler(event, "IPR");
		expect(response.statusCode).toEqual(HttpCodesEnum.UNPROCESSABLE_ENTITY);
		expect(response.body).toBe("Record eventName doesnt match MODIFY state");
	});

});
