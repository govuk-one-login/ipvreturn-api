import {
	VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT,
	VALID_IPV_F2F_CRI_VC_CONSUMED_WITH_DOC_EXPIRYDATE_TXMA_EVENT,
	VALID_F2F_YOTI_START_WITH_PO_DOC_DETAILS_TXMA_EVENT,
	VALID_F2F_DOCUMENT_UPLOADED_TXMA_EVENT,
} from "../data/sqs-events";
import "dotenv/config";
import { randomUUID } from "crypto";
import { constants } from "./utils/ApiConstants";
import { postMockEvent, getSessionByUserId } from "./utils/ApiTestSteps";

describe("post event processor", () => {
	jest.setTimeout(60000);
	let userId : string;

	beforeAll(() => {
		userId = randomUUID();
		console.log("userId: ", userId);
	});

	it("when all 3 events are sent, a Dynamo record with the details of all three events populated", async () => {
		await postMockEvent(VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT, userId, true);
		await postMockEvent(VALID_F2F_YOTI_START_WITH_PO_DOC_DETAILS_TXMA_EVENT, userId, false);
		await postMockEvent(VALID_F2F_DOCUMENT_UPLOADED_TXMA_EVENT, userId, false);
		await postMockEvent(VALID_IPV_F2F_CRI_VC_CONSUMED_WITH_DOC_EXPIRYDATE_TXMA_EVENT, userId, false);

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
		expect(response?.documentType).toBe("PASSPORT");
		expect(response?.documentExpiryDate).toBe("2030-01-01");
		expect(response?.postOfficeInfo).toEqual([
			{
				"M": {
					"address": {
						"S": "1 The Street, Funkytown",
					},
					"location": {
						"L": [
							{
								"M": {
									"latitude": {
										"N": "0.34322",
									},
									"longitude": {
										"N": "-42.48372",
									},
								},
							},
						],
					},
					"name": {
						"S": "Post Office Name",
					},
					"post_code": {
						"S": "N1 2AA",
					},
				},
			},
		]);
		expect(response?.postOfficeVisitDetails).toEqual([
			{
				"M": {
					"post_office_date_of_visit": {
						"S": "7 September 2023",
					},
					"post_office_time_of_visit": {
						"S": "4:43 pm",
					},
				},
			},
		]);
	}, 20000); // timeout set to 20s to avoid infinite loop
});
