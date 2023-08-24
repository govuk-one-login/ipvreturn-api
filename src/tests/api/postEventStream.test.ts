import {
	VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT,
	VALID_IPV_F2F_CRI_VC_CONSUMED_TXMA_EVENT,
	VALID_F2F_YOTI_START_TXMA_EVENT,
} from "../data/sqs-events";
import "dotenv/config";
import { randomUUID } from "crypto";
import { constants } from "./utils/ApiConstants";
import { postMockEvent, getSessionByUserId } from "./utils/ApiTestSteps";


describe("post event processor", () => {
	let userId : string;

	beforeAll(() => {
		userId = randomUUID();
		console.log("userId: ", userId);
	});

	it("when all 3 events are sent, a Dynamo record with the details of all three events populated", async () => {
    	await postMockEvent(VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT, userId, true);
		await postMockEvent(VALID_F2F_YOTI_START_TXMA_EVENT, userId, false);
		await postMockEvent(VALID_IPV_F2F_CRI_VC_CONSUMED_TXMA_EVENT, userId, false);

		const response = await getSessionByUserId(userId, constants.API_TEST_SESSION_EVENTS_TABLE!);

		expect(response?.notified).toBe(true);
		expect(response?.nameParts).toEqual([
			{
				M: {
					type: {
						S: "GivenName",
					},
					value: {
						S: "ANGELA",
					},
				},
			},
			{
				M: {
					type: {
						S: "GivenName",
					},
					value: {
						S: "ZOE",
					},
				},
			},
			{
				M: {
					type: {
						S: "FamilyName",
					},
					value: {
						S: "UK SPECIMEN",
					},
				},
			},
		]);
		expect(response?.clientName).toBe("ekwU");
		expect(response?.redirectUri).toBe("REDIRECT_URL");
		expect(response?.userEmail).toBe(constants.API_TEST_EMAIL_ADDRESS);
	}, 10000); // timeout set to 10s to avoid infinite loop
});
