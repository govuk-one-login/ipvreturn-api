import { randomUUID } from "crypto";
import { SendMessageCommand, SendMessageCommandOutput, SQSClient, PurgeQueueCommand, ReceiveMessageCommand } from "@aws-sdk/client-sqs";
import { ReturnSQSEvent } from "../../../models/ReturnSQSEvent";
import { DynamoDBClient, GetItemCommand, GetItemCommandOutput } from "@aws-sdk/client-dynamodb";
import axios from "axios";


const TXMA_SQS_URL = process.env['API_TEST_GOV_NOTIFY_SQS_QUEUE'];
const MOCK_TXMA_SQS_URL = process.env['API_TEST_SQS_TXMA_CONSUMER_QUEUE'];
const GOV_NOTIFY_SQS_URL = process.env['API_TEST_GOV_NOTIFY_SQS_QUEUE'];
const AWS_REGION = process.env['AWS_REGION'];
const SESSION_EVENTS_TABLE = process.env['API_TEST_SESSION_EVENTS_TABLE'];
const EMAIL_ADDRESS = process.env['API_TEST_SESSION_EVENTS_TABLE'];
const GOV_NOTIFY_INSTANCE = axios.create({ baseURL: process.env['GOVUKNOTIFYAPI'] });

const sqsClient = new SQSClient({
  region: AWS_REGION,
});
const dynamoClient = new DynamoDBClient({
  region: AWS_REGION,
})

export async function postMockEvent(inputEvent: ReturnSQSEvent, user: string): Promise<SendMessageCommandOutput> {
  const event = structuredClone(inputEvent);
  event.event_id = randomUUID();
  event.user.user_id = user;
  const timestamp = new Date();
  timestamp.setMilliseconds(0);
  event.timestamp = timestamp.getTime() / 1000;
  event.timestamp_formatted = timestamp.toISOString();
  const command = new SendMessageCommand({
    QueueUrl: MOCK_TXMA_SQS_URL,
    MessageBody: JSON.stringify(event),
  });
  return sqsClient.send(command);
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
    QueueUrl: TXMA_SQS_URL,
  });
  return sqsClient.send(command);
}

export async function getTxmaSqsEvent(): Promise<any> {
  const command = new ReceiveMessageCommand({
    AttributeNames: ["SentTimestamp"],
    MaxNumberOfMessages: 10,
    MessageAttributeNames: ["All"],
    QueueUrl: TXMA_SQS_URL,
    VisibilityTimeout: 40,
    WaitTimeSeconds: 20,
  });
  return sqsClient.send(command);
}

export async function getCompletedDynamoRecord(user: string): Promise<GetItemCommandOutput> {
  const command = new GetItemCommand({
    Key: {
      userId: { "S": user },
    },
    TableName: SESSION_EVENTS_TABLE,
  });
  console.log(command)
  let response: GetItemCommandOutput;
  do {
    response = await dynamoClient.send(command);
  } while (!(response.Item?.notified && response.Item.notified.BOOL));
  return response;
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

  function insertBeforeLastOccurrence(strToSearch: string, strToFind: string, strToInsert: string) {
    var n = strToSearch.lastIndexOf(strToFind);
    if (n < 0) return strToSearch;
    return strToSearch.substring(0, n) + strToInsert + strToSearch.substring(n);
  }
}
