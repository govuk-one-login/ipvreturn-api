import Ajv from "ajv";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import axios, { AxiosInstance } from "axios";
import { aws4Interceptor } from "aws4-axios";
import { randomUUID } from "crypto";
import { ReturnSQSEvent } from "../../../models/ReturnSQSEvent";
import { ExtSessionEvent } from "../../../models/SessionEvent";
import { constants } from "./ApiConstants";
import { sleep } from "../../../utils/Sleep";
import { TxmaEvent, TxmaEventName } from "../../../utils/TxmaEvent";
import { XMLParser } from "fast-xml-parser";
import * as IPR_RESULT_NOTIFICATION_EMAILED_SCHEMA from "../../data/IPR_RESULT_NOTIFICATION_EMAILED.json";
import * as IPR_USER_REDIRECTED_SCHEMA from "../../data/IPR_USER_REDIRECTED.json";

const EMAIL_ADDRESS = constants.API_TEST_EMAIL_ADDRESS;

const ajv = new Ajv({ strictTuples: false });
ajv.addSchema(IPR_RESULT_NOTIFICATION_EMAILED_SCHEMA, "IPR_RESULT_NOTIFICATION_EMAILED_SCHEMA");
ajv.addSchema(IPR_USER_REDIRECTED_SCHEMA, "IPR_USER_REDIRECTED_SCHEMA");
interface AllTxmaEvents {
	"IPR_RESULT_NOTIFICATION_EMAILED"?: TxmaEvent;
	"IPR_USER_REDIRECTED"?: TxmaEvent;
}
interface TestHarnessReponse {
	data: TxmaEvent;
}

const GOV_NOTIFY_INSTANCE = axios.create({ baseURL: constants.GOV_NOTIFY_API });

const HARNESS_API_INSTANCE: AxiosInstance = axios.create({ baseURL: constants.DEV_IPR_TEST_HARNESS_URL });

const customCredentialsProvider = {
	getCredentials: fromNodeProviderChain({
		timeout: 1000,
		maxRetries: 0,
	}),
}

const awsSigv4Interceptor = aws4Interceptor({
	options: {
		region: "eu-west-2",
		service: "execute-api",
	},
	credentials: customCredentialsProvider,
});
HARNESS_API_INSTANCE.interceptors.request.use(awsSigv4Interceptor);

const xmlParser = new XMLParser();

export async function postMockEvent(inputEvent: ReturnSQSEvent, user: string, emailAddress: any): Promise<any> {
	const event = structuredClone(inputEvent);
	event.event_id = randomUUID();
	event.user.user_id = user;
	const timestamp = new Date();
	timestamp.setMilliseconds(0);
	event.timestamp = timestamp.getTime() / 1000;
	event.timestamp_formatted = timestamp.toISOString();
	if (emailAddress) {
		event.user.email = EMAIL_ADDRESS;
	}

	try {
		const response = await HARNESS_API_INSTANCE.post("/send-mock-txma-message", event);
		return response;
	} catch (error: any) {
		console.error({ message: "postMockEvent - failed sending message to mock TxMA queue", error });
	}
}

export async function getSessionByUserId(userId: string, tableName: string): Promise<ExtSessionEvent | undefined> {
	await sleep(2000);
	interface OriginalValue {
		N?: string;
		S?: string;
		L?: string;
		BOOL?: boolean;
	}

	interface OriginalSessionItem {
		[key: string]: OriginalValue;
	}

	let session;
	let response;
	
	response = await HARNESS_API_INSTANCE.get<{ Item: OriginalSessionItem }>(`getRecordByUserId/${tableName}/${userId}`, {});
	const originalSession = response.data.Item;

	if (!originalSession) {
		throw new Error(`Session not found for userId: ${userId}`);
	}
	
	try {
		session = Object.fromEntries(
			Object.entries(originalSession).map(([key, value]) => [key, value.N ?? value.S ?? value.L ?? value.BOOL]),
		) as unknown as ExtSessionEvent;
	} catch (e: any) {
		
		console.error({ message: "getSessionByUserId - failed getting session from Dynamo", e });
	}

	console.log("getSessionByUserId Response", session);
	return session;
}

