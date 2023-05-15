import {lambdaHandler} from "../../SessionHandler";
import {VALID_SESSION, INVALID_SESSION} from "./data/session-events";

describe("SessionEventHandler", () => {
  it ("returns success response for a valid reqiest payload", async () => {
    const response = await lambdaHandler(VALID_SESSION, "IPR");
    expect(response.statusCode).toEqual(200);
    expect(response.body).toEqual("OK");
  });

  it("returns an not found response for an invalid resource request", async () => {
    const response = await lambdaHandler(INVALID_SESSION, "IPR");
    expect(response.statusCode).toEqual(404);
    expect(response.body).toEqual("Resource not found");
  });
});
