# Test Harness

This is a test harness that listens to events from the TxMA SQS queue and puts it in the `${AWS::StackName}-ipvreturn-event-test-${Environment}` bucket which can then be accessed using and API.

This test harness is only to be used in dev and build environments

## How to use
1. Deploy a custom ipvreturn stack with the changes that you'd like to test. If you would like to test against what is in dev then ignore this step
2. Update the test-harness/samconfig.toml with a stack name, and the backend stack that you'd like to use (if you don't change this the dev stack will be used)

To test SQS events:

3. Trigger the events that you are looking for 
4. Call the `/bucket/` endpoint with a prefix (eg `txma/`) to get all event objects from S3. Alternatively call the `/object/{object-key}` to get a specific event object from S3

To write SQS events:

3. Make a call to `/send-mock-txma-message` with the message body that you would like. Note this this will only send messages to the MockTxMAQueue

To test DynamoDB changes:

3. Make change to DB item that you are looking for
4. Call the `/getRecord/{tableName}/{sessionId}` endpoint

## Architecture
![Architecture diagram](./docs/test-harness.png)
