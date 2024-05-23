/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/unbound-method */
import { mock } from "jest-mock-extended";
import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { IPRServiceAuth } from "../../../services/IPRServiceAuth";
import { Logger } from "@aws-lambda-powertools/logger";
import { createDynamoDbClient } from "../../../utils/DynamoDBFactory";
import { sqsClient } from "../../../utils/SqsClient";
import { TxmaEvent } from "../../../utils/TxmaEvent";
import { AppError } from "../../../utils/AppError";
import { Constants } from "../../../utils/Constants";
import { absoluteTimeNow } from "../../../utils/DateTimeUtils";
import { HttpCodesEnum } from "../../../models/enums/HttpCodesEnum";
import { MessageCodes } from "../../../models/enums/MessageCodes";

const logger = mock<Logger>();

let iprServiceAuth: IPRServiceAuth;
const tableName = "MYTABLE";
const userId = "SESSID";
const mockDynamoDbClient = jest.mocked(createDynamoDbClient());
const authRequestedUpdateExpression =
	"SET ipvStartedOn = :ipvStartedOn, userEmail = :userEmail, nameParts = :nameParts, clientName = :clientName,  redirectUri = :redirectUri";
const authRequestedExpressionAttributeValues = {
	":ipvStartedOn": 1681902001,
	":userEmail": "viveak@test.com",
	":nameParts": [{ type: "Firstname", value: "test" }],
	":clientName": "ekwU",
	":redirectUri": "UNKNOWN",
	":expiresOn": 604800 * 1000,
};
function getTXMAEventPayload(): TxmaEvent {
	const txmaEventPayload: TxmaEvent = {
		event_name: "IPR_RESULT_NOTIFICATION_EMAILED",
		user: {
			user_id: "sessionCliendId",
		},
		timestamp: 123,
		event_timestamp_ms: 123000,
	};
	return txmaEventPayload;
}

jest.mock("../../../utils/SqsClient", () => ({
	sqsClient: {
		send: jest.fn(),
	},
}));
jest.mock("@aws-sdk/client-sqs", () => ({
	SendMessageCommand: jest.fn().mockImplementation(() => {}),
}));

describe("IPR Service", () => {
	let txmaEventPayload: TxmaEvent;

	beforeAll(() => {
		jest.clearAllMocks();
		txmaEventPayload = getTXMAEventPayload();
	});

	beforeEach(() => {
		jest.resetAllMocks();
		iprServiceAuth = new IPRServiceAuth(tableName, logger, mockDynamoDbClient);
	});

	describe("saveEventData", () => {
		it("Should throw error if saveEventData fails", async () => {
			mockDynamoDbClient.send = jest.fn().mockRejectedValue({});
			return expect(iprServiceAuth.saveEventData(userId, authRequestedUpdateExpression, authRequestedExpressionAttributeValues)).rejects.toThrow(
				expect.objectContaining({
					statusCode: HttpCodesEnum.SERVER_ERROR,
				}),
			);
		});
	});

	describe("getAuthEventBySub", () => {
		it("Should throw error if session has expired", async () => {
			mockDynamoDbClient.send = jest.fn().mockResolvedValue({
				Item: {
					expiresOn: absoluteTimeNow() - 1000,
				},
			});

			await expect(iprServiceAuth.getAuthEventBySub(userId)).rejects.toThrow(new AppError( HttpCodesEnum.UNAUTHORIZED, "Auth event has expired"));
			expect(logger.error).toHaveBeenCalledWith({ message: "Auth event has expired", messageCode: MessageCodes.AUTH_EVENT_EXPIRED });
		});

		it("Should throw error if dynamo get command fails", async () => {
			mockDynamoDbClient.send = jest.fn().mockRejectedValue({});

			await expect(iprServiceAuth.getAuthEventBySub(userId)).rejects.toThrow(new AppError(HttpCodesEnum.SERVER_ERROR, "Error retrieving Session"));
			expect(logger.error).toHaveBeenCalledWith({ message: "getAuthEventBySub - failed executing get from dynamodb" });
		});

		it("Should return the valid session fetched from dynamo", async () => {
			const Item = {
				userId,
				expiresOn: absoluteTimeNow() + 1000,
				userEmail: "test@digital.cabinet-office.gov.uk",
			};
			mockDynamoDbClient.send = jest.fn().mockResolvedValue({ Item });
			const result = await iprServiceAuth.getAuthEventBySub(userId);
			expect(result).toEqual(Item);
		});
	});
});
