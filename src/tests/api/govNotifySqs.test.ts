import {
	VALID_GOV_NOTIFY_SQS_TXMA_EVENT,
} from "../data/sqs-events";
import "dotenv/config";
import { postGovNotifyEvent, purgeTxmaSqsQueue, getTxmaSqsEvent } from "./utils/ApiTestSteps";


describe("TxMA Events from Gov Notify SQS queue", () => {

	beforeEach(() => {
		jest.setTimeout(10000);
	});

	// TODO these are commented out until F2F-583 is merged 
	// eslint-disable-next-line @typescript-eslint/tslint/config
	it.skip("should post an VALID_GOV_NOTIFY_SQS_TXMA_EVENT TxMA event", async () => {
		await purgeTxmaSqsQueue();
		const response = await postGovNotifyEvent(VALID_GOV_NOTIFY_SQS_TXMA_EVENT);
		console.log(response);
		expect(response.MessageId).toBeTruthy();
	});

	// TODO these are commented out until F2F-583 is merged
	// eslint-disable-next-line @typescript-eslint/tslint/config
	it.skip("should result in a TxMA event with event name IPR_RESULT_NOTIFICATION_EMAILED", async () => {
		const response = await getTxmaSqsEvent();
		const messageBody = JSON.parse(response.Messages[0].Body);
		expect(messageBody.event_name).toBe("IPR_RESULT_NOTIFICATION_EMAILED");
	});

});
