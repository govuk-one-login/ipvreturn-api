/* eslint-disable max-lines-per-function */
import {
	VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT,
	VALID_IPV_F2F_CRI_VC_CONSUMED_WITH_DOC_EXPIRYDATE_TXMA_EVENT,
	VALID_F2F_YOTI_START_WITH_PO_DOC_DETAILS_TXMA_EVENT,
	VALID_F2F_DOCUMENT_UPLOADED_TXMA_EVENT,
	VALID_IPV_F2F_USER_CANCEL_END_TXMA_EVENT,
	VALID_IPV_F2F_CRI_VC_ERROR_WITH_VC_FAILURE_TXMA_EVENT,
} from "../data/sqs-events";
import "dotenv/config";
import { randomUUID } from "crypto";
import { constants } from "./utils/ApiConstants";
import { postMockEvent, getSessionByUserId, getTxmaEventsFromTestHarness, validateTxMAEventData } from "./utils/ApiTestSteps";
import { sleep } from "../../utils/Sleep";
import { ReturnSQSEvent } from "../../models/ReturnSQSEvent";

describe("post event processor", () => {

	const postOfficeDetails = {
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
			};

	it("when AUTH_IPV_AUTHORISATION_REQUESTED and F2F_YOTI_START events are sent, a Dynamo record with the details of both events is recorded", async () => {
		console.log("when AUTH_IPV_AUTHORISATION_REQUESTED and F2F_YOTI_START events are sent, a Dynamo record with the details of both events is recorded")
		const userId = randomUUID();
		console.log("userId: ", userId)
		await postMockEvent(VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT, userId, true);
		// Simulated delay between logging in and start F2F
		await sleep(3000);
		await postMockEvent(VALID_F2F_YOTI_START_WITH_PO_DOC_DETAILS_TXMA_EVENT, userId, false);
		
		const response = await getSessionByUserId(userId, constants.API_TEST_SESSION_EVENTS_TABLE!);

		expect(response?.clientName).toBe("ekwU");
		expect(response?.redirectUri).toBe("REDIRECT_URL");
		expect(response?.userEmail).toBe(constants.API_TEST_EMAIL_ADDRESS);
		expect(response?.documentType).toBe("PASSPORT");
		expect(response?.postOfficeInfo).toEqual([
			postOfficeDetails
		]);
	}, 30000); 

	it("when all 4 events are sent, a Dynamo record with the details of all 4 events is recorded", async () => {
		console.log("when all 4 events are sent, a Dynamo record with the details of all 4 events is recorded")
		const userId = randomUUID();
		console.log("userId: ", userId)
		await postMockEvent(VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT, userId, true);		
		// Simulated delay between logging in and start F2F
		await sleep(3000);
		await postMockEvent(VALID_F2F_YOTI_START_WITH_PO_DOC_DETAILS_TXMA_EVENT, userId, false);
		// Simulated delay between F2F and the PO
		await sleep(3000);
		await postMockEvent(VALID_F2F_DOCUMENT_UPLOADED_TXMA_EVENT, userId, false);
		// Simulated system delay (Investigate where these happen close together)
		await sleep(1000);
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
			postOfficeDetails
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
		await sleep(5000);
		const allTxmaEventBodies = await getTxmaEventsFromTestHarness(userId, 1);
		await validateTxMAEventData({ eventName: "IPR_RESULT_NOTIFICATION_EMAILED", schemaName: "IPR_RESULT_NOTIFICATION_EMAILED_SCHEMA" }, allTxmaEventBodies);
	}, 30000); // timeout set to 20s to avoid infinite loop

	it("PII is removed and record is marked for deletion when IPV_F2F_USER_CANCEL_END event is sent", async () => {
		console.log("PII is removed and record is marked for deletion when IPV_F2F_USER_CANCEL_END event is sent")
		const userId = randomUUID();
		console.log("userId: ", userId)
		await postMockEvent(VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT, userId, true);		
		// Simulated delay between logging in and start F2F
		await sleep(3000);
		await postMockEvent(VALID_F2F_YOTI_START_WITH_PO_DOC_DETAILS_TXMA_EVENT, userId, false);
		// Simulated delay between F2F and the PO
		await sleep(3000);
		await postMockEvent(VALID_F2F_DOCUMENT_UPLOADED_TXMA_EVENT, userId, false);
		// Simulated system delay (Investigate where these happen close together)
		await sleep(1000);
		await postMockEvent(VALID_IPV_F2F_CRI_VC_CONSUMED_WITH_DOC_EXPIRYDATE_TXMA_EVENT, userId, false);
		
		// Simulate user wait and allow email to send
		await sleep(10000);
		await postMockEvent(VALID_IPV_F2F_USER_CANCEL_END_TXMA_EVENT, userId, false);

		const response = await getSessionByUserId(userId, constants.API_TEST_SESSION_EVENTS_TABLE!);

		expect(response?.notified).toBe(true);
		expect(response?.nameParts).toEqual([]);
		expect(response?.clientName).toBe("");
		expect(response?.accountDeletedOn).toBeTruthy();
		expect(response?.redirectUri).toBe("");
		expect(response?.userEmail).toBe("");
		expect(response?.documentType).toBe("PASSPORT");
		expect(response?.documentExpiryDate).toBe("2030-01-01");
		expect(response?.postOfficeInfo).toEqual([
			postOfficeDetails
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
		await sleep(5000);
		const allTxmaEventBodies = await getTxmaEventsFromTestHarness(userId, 1);
		await validateTxMAEventData({ eventName: "IPR_RESULT_NOTIFICATION_EMAILED", schemaName: "IPR_RESULT_NOTIFICATION_EMAILED_SCHEMA" }, allTxmaEventBodies);
	}, 30000); // timeout set to 20s to avoid infinite loop

	it("when AUTH_IPV_AUTHORISATION_REQUESTED, F2F_YOTI_START, F2F_DOCUMENT_UPLOADED, IPV_F2F_CRI_VC_CONSUMED events are sent, a Dynamo record with the details of both events is recorded. Then if these events are played again the details are updated", async () => {
		if (process.env.REDRIVE_ENABLED === "true") {
			console.log("when AUTH_IPV_AUTHORISATION_REQUESTED, F2F_YOTI_START, F2F_DOCUMENT_UPLOADED, IPV_F2F_CRI_VC_CONSUMED events are sent, a Dynamo record with the details of both events is recorded.")
			const userId = randomUUID();
			console.log("userId: ", userId)
			let authEvent: ReturnSQSEvent = VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT;
			let yotiStartEvent: ReturnSQSEvent = VALID_F2F_YOTI_START_WITH_PO_DOC_DETAILS_TXMA_EVENT;
			let documentUploadedEvent: ReturnSQSEvent = VALID_F2F_DOCUMENT_UPLOADED_TXMA_EVENT;
			
			authEvent.clientLandingPageUrl="invalidUndefinedRedirect";

			await postMockEvent(authEvent, userId, true);
			// Simulated delay between logging in and start F2F
			await sleep(3000);
			await postMockEvent(yotiStartEvent, userId, false);

			// Simulated delay between F2F and the PO
			await sleep(3000);
			await postMockEvent(documentUploadedEvent, userId, false);
			// Simulated system delay (Investigate where these happen close together)
			await sleep(1000);
			await postMockEvent(VALID_IPV_F2F_CRI_VC_CONSUMED_WITH_DOC_EXPIRYDATE_TXMA_EVENT, userId, false);

			const response = await getSessionByUserId(userId, constants.API_TEST_SESSION_EVENTS_TABLE!);

			expect(response?.ipvStartedOn).toBe(undefined);
			expect(response?.clientName).toBe(undefined);
			expect(response?.redirectUri).toBe(undefined);
			expect(response?.userEmail).toBe(undefined);
			expect(response?.documentType).toBe(undefined);
			expect(response?.postOfficeInfo).toEqual(undefined);
			expect(response?.nameParts).toEqual([{"M": {"type": {"S": "GivenName"}, "value": {"S": "ANGELA"}}}, {"M": {"type": {"S": "GivenName"}, "value": {"S": "ZOE"}}}, {"M": {"type": {"S": "FamilyName"}, "value": {"S": "UK SPECIMEN"}}}]);
			expect(Number(response?.readyToResumeOn)).toBeGreaterThan(1749935994);
			expect(Number(response?.documentUploadedOn)).toBeGreaterThan(1749936260);
			expect(response?.postOfficeVisitDetails).toEqual([{"M": {"post_office_date_of_visit": {"S": "7 September 2023"}, "post_office_time_of_visit": {"S": "4:43 pm"}}}]);

			authEvent.clientLandingPageUrl=undefined;
			authEvent.client_id="HPAUPxK87FyljocDdQxijxdti08";

			// Simulated delay between first and second journey
			await sleep(3000);

			await postMockEvent(authEvent, userId, true);
			// Simulated delay between logging in and start F2F
			await sleep(3000);
			await postMockEvent(yotiStartEvent, userId, false);
			// Simulated delay between F2F and the PO
			await sleep(3000);
			await postMockEvent(documentUploadedEvent, userId, false);
			// Simulated system delay (Investigate where these happen close together)
			await sleep(1000);
			await postMockEvent(VALID_IPV_F2F_CRI_VC_CONSUMED_WITH_DOC_EXPIRYDATE_TXMA_EVENT, userId, false);

			const secondResponse = await getSessionByUserId(userId, constants.API_TEST_SESSION_EVENTS_TABLE!);

			expect(Number(secondResponse?.ipvStartedOn)).toBeGreaterThan(1750064967);
			expect(secondResponse?.clientName).toBe("HPAUPxK87FyljocDdQxijxdti08");
			expect(secondResponse?.redirectUri).toBe("https://www.gov.uk/driver-vehicles-account");
			expect(secondResponse?.userEmail).toBe(constants.API_TEST_EMAIL_ADDRESS);
			expect(secondResponse?.documentType).toBe("PASSPORT");
			expect(secondResponse?.postOfficeInfo).toEqual([
				postOfficeDetails
			]);
			expect(response?.nameParts).toEqual([{"M": {"type": {"S": "GivenName"}, "value": {"S": "ANGELA"}}}, {"M": {"type": {"S": "GivenName"}, "value": {"S": "ZOE"}}}, {"M": {"type": {"S": "FamilyName"}, "value": {"S": "UK SPECIMEN"}}}]);
			expect(Number(response?.readyToResumeOn)).toBeGreaterThan(1749935994);
			expect(Number(response?.documentUploadedOn)).toBeGreaterThan(1749936260);
			expect(response?.postOfficeVisitDetails).toEqual([{"M": {"post_office_date_of_visit": {"S": "7 September 2023"}, "post_office_time_of_visit": {"S": "4:43 pm"}}}]);

			await sleep(5000);
			const allTxmaEventBodies = await getTxmaEventsFromTestHarness(userId, 1);
			await validateTxMAEventData({ eventName: "IPR_RESULT_NOTIFICATION_EMAILED", schemaName: "IPR_RESULT_NOTIFICATION_EMAILED_SCHEMA" }, allTxmaEventBodies);
		}
	}, 35000); 

	it("when IPV_F2F_CRI_VC_ERROR event are sent, a Dynamo record is recorded", async () => {
		const userId = randomUUID();
		console.log("userId: ", userId)
		await postMockEvent(VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT, userId, true);		
		// Simulated delay between logging in and start F2F
		await sleep(3000);
		await postMockEvent(VALID_F2F_YOTI_START_WITH_PO_DOC_DETAILS_TXMA_EVENT, userId, false);
		// Simulated delay between F2F and the PO
		await sleep(3000);	
		await postMockEvent(VALID_IPV_F2F_CRI_VC_ERROR_WITH_VC_FAILURE_TXMA_EVENT, userId, false);

		const response = await getSessionByUserId(userId, constants.API_TEST_SESSION_EVENTS_TABLE!);
		expect(response?.poFailureNotified).toBe(true);
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
		expect(response?.errorDescription).toBe("VC generation failed : Unable to create credential");
		expect(response?.userEmail).toBe(constants.API_TEST_EMAIL_ADDRESS);
		await sleep(5000);
		const allTxmaEventBodies = await getTxmaEventsFromTestHarness(userId, 1);
		await validateTxMAEventData({ eventName: "IPR_RESULT_NOTIFICATION_EMAILED", schemaName: "IPR_RESULT_NOTIFICATION_EMAILED_SCHEMA" }, allTxmaEventBodies);
	}, 30000); 			
});
