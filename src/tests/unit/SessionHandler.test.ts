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
	it("returns success response for a valid request payload", async () => {
		SessionProcessor.getInstance = jest.fn().mockReturnValue(mockedSessionProcessor);
		const response = await lambdaHandler(VALID_SESSION, "IPR");

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockedSessionProcessor.processRequest).toHaveBeenCalledTimes(1);
	});
});
