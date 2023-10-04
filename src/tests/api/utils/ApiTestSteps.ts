import { SendMessageCommand, SendMessageCommandOutput, SQSClient, PurgeQueueCommand, ReceiveMessageCommand } from "@aws-sdk/client-sqs";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers"; 
import axios, { AxiosInstance } from "axios";
import { aws4Interceptor } from "aws4-axios";
import { randomUUID } from "crypto";
import { XMLParser } from "fast-xml-parser";
import { ReturnSQSEvent } from "../../../models/ReturnSQSEvent";
import { SessionEvent } from "../../../models/SessionEvent";
import { constants } from "./ApiConstants";

const AWS_REGION = process.env.AWS_REGION ?? "eu-west-2";
const MOCK_TXMA_SQS_URL = constants.API_TEST_SQS_TXMA_CONSUMER_QUEUE;
const GOV_NOTIFY_SQS_URL = constants.API_TEST_GOV_NOTIFY_SQS_QUEUE;
const EMAIL_ADDRESS = constants.API_TEST_EMAIL_ADDRESS;
const GOV_NOTIFY_INSTANCE = axios.create({ baseURL: process.env.GOVUKNOTIFYAPI });

const HARNESS_API_INSTANCE : AxiosInstance = axios.create({ baseURL: constants.DEV_IPR_TEST_HARNESS_URL });

// const credentialsFunction = fromNodeProviderChain({
// 	timeout: 1000,
// 	maxRetries: 0,
// });

// const { accessKeyId, secretAccessKey, sessionToken } = await credentialsFunction();

// console.log("accessKeyId", accessKeyId);
// console.log("secretAccessKey", secretAccessKey);
// console.log("sessionToken", sessionToken);

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
const xmlParser = new XMLParser();

const sqsClient = new SQSClient({
	region: AWS_REGION,
});

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

	console.log("SENDING POST MESSAGE TO TEST HARNESS");

	try {
		const response = await HARNESS_API_INSTANCE.post("/send-mock-txma-message", event);
		return response;
	} catch (error: any) {
		console.error({ message: "postMockEvent - failed sending message to mock TxMA queue", error, data: error?.response?.data });
	}
}

export async function postGovNotifyEvent(inputEvent: any): Promise<SendMessageCommandOutput> {
	const event = structuredClone(inputEvent);
	event.Message.emailAddress = EMAIL_ADDRESS;
	console.log(JSON.stringify(event));
	const command = new SendMessageCommand({
		QueueUrl: GOV_NOTIFY_SQS_URL,
		MessageBody: JSON.stringify(event),
	});
	return sqsClient.send(command);
}

export async function purgeTxmaSqsQueue(): Promise<SendMessageCommandOutput> {
	const command = new PurgeQueueCommand({
		QueueUrl: MOCK_TXMA_SQS_URL,
	});
	return sqsClient.send(command);
}

export async function getTxmaSqsEvent(): Promise<any> {
	const command = new ReceiveMessageCommand({
		AttributeNames: ["SentTimestamp"],
		MaxNumberOfMessages: 10,
		MessageAttributeNames: ["All"],
		QueueUrl: MOCK_TXMA_SQS_URL,
		VisibilityTimeout: 40,
		WaitTimeSeconds: 20,
	});
	return sqsClient.send(command);
}

export async function getSessionByUserId(userId: string, tableName: string): Promise<SessionEvent | undefined> {
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
		) as unknown as SessionEvent;
	} catch (e: any) {
		console.error({ message: "getSessionByUserId - failed getting session from Dynamo", e, data: e.response.data });
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
