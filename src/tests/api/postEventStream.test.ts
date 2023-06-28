import {
  VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT,
  VALID_IPV_F2F_CRI_VC_CONSUMED_TXMA_EVENT,
  VALID_F2F_YOTI_START_TXMA_EVENT,
} from "../data/sqs-events";
import 'dotenv/config';
import { randomUUID } from "crypto";
import { getCompletedDynamoRecord, postMockEvent } from "./utils/ApiTestSteps";


describe("post Events on to mock SQS queue", () => {

  let user : string;

  beforeAll(() => {
    user = randomUUID();
  });

  it("should post an AUTH_IPV_AUTHORISATION_REQUESTED TxMA event", async () => {
    const response = await postMockEvent(VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT, user);
    console.log(response);
    expect(response.MessageId).toBeTruthy();
  });

  it("should post an VALID_IPV_F2F_CRI_VC_CONSUMED_TXMA_EVENT TxMA event", async () => {
    const response = await postMockEvent(VALID_IPV_F2F_CRI_VC_CONSUMED_TXMA_EVENT, user);
    console.log(response);
    expect(response.MessageId).toBeTruthy();
  });

  it("should post an VALID_F2F_YOTI_START_TXMA_EVENT TxMA event", async () => {
    const response = await postMockEvent(VALID_F2F_YOTI_START_TXMA_EVENT, user);
    console.log(response);
    expect(response.MessageId).toBeTruthy();
  });

  it("should eventually result in a Dynamo record with the details of all three events populated", async () => {
    const response = await getCompletedDynamoRecord(user);
    console.log(response);
    expect(response.Item?.notified).toEqual({BOOL: true});
    expect(response.Item?.nameParts).toEqual({
      L: [
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
      ],
    });
    expect(response.Item?.clientName).toEqual({S: "ekwU"});
    expect(response.Item?.redirectUri).toEqual({S: "REDIRECT_URL"});
    expect(response.Item?.userEmail).toEqual({S: "jest@test.com"});
  });



});
