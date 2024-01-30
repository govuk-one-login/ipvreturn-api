import govNotifyRequestData from "../data/govNotifyStubPayload.json";
import { postGovNotifyRequest } from "./utils/ApiTestSteps";

describe("GovNotify Endpoint /v2/notifications/email", () => {
	const responseCodes = [
		[400],
		[403],
		[429],
		[500],
		[201],
	];
	it.each(responseCodes)("GovNotify - expect '%i' response on POST/v2/notifications/email", async (govNotifyDelimitator) => {
		const response = await postGovNotifyRequest(govNotifyDelimitator, govNotifyRequestData);

		expect(response.status).toBe(govNotifyDelimitator);
	});
});
