 
import {
	VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT,
	VALID_IPV_F2F_CRI_VC_CONSUMED_WITH_DOC_EXPIRYDATE_TXMA_EVENT,
	VALID_F2F_YOTI_START_WITH_PO_DOC_DETAILS_TXMA_EVENT,
	VALID_F2F_DOCUMENT_UPLOADED_TXMA_EVENT,
	VALID_IPV_F2F_RESTART_TXMA_EVENT,
	VALID_IPV_F2F_CRI_VC_ERROR_TXMA_EVENT,
	VALID_AUTH_DELETE_ACCOUNT_TXMA_EVENT,
} from "../data/sqs-events";
import "dotenv/config";
import { randomUUID } from "crypto";
import { constants } from "./utils/ApiConstants";
import { postMockEvent, getSessionByUserId, getTxmaEventsFromTestHarness, validateTxMAEventData, getApiRequest } from "./utils/ApiTestSteps";
import { sleep } from "../../utils/Sleep";
import { ReturnSQSEvent } from "../../models/ReturnSQSEvent";
import { absoluteTimeNow } from "../../utils/DateTimeUtils";
import { manualOidcLoginTest } from "./utils/OidcLoginSteps";

//QualityGateIntegrationTest 
//QualityGateRegressionTest
//QualityGateStackTest
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
	}, 30000); // timeout set to 30s to avoid infinite loop

	it("PII is removed when IPV_F2F_RESTART event is sent", async () => {
		console.log("PII is removed when IPV_F2F_RESTART event is sent")
		const userId = randomUUID();
		console.log("userId: ", userId)
		await postMockEvent(VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT, userId, true);		
		await postMockEvent(VALID_F2F_YOTI_START_WITH_PO_DOC_DETAILS_TXMA_EVENT, userId, false);
		await postMockEvent(VALID_F2F_DOCUMENT_UPLOADED_TXMA_EVENT, userId, false);
		await postMockEvent(VALID_IPV_F2F_CRI_VC_CONSUMED_WITH_DOC_EXPIRYDATE_TXMA_EVENT, userId, false);
		await postMockEvent(VALID_IPV_F2F_RESTART_TXMA_EVENT, userId, false);
		
		const response = await getSessionByUserId(userId, constants.API_TEST_SESSION_EVENTS_TABLE!);

		expect(response?.clientName).toBe("ekwU");
		expect(response?.accountDeletedOn).toBeFalsy();
		expect(response?.redirectUri).toBe("REDIRECT_URL");
		expect(response?.userEmail).toBe("user@digital.cabinet-office.gov.uk");
		expect(Number(response?.expiresOn)).toBeGreaterThan(absoluteTimeNow())
		expect(response?.documentType).toBeUndefined();
		expect(response?.documentExpiryDate).toBeUndefined();
		expect(response?.postOfficeInfo).toBeUndefined();
		expect(response?.postOfficeVisitDetails).toBeUndefined();
		expect(response?.notified).toBeUndefined();
		expect(response?.nameParts).toBeUndefined();
		expect(response?.errorDescription).toBeUndefined();
		await sleep(5000);
		const allTxmaEventBodies = await getTxmaEventsFromTestHarness(userId, 1);
		await validateTxMAEventData({ eventName: "IPR_RESULT_NOTIFICATION_EMAILED", schemaName: "IPR_RESULT_NOTIFICATION_EMAILED_SCHEMA" }, allTxmaEventBodies);
	}, 30000); // timeout set to 30s to avoid infinite loop

	describe("F2F restart journey", () => {
		it("when a user fails a F2F journey, they are able to try a 2nd time and receive a results email", async () => {
			console.log("when a user fails a F2F journey, they are able to try a 2nd time and receive a results email")
			const userId = randomUUID();
			console.log("userId: ", userId)

			// 1st F2F journey which ends in failure
			await postMockEvent(VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT, userId, true);		
			await postMockEvent(VALID_F2F_YOTI_START_WITH_PO_DOC_DETAILS_TXMA_EVENT, userId, false);
			await postMockEvent(VALID_F2F_DOCUMENT_UPLOADED_TXMA_EVENT, userId, false);
			await postMockEvent(VALID_IPV_F2F_CRI_VC_ERROR_TXMA_EVENT, userId, false);
			await postMockEvent(VALID_IPV_F2F_RESTART_TXMA_EVENT, userId, false);

			await sleep(5000);
			// 1st IPR_RESULT_NOTIFICATION_EMAILED due to failure email
			const txmaEvent1stJourney = await getTxmaEventsFromTestHarness(userId, 1);
			await validateTxMAEventData({ eventName: "IPR_RESULT_NOTIFICATION_EMAILED", schemaName: "IPR_RESULT_NOTIFICATION_EMAILED_SCHEMA" }, txmaEvent1stJourney);
			expect(txmaEvent1stJourney.IPR_RESULT_NOTIFICATION_EMAILED.extensions.emailType).toBe("f2fVcGenerationFailure");

			// 2nd F2F journey that is successful
			await postMockEvent(VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT, userId, true);		
			await postMockEvent(VALID_F2F_YOTI_START_WITH_PO_DOC_DETAILS_TXMA_EVENT, userId, false);
			await postMockEvent(VALID_F2F_DOCUMENT_UPLOADED_TXMA_EVENT, userId, false);
			await postMockEvent(VALID_IPV_F2F_CRI_VC_CONSUMED_WITH_DOC_EXPIRYDATE_TXMA_EVENT, userId, false);

			await sleep(5000);
			//At this point IPR has emitted 2x IPR_RESULT_NOTIFICATION_EMAILED for the same user, one for each journey
			//This function returns the later event, so the one associated with the 2nd journey
			const txmaEvent2ndJourney = await getTxmaEventsFromTestHarness(userId, 2);
			await validateTxMAEventData({ eventName: "IPR_RESULT_NOTIFICATION_EMAILED", schemaName: "IPR_RESULT_NOTIFICATION_EMAILED_SCHEMA" }, txmaEvent2ndJourney);
			expect(txmaEvent2ndJourney.IPR_RESULT_NOTIFICATION_EMAILED.extensions.emailType).toBe("f2fResultAvailable");
		}, 45000);

		it("when a user fails a F2F journey, they receive a failure email, and they try a 2nd time, they receive a another failure email", async () => {
			console.log("when a user fails a F2F journey, they receive a failure email, and they try a 2nd time, they receive a another failure email")
			const userId = randomUUID();
			console.log("userId: ", userId)

			// 1st F2F journey which ends in failure
			await postMockEvent(VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT, userId, true);		
			await postMockEvent(VALID_F2F_YOTI_START_WITH_PO_DOC_DETAILS_TXMA_EVENT, userId, false);
			await postMockEvent(VALID_F2F_DOCUMENT_UPLOADED_TXMA_EVENT, userId, false);
			await postMockEvent(VALID_IPV_F2F_CRI_VC_ERROR_TXMA_EVENT, userId, false);
			await postMockEvent(VALID_IPV_F2F_RESTART_TXMA_EVENT, userId, false);

			await sleep(5000);
			const txmaEvent1stJourney = await getTxmaEventsFromTestHarness(userId, 1);
			await validateTxMAEventData({ eventName: "IPR_RESULT_NOTIFICATION_EMAILED", schemaName: "IPR_RESULT_NOTIFICATION_EMAILED_SCHEMA" }, txmaEvent1stJourney);
			expect(txmaEvent1stJourney.IPR_RESULT_NOTIFICATION_EMAILED.extensions.emailType).toBe("f2fVcGenerationFailure");

			// 2nd F2F journey which ends in failure
			await postMockEvent(VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT, userId, true);		
			await postMockEvent(VALID_F2F_YOTI_START_WITH_PO_DOC_DETAILS_TXMA_EVENT, userId, false);
			await postMockEvent(VALID_F2F_DOCUMENT_UPLOADED_TXMA_EVENT, userId, false);
			await postMockEvent(VALID_IPV_F2F_CRI_VC_ERROR_TXMA_EVENT, userId, false);

			await sleep(5000);
			//At this point IPR has emitted 2x IPR_RESULT_NOTIFICATION_EMAILED for the same user, one for each journey
			//This function returns the later event, so the one associated with the 2nd journey
			const txmaEvent2ndJourney = await getTxmaEventsFromTestHarness(userId, 2);
			await validateTxMAEventData({ eventName: "IPR_RESULT_NOTIFICATION_EMAILED", schemaName: "IPR_RESULT_NOTIFICATION_EMAILED_SCHEMA" }, txmaEvent2ndJourney);
			expect(txmaEvent2ndJourney.IPR_RESULT_NOTIFICATION_EMAILED.extensions.emailType).toBe("f2fVcGenerationFailure");
		}, 45000);
	});

	it("when AUTH_IPV_AUTHORISATION_REQUESTED, F2F_YOTI_START, F2F_DOCUMENT_UPLOADED, IPV_F2F_CRI_VC_CONSUMED events are sent, a Dynamo record with the details of both events is recorded. Then if these events are played again the details are updated", async () => {
		if (process.env.REDRIVE_ENABLED === "true") {
			console.log("when AUTH_IPV_AUTHORISATION_REQUESTED, F2F_YOTI_START, F2F_DOCUMENT_UPLOADED, IPV_F2F_CRI_VC_CONSUMED events are sent, a Dynamo record with the details of both events is recorded.")
			const userId = randomUUID();
			console.log("userId: ", userId)
			let authEvent: ReturnSQSEvent = structuredClone(VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT);
			let yotiStartEvent: ReturnSQSEvent = structuredClone(VALID_F2F_YOTI_START_WITH_PO_DOC_DETAILS_TXMA_EVENT);
			let documentUploadedEvent: ReturnSQSEvent = structuredClone(VALID_F2F_DOCUMENT_UPLOADED_TXMA_EVENT);
			
			authEvent.clientLandingPageUrl="invalidUndefinedRedirect";

			await postMockEvent(authEvent, userId, true);
			await postMockEvent(yotiStartEvent, userId, false);
			await postMockEvent(documentUploadedEvent, userId, false);
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

			await postMockEvent(authEvent, userId, true);
			await postMockEvent(yotiStartEvent, userId, false);
			await postMockEvent(documentUploadedEvent, userId, false);
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
	}, 45000); 

	it("when IPV_F2F_CRI_VC_ERROR event are sent, a Dynamo record is recorded", async () => {
		const userId = randomUUID();
		console.log("userId: ", userId)
		await postMockEvent(VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT, userId, true);		
		await postMockEvent(VALID_F2F_YOTI_START_WITH_PO_DOC_DETAILS_TXMA_EVENT, userId, false);
		await postMockEvent(VALID_IPV_F2F_CRI_VC_ERROR_TXMA_EVENT, userId, false);

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
		expect(response?.errorDescription).toBe("VC generation failed : Unable to create credential");
		expect(response?.userEmail).toBe(constants.API_TEST_EMAIL_ADDRESS);
		await sleep(5000);
		const allTxmaEventBodies = await getTxmaEventsFromTestHarness(userId, 1);
		await validateTxMAEventData({ eventName: "IPR_RESULT_NOTIFICATION_EMAILED", schemaName: "IPR_RESULT_NOTIFICATION_EMAILED_SCHEMA" }, allTxmaEventBodies);
	}, 30000);

	describe("All IPVR user data cleared when AUTH_DELETE_ACCOUNT consumed at any point in the IPVR journey", () => {

		it("when 2 events are sent", async () => {
			console.log("when 2 events are sent")
			const userId = randomUUID();
			console.log("userId: ", userId)

			await postMockEvent(VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT, userId, true);
			await sleep(3000);		
			await postMockEvent(VALID_F2F_YOTI_START_WITH_PO_DOC_DETAILS_TXMA_EVENT, userId, false);

			// Verify session exists - IPVR behaving as expected
			const response = await getSessionByUserId(userId, constants.API_TEST_SESSION_EVENTS_TABLE!);
			expect(response?.clientName).toBe("ekwU");

			await postMockEvent(VALID_AUTH_DELETE_ACCOUNT_TXMA_EVENT, userId, false);
			
			const clearedResponse = await getSessionByUserId(userId, constants.API_TEST_SESSION_EVENTS_TABLE!);

			// Verify previously retrieved session no longer exists
			expect(clearedResponse?.clientName).toBe("");
			expect(clearedResponse?.accountDeletedOn).toBeTruthy();
			expect(clearedResponse?.redirectUri).toBe("");
			expect(clearedResponse?.userEmail).toBe("");
			expect(Number(clearedResponse?.expiresOn)).toBeGreaterThan(absoluteTimeNow())
			expect(clearedResponse?.documentType).toBe("PASSPORT");
			expect(clearedResponse?.documentExpiryDate).toBe(undefined);
			expect(clearedResponse?.postOfficeInfo).toEqual([
				{
					"M": {
						"name": {
							"S": "Post Office Name",
						},
						"post_code": {
							"S": "N1 2AA",
						},
						"address":  {
							"S": "1 The Street, Funkytown",
						},
						"location": {
							L: [
								{
									"M":  {
										"latitude": {
											"N": "0.34322",
										},
										"longitude":  {
											"N": "-42.48372",
										}
									}
								}
							]
						},
					},
				}]
			);			
			expect(clearedResponse?.postOfficeVisitDetails).toEqual(undefined);
			expect(clearedResponse?.notified).toBe(undefined);
			expect(clearedResponse?.nameParts).toEqual([]);
			}, 30000);

		it("when 3 events are sent", async () => {
			console.log("when 3 events are sent")
			const userId = randomUUID();
			console.log("userId: ", userId)

			await postMockEvent(VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT, userId, true);
			await sleep(3000);		
		
			await postMockEvent(VALID_F2F_YOTI_START_WITH_PO_DOC_DETAILS_TXMA_EVENT, userId, false);
			await postMockEvent(VALID_F2F_DOCUMENT_UPLOADED_TXMA_EVENT, userId, false);

			// Verify session exists - IPVR behaving as expected
			const response = await getSessionByUserId(userId, constants.API_TEST_SESSION_EVENTS_TABLE!);
			expect(response?.clientName).toBe("ekwU");

			await postMockEvent(VALID_AUTH_DELETE_ACCOUNT_TXMA_EVENT, userId, false);
			
			const clearedResponse = await getSessionByUserId(userId, constants.API_TEST_SESSION_EVENTS_TABLE!);

			// Verify previously retrieved session no longer exists
			expect(clearedResponse?.clientName).toBe("");
			expect(clearedResponse?.accountDeletedOn).toBeTruthy();
			expect(clearedResponse?.redirectUri).toBe("");
			expect(clearedResponse?.userEmail).toBe("");
			expect(Number(clearedResponse?.expiresOn)).toBeGreaterThan(absoluteTimeNow())
			expect(clearedResponse?.documentType).toBe("PASSPORT");
			expect(clearedResponse?.documentExpiryDate).toBe(undefined);
			expect(clearedResponse?.postOfficeInfo).toEqual([
				{
					"M": {
						"name": {
							"S": "Post Office Name",
						},
						"post_code": {
							"S": "N1 2AA",
						},
						"address":  {
							"S": "1 The Street, Funkytown",
						},
						"location": {
							L: [
								{
									"M":  {
										"latitude": {
											"N": "0.34322",
										},
										"longitude":  {
											"N": "-42.48372",
										}
									}
								}
							]
						},
					},
				}]
			);			
			expect(clearedResponse?.postOfficeVisitDetails).toEqual([
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
			expect(clearedResponse?.notified).toBe(undefined);
			expect(clearedResponse?.nameParts).toEqual([]);
		}, 30000);

		it("when 4 events are sent", async () => {
			console.log("when 4 events are sent")
			const userId = randomUUID();
			console.log("userId: ", userId)

			await postMockEvent(VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT, userId, true);
			await sleep(3000);		
		
			await postMockEvent(VALID_F2F_YOTI_START_WITH_PO_DOC_DETAILS_TXMA_EVENT, userId, false);
			await postMockEvent(VALID_F2F_DOCUMENT_UPLOADED_TXMA_EVENT, userId, false);
			await postMockEvent(VALID_IPV_F2F_CRI_VC_CONSUMED_WITH_DOC_EXPIRYDATE_TXMA_EVENT, userId, false);

			// Verify session exists - IPVR behaving as expected
			const response = await getSessionByUserId(userId, constants.API_TEST_SESSION_EVENTS_TABLE!);
			expect(response?.clientName).toBe("ekwU");

			await postMockEvent(VALID_AUTH_DELETE_ACCOUNT_TXMA_EVENT, userId, false);

			// Verify previously retrieved session no longer exists
			const clearedResponse = await getSessionByUserId(userId, constants.API_TEST_SESSION_EVENTS_TABLE!);

			// Verify previously retrieved session no longer exists
			expect(clearedResponse?.clientName).toBe("");
			expect(clearedResponse?.accountDeletedOn).toBeTruthy();
			expect(clearedResponse?.redirectUri).toBe("");
			expect(clearedResponse?.userEmail).toBe("");
			expect(Number(clearedResponse?.expiresOn)).toBeGreaterThan(absoluteTimeNow())
			expect(clearedResponse?.documentType).toBe("PASSPORT");
			expect(clearedResponse?.documentExpiryDate).toBe("2030-01-01");
			expect(clearedResponse?.postOfficeInfo).toEqual([
				{
					"M": {
						"name": {
							"S": "Post Office Name",
						},
						"post_code": {
							"S": "N1 2AA",
						},
						"address":  {
							"S": "1 The Street, Funkytown",
						},
						"location": {
							L: [
								{
									"M":  {
										"latitude": {
											"N": "0.34322",
										},
										"longitude":  {
											"N": "-42.48372",
										}
									}
								}
							]
						},
					},
				}]
			);			
			expect(clearedResponse?.postOfficeVisitDetails).toEqual([
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
			expect(clearedResponse?.notified).toBe(true);
			expect(clearedResponse?.nameParts).toEqual([]);
		}, 30000);

	});
	
	it("when all 4 events are sent, a Dynamo record with the details of all 4 events is recorded and the user can be redirected from the session endpoint back to the RP", async () => {
		console.log("when all 4 events are sent, a Dynamo record with the details of all 4 events is recorded and the user can be redirected from the session endpoint back to the RP")
		const userId = randomUUID();
		console.log("userId: ", userId)
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
		const allTxmaEventBodies = await getTxmaEventsFromTestHarness(userId, 1);
		await validateTxMAEventData({ eventName: "IPR_RESULT_NOTIFICATION_EMAILED", schemaName: "IPR_RESULT_NOTIFICATION_EMAILED_SCHEMA" }, allTxmaEventBodies);

		console.log("Following the successful completion of a F2F journey make a request to session");

		const authCode = await manualOidcLoginTest(userId)

		await getApiRequest("/session?code=" + authCode);

		const allTxmaEventBodiesPostRedirect = await getTxmaEventsFromTestHarness(userId, 2);
		await validateTxMAEventData({ eventName: "IPR_USER_REDIRECTED", schemaName: "IPR_USER_REDIRECTED_SCHEMA" }, allTxmaEventBodiesPostRedirect);
	}, 60000);
});