export async function postGovNotifyRequest(mockDelimitator: any, userData: any): Promise<any> {
	const path = "/v2/notifications/email";
	try {
		// update email to contain mock delimitator before the @ - this determines the behaviour of the GovNotify mock
		userData.email_address = insertBeforeLastOccurrence(userData.email_address, "@", mockDelimitator);
		const postRequest = await GOV_NOTIFY_INSTANCE.post(path, userData);
		return postRequest;
	} catch (error: any) {
		console.log(`Error response from ${path} endpoint: ${error}`);
		return error.response;
	}

	function insertBeforeLastOccurrence(strToSearch: string, strToFind: string, strToInsert: string): string {
		const n = strToSearch.lastIndexOf(strToFind);
		if (n < 0) return strToSearch;
		return strToSearch.substring(0, n) + strToInsert + strToSearch.substring(n);
	}
}

const getTxMAS3FileNames = async (prefix: string): Promise<any> => {
	const listObjectsResponse = await HARNESS_API_INSTANCE.get("/bucket/", {
		params: {
			prefix: "txma/" + prefix,
		},
	});
	const listObjectsParsedResponse = xmlParser.parse(listObjectsResponse.data);
	return listObjectsParsedResponse?.ListBucketResult?.Contents;
};

const getAllTxMAS3FileContents = async (fileNames: any[]): Promise<AllTxmaEvents> => {
	const allContents = await fileNames.reduce(
		async (accumulator: Promise<AllTxmaEvents>, fileName: any) => {
			const resolvedAccumulator = await accumulator;

			const eventContents: TestHarnessReponse = await HARNESS_API_INSTANCE.get("/object/" + fileName.Key, {});
			resolvedAccumulator[eventContents?.data?.event_name] = eventContents.data;

			return resolvedAccumulator;
		}, Promise.resolve({}),
	);

	return allContents;
};

export async function getTxmaEventsFromTestHarness(sessionId: string, numberOfTxMAEvents: number): Promise<any> {
	let objectList: AllTxmaEvents = {};
	let fileNames: any = [];

	await new Promise(res => setTimeout(res, 3000));
	fileNames = await getTxMAS3FileNames(sessionId);

	// AWS returns an array for multiple but an object for single
	if (numberOfTxMAEvents === 1) {
		if (!fileNames || !fileNames.Key) {
			console.log(`No TxMA events found for session ID ${sessionId}`);
			return undefined;
		}

		const eventContents: TestHarnessReponse = await HARNESS_API_INSTANCE.get("/object/" + fileNames.Key, {});
		objectList[eventContents?.data?.event_name] = eventContents.data;
	} else {
		if (!fileNames || !fileNames.length) {
			console.log(`No TxMA events found for session ID ${sessionId}`);
			return undefined;
		}

		const additionalObjectList = await getAllTxMAS3FileContents(fileNames);
		objectList = { ...objectList, ...additionalObjectList };
	}
	return objectList;
}

export function validateTxMAEventData(
	{ eventName, schemaName }: { eventName: TxmaEventName; schemaName: string }, allTxmaEventBodies: AllTxmaEvents = {},
): void {
	const currentEventBody: TxmaEvent | undefined = allTxmaEventBodies[eventName];

	if (currentEventBody?.event_name) {
		try {
			const validate = ajv.getSchema(schemaName);
			if (validate) {
				const isSchemaValid = validate(currentEventBody);
				if (validate.errors) {
					console.log("Schema validation errors: " + JSON.stringify(validate.errors));
				}
				expect(isSchemaValid).toBe(true);
			} else {
				throw new Error(`Could not find schema ${schemaName}`);
			}
		} catch (error) {
			console.error("Error validating event", error);
			throw error;
		}
	} else {
		throw new Error(`No event found in the test harness for ${eventName} event`);
	}
}

export async function updateDynamoDbRecord(userId: string, tableName: string, attributeName: string, newValue: any, newValueType: any): Promise<void> {
	try {
		const requestBody = {
			attributeName,
			newValue,
			newValueType,
		};

		const url = `updateRecord/${tableName}`;
		const queryParams = { userId };

		await HARNESS_API_INSTANCE.patch(url, requestBody, {
			params: queryParams,
		});

		console.log(`Record updated successfully for table ${tableName}`);

	} catch (e: any) {
		console.error({ message: "updateDynamoDbRecord - failed updating record in DynamoDB", e });
	}
}
