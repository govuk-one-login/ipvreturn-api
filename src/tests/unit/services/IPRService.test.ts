/* eslint-disable @typescript-eslint/unbound-method */
import { mock } from "jest-mock-extended";
import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { IPRService } from "../../../services/IPRService";
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

let iprService: IPRService;
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
		iprService = new IPRService(tableName, logger, mockDynamoDbClient);
	});

	describe("isFlaggedForDeletionOrEventAlreadyProcessed", () => {
		it("Should throw error if isFlaggedForDeletionOrEventAlreadyProcessed check fails", async () => {
			return expect(
				iprService.isFlaggedForDeletionOrEventAlreadyProcessed(userId, Constants.AUTH_IPV_AUTHORISATION_REQUESTED),
			).rejects.toThrow(
				expect.objectContaining({
					statusCode: HttpCodesEnum.SERVER_ERROR,
				}),
			);
		});

		it("Should return false for isFlaggedForDeletionOrEventAlreadyProcessed if record does not exist", async () => {
			mockDynamoDbClient.send = jest.fn().mockResolvedValue({});
			const result = await iprService.isFlaggedForDeletionOrEventAlreadyProcessed(userId, Constants.AUTH_IPV_AUTHORISATION_REQUESTED);
			expect(result).toBe(false);
		});

		it("Should return false for isFlaggedForDeletionOrEventAlreadyProcessed if record exist and ipvStartedOn flag is not set", async () => {
			const recordNotFlaggedForDeletetionAndNotProcessed = {
				Item: {
					clientName: "",
					userEmail: "",
					userId: "SESSID",
					nameParts: [],
					redirectUri: "",
				},
			};
			mockDynamoDbClient.send = jest.fn().mockResolvedValue(recordNotFlaggedForDeletetionAndNotProcessed);
			const result = await iprService.isFlaggedForDeletionOrEventAlreadyProcessed(userId, Constants.AUTH_IPV_AUTHORISATION_REQUESTED);
			expect(result).toBe(false);
		});

		it("Should return true for isFlaggedForDeletionOrEventAlreadyProcessed if record exist and value set for accountDeletedOn", async () => {
			const recordFlaggedForDeletetion = {
				Item: {
					clientName: "",
					userEmail: "",
					ipvStartedOn: 1681902001,
					userId: "SESSID",
					accountDeletedOn: 1681902001,
					nameParts: [],
					redirectUri: "",
				},
			};
			mockDynamoDbClient.send = jest.fn().mockResolvedValue(recordFlaggedForDeletetion);
			const result = await iprService.isFlaggedForDeletionOrEventAlreadyProcessed(userId, Constants.AUTH_IPV_AUTHORISATION_REQUESTED);
			expect(result).toBe(true);
		});

		it("Should not process the AUTH_IPV_AUTHORISATION_REQUESTED event if value is set for ipvStartedOn", async () => {
			const recordFlaggedForAlreadyProcessed = {
				Item: {
					clientName: "",
					userEmail: "",
					ipvStartedOn: 1681902001,
					userId: "SESSID",
					nameParts: [],
					redirectUri: "",
				},
			};
			mockDynamoDbClient.send = jest.fn().mockResolvedValue(recordFlaggedForAlreadyProcessed);
			const result = await iprService.isFlaggedForDeletionOrEventAlreadyProcessed(userId, Constants.AUTH_IPV_AUTHORISATION_REQUESTED);
			expect(result).toBe(true);
		});
	
		it("Should not process the F2F_YOTI_START event if value is set for journeyWentAsyncOn", async () => {
			const recordFlaggedForAlreadyProcessed = {
				Item: {
					journeyWentAsyncOn: 1681902001,
					userId: "SESSID",
				},
			};
			mockDynamoDbClient.send = jest.fn().mockResolvedValue(recordFlaggedForAlreadyProcessed);
			const result = await iprService.isFlaggedForDeletionOrEventAlreadyProcessed(userId, Constants.F2F_YOTI_START);
			expect(result).toBe(true);
		});
	
		it("Should not process the IPV_F2F_CRI_VC_CONSUMED event if value is set for readyToResumeOn", async () => {
			const recordFlaggedForAlreadyProcessed = {
				Item: {
					readyToResumeOn: 1681902001,
					userId: "SESSID",
				},
			};
			mockDynamoDbClient.send = jest.fn().mockResolvedValue(recordFlaggedForAlreadyProcessed);
			const result = await iprService.isFlaggedForDeletionOrEventAlreadyProcessed(userId, Constants.IPV_F2F_CRI_VC_CONSUMED);
			expect(result).toBe(true);
		});
	
		it("Should not process the AUTH_DELETE_ACCOUNT event if value is set for accountDeletedOn", async () => {
			const recordFlaggedForAlreadyProcessed = {
				Item: {
					accountDeletedOn: 1681902001,
					userId: "SESSID",
				},
			};
			mockDynamoDbClient.send = jest.fn().mockResolvedValue(recordFlaggedForAlreadyProcessed);
			const result = await iprService.isFlaggedForDeletionOrEventAlreadyProcessed(userId, Constants.AUTH_DELETE_ACCOUNT);
			expect(result).toBe(true);
		});
	
		it("Should not process the AUTH_DELETE_ACCOUNT session record is not found", async () => {
			mockDynamoDbClient.send = jest.fn().mockResolvedValue({});
			const result = await iprService.isFlaggedForDeletionOrEventAlreadyProcessed(userId, Constants.AUTH_DELETE_ACCOUNT);
			expect(result).toBe(true);
		});
	});

	describe("saveEventData", () => {
		it("Should throw error if saveEventData fails", async () => {
			mockDynamoDbClient.send = jest.fn().mockRejectedValue({});
			return expect(iprService.saveEventData(userId, authRequestedUpdateExpression, authRequestedExpressionAttributeValues)).rejects.toThrow(
				expect.objectContaining({
					statusCode: HttpCodesEnum.SERVER_ERROR,
				}),
			);
		});
	});

	describe("sendToTXMA", () => {
		it("Should send event to TXMA with the correct details", async () => {
			const messageBody = JSON.stringify(txmaEventPayload);

			await iprService.sendToTXMA(txmaEventPayload);

			expect(SendMessageCommand).toHaveBeenCalledWith({
				MessageBody: messageBody,
				QueueUrl: process.env.TXMA_QUEUE_URL,
			});
			expect(sqsClient.send).toHaveBeenCalled();
		});

		it("Should throw error if is fails to send to TXMA queue", async () => {
			sqsClient.send.mockRejectedValueOnce({});
	
			await expect(iprService.sendToTXMA(txmaEventPayload)).rejects.toThrow(expect.objectContaining({
				statusCode: HttpCodesEnum.SERVER_ERROR,
				message: "sending event to txma queue - failed",
			}));
		});
	});

	describe("getSessionBySub", () => {
		it.skip("Should throw error if session has expired", async () => {
			mockDynamoDbClient.send = jest.fn().mockResolvedValue({
				Item: {
					expiresOn: absoluteTimeNow() - 1000,
				},
			});

			await expect(iprService.getSessionBySub(userId)).rejects.toThrow(new AppError( HttpCodesEnum.UNAUTHORIZED, "Session has expired"));
			expect(logger.error).toHaveBeenCalledWith({ message: "Session has expired", messageCode: MessageCodes.SESSION_EXPIRED });
		});

		it("Should throw error if dynamo get command fails", async () => {
			mockDynamoDbClient.send = jest.fn().mockRejectedValue({});

			await expect(iprService.getSessionBySub(userId)).rejects.toThrow(new AppError(HttpCodesEnum.SERVER_ERROR, "Error retrieving Session"));
			expect(logger.error).toHaveBeenCalledWith({ message: "getSessionByUserId - failed executing get from dynamodb:", error: {} });
		});

		it("Should return the valid session fetched from dynamo", async () => {
			const Item = {
				userId,
				expiresOn: absoluteTimeNow() + 1000,
				userEmail: "test@digital.cabinet-office.gov.uk",
			};
			mockDynamoDbClient.send = jest.fn().mockResolvedValue({ Item });
			const result = await iprService.getSessionBySub(userId);
			expect(result).toEqual(Item);
		});
	});
});
