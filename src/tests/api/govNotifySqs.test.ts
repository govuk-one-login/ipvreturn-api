import {
  VALID_GOV_NOTIFY_SQS_TXMA_EVENT,
  } from "../data/sqs-events";
  import 'dotenv/config';
  import { postGovNotifyEvent, purgeTxmaSqsQueue, getTxmaSqsEvent } from "./utils/ApiTestSteps";
  
  
  describe("TxMA Events from Gov Notify SQS queue", () => {

    beforeEach(async () => {
    jest.setTimeout(10000);
    });
  
    it("should post an VALID_GOV_NOTIFY_SQS_TXMA_EVENT TxMA event", async () => {
      await purgeTxmaSqsQueue();
      const response = await postGovNotifyEvent(VALID_GOV_NOTIFY_SQS_TXMA_EVENT);
      console.log(response);
      expect(response.MessageId).toBeTruthy();
    });

    it("should result in a TxMA event with event name IPR_RESULT_NOTIFICATION_EMAILED", async () => {
      const response = await getTxmaSqsEvent();
      const messageBody = JSON.parse(response.Messages[0].Body);
      expect(messageBody.event_name).toEqual("IPR_RESULT_NOTIFICATION_EMAILED");
    });

});

  