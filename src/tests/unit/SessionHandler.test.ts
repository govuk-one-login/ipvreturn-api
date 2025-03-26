import { lambdaHandler } from "../../SessionHandler";
import { VALID_SESSION, INVALID_SESSION } from "./data/session-events";
import { SessionProcessor } from "../../services/SessionProcessor";
import { mock } from "jest-mock-extended";

const mockedSessionProcessor = mock<SessionProcessor>();
jest.mock("../../utils/Config", () => {
	return {
		getParameter: jest.fn(() => {return "client-id";}),
	};
});

describe("SessionHandler", () => {
	it("returns an not found response for an invalid resource request", async () => {
		const response = await lambdaHandler(INVALID_SESSION, "IPR");
		expect(response.statusCode).toBe(404);
		expect(response.body).toBe("Resource not found");
	});

	it("returns success response for a valid request payload", async () => {
		SessionProcessor.getInstance = jest.fn().mockReturnValue(mockedSessionProcessor);
		mockedSessionProcessor.processRequest.mockResolvedValue({ statusCode: 200, body: JSON.stringify({ message: "Success" }) });
		const response = await lambdaHandler(VALID_SESSION, "IPR");

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockedSessionProcessor.processRequest).toHaveBeenCalledTimes(1);
		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body)).toEqual({ message: "Success" });
	});
});
