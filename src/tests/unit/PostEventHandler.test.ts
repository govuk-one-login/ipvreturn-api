import { mock } from "jest-mock-extended";
import { lambdaHandler } from "../../PostEventHandler";
import { PostEventProcessor } from "../../services/PostEventProcessor";
import { VALID_AUTH_IPV_AUTHORISATION_REQUESTED_SQS_EVENT } from "../data/sqs-events";
import { AppError } from "../../utils/AppError";
import { HttpCodesEnum } from "../../models/enums/HttpCodesEnum";

const mockPostEventProcessor = mock<PostEventProcessor>();

jest.mock("../../services/PostEventProcessor", () => {
	return {
		PostEventProcessor: jest.fn(() => mockPostEventProcessor),
	};
});

jest.mock("../../utils/Config", () => {
	return {
		getParameter: jest.fn(() => {return "dgsdgsg";}),
	};
});
describe("PostEventHandler", () => {
	it("returns success response", async () => {
		PostEventProcessor.getInstance = jest.fn().mockReturnValue(mockPostEventProcessor);
		await lambdaHandler(VALID_AUTH_IPV_AUTHORISATION_REQUESTED_SQS_EVENT, "IPR");

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockPostEventProcessor.processRequest).toHaveBeenCalledTimes(1);
	});

	it("returns Bad request when number of records in the SQS message is more than 1", async () => {
		const event = { "Records": [] };
		const response = await lambdaHandler(event, "IPR");
		expect(response.batchItemFailures).toEqual([]);
	});

	it("errors when postEvent processor throws AppError", async () => {
		PostEventProcessor.getInstance = jest.fn().mockImplementation(() => {
			throw new AppError(HttpCodesEnum.SERVER_ERROR, "Missing event config");
		});
		const response = await lambdaHandler(VALID_AUTH_IPV_AUTHORISATION_REQUESTED_SQS_EVENT, "IPR");
		expect(response.batchItemFailures).toEqual([]);
	});
});
