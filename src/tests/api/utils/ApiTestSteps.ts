import { fromNodeProviderChain } from "@aws-sdk/credential-providers"; 
import axios, { AxiosInstance } from "axios";
import { aws4Interceptor } from "aws4-axios";
import { randomUUID } from "crypto";
import { ReturnSQSEvent } from "../../../models/ReturnSQSEvent";
import { ExtSessionEvent } from "../../../models/SessionEvent";
import { constants } from "./ApiConstants";

const AWS_REGION = process.env.AWS_REGION ?? "eu-west-2";
const EMAIL_ADDRESS = constants.API_TEST_EMAIL_ADDRESS;
const GOV_NOTIFY_INSTANCE = axios.create({ baseURL: constants.GOV_NOTIFY_API });

const HARNESS_API_INSTANCE : AxiosInstance = axios.create({ baseURL: constants.DEV_IPR_TEST_HARNESS_URL });

const customCredentialsProvider = {
	getCredentials: fromNodeProviderChain({
		timeout: 1000,
		maxRetries: 0,
	}),
};

const awsSigv4Interceptor = aws4Interceptor({
	options: {
		region: AWS_REGION,
		service: "execute-api",
	},
	credentials: customCredentialsProvider,
});
HARNESS_API_INSTANCE.interceptors.request.use(awsSigv4Interceptor);

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

export async function getSessionByUserId(userId: string, tableName: string): Promise< ExtSessionEvent | undefined > {
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

	try {
		do {
			response = await HARNESS_API_INSTANCE.get<{ Item: OriginalSessionItem }>(`getRecordByUserId/${tableName}/${userId}`, {});
		} while (!(response.data.Item?.notified && response.data.Item.notified.BOOL));
		const originalSession = response.data.Item;

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
