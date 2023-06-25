import { randomUUID } from "crypto";
import { SendMessageCommand, SendMessageCommandOutput, SQSClient } from "@aws-sdk/client-sqs";
import { ReturnSQSEvent } from "../../../models/ReturnSQSEvent";
import { DynamoDBClient, GetItemCommand, GetItemCommandOutput } from "@aws-sdk/client-dynamodb";

const MOCK_TXMA_SQS_URL = "https://sqs.eu-west-2.amazonaws.com/489145412748/backend-ddunford-ipvr-MockTxMASQSQueue-eya9dVlVYRRL";
const AWS_REGION = process.env['AWS_REGION'];
const SESSION_EVENTS_TABLE = process.env['API_TEST_SESSION_EVENTS_TABLE'];

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

export async function getCompletedDynamoRecord(user: string): Promise<GetItemCommandOutput> {
  const command = new GetItemCommand({
    Key: {
      userId: {"S": user},
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
