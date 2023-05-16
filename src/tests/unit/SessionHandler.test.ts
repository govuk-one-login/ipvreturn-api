import { lambdaHandler } from "../../SessionHandler";
import { VALID_SESSION, INVALID_SESSION } from "./data/session-events";

describe("SessionEventHandler", () => {
	it("returns success response for a valid reqiest payload", async () => {
		const response = await lambdaHandler(VALID_SESSION, "IPR");
		expect(response.statusCode).toBe(200);
		expect(response.body).toBe("OK");
	});

	it("returns an not found response for an invalid resource request", async () => {
		const response = await lambdaHandler(INVALID_SESSION, "IPR");
		expect(response.statusCode).toBe(404);
		expect(response.body).toBe("Resource not found");
	});
});
