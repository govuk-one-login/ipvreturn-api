 
 
 
import { mock } from "jest-mock-extended";
import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { IPRServiceSession } from "../../../services/IPRServiceSession";
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

let iprServiceSession: IPRServiceSession;
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
		component_id: "test-component-id",
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
		iprServiceSession = new IPRServiceSession(tableName, logger, mockDynamoDbClient);
	});

	describe("isFlaggedForDeletionOrEventAlreadyProcessed", () => {
		it("Should throw error if isFlaggedForDeletionOrEventAlreadyProcessed check fails", async () => {
			return expect(
				iprServiceSession.isFlaggedForDeletionOrEventAlreadyProcessed(userId, Constants.AUTH_IPV_AUTHORISATION_REQUESTED),
			).rejects.toThrow(
				expect.objectContaining({
					statusCode: HttpCodesEnum.SERVER_ERROR,
				}),
			);
		});

		it("Should return false for isFlaggedForDeletionOrEventAlreadyProcessed if record does not exist", async () => {
			mockDynamoDbClient.send = jest.fn().mockResolvedValue({});
			const result = await iprServiceSession.isFlaggedForDeletionOrEventAlreadyProcessed(userId, Constants.AUTH_IPV_AUTHORISATION_REQUESTED);
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
			const result = await iprServiceSession.isFlaggedForDeletionOrEventAlreadyProcessed(userId, Constants.AUTH_IPV_AUTHORISATION_REQUESTED);
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
			const result = await iprServiceSession.isFlaggedForDeletionOrEventAlreadyProcessed(userId, Constants.AUTH_IPV_AUTHORISATION_REQUESTED);
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
			const result = await iprServiceSession.isFlaggedForDeletionOrEventAlreadyProcessed(userId, Constants.AUTH_IPV_AUTHORISATION_REQUESTED);
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
			const result = await iprServiceSession.isFlaggedForDeletionOrEventAlreadyProcessed(userId, Constants.F2F_YOTI_START);
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
			const result = await iprServiceSession.isFlaggedForDeletionOrEventAlreadyProcessed(userId, Constants.IPV_F2F_CRI_VC_CONSUMED);
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
			const result = await iprServiceSession.isFlaggedForDeletionOrEventAlreadyProcessed(userId, Constants.AUTH_DELETE_ACCOUNT);
			expect(result).toBe(true);
		});
	
		it("Should not process the AUTH_DELETE_ACCOUNT session record is not found", async () => {
			mockDynamoDbClient.send = jest.fn().mockResolvedValue({});
			const result = await iprServiceSession.isFlaggedForDeletionOrEventAlreadyProcessed(userId, Constants.AUTH_DELETE_ACCOUNT);
			expect(result).toBe(true);
		});

		it("Should not process the IPV_F2F_USER_CANCEL_END event if value is set for accountDeletedOn", async () => {
			const recordFlaggedForAlreadyProcessed = {
				Item: {
					accountDeletedOn: 1681902001,
					userId: "SESSID",
				},
			};
			mockDynamoDbClient.send = jest.fn().mockResolvedValue(recordFlaggedForAlreadyProcessed);
			const result = await iprServiceSession.isFlaggedForDeletionOrEventAlreadyProcessed(userId, Constants.IPV_F2F_USER_CANCEL_END);
			expect(result).toBe(true);
		});
	
		it("Should not process the IPV_F2F_USER_CANCEL_END session record is not found", async () => {
			mockDynamoDbClient.send = jest.fn().mockResolvedValue({});
			const result = await iprServiceSession.isFlaggedForDeletionOrEventAlreadyProcessed(userId, Constants.IPV_F2F_USER_CANCEL_END);
			expect(result).toBe(true);
		});
	});

	describe("saveEventData", () => {
		it("Should throw error if saveEventData fails", async () => {
			mockDynamoDbClient.send = jest.fn().mockRejectedValue({});
			return expect(iprServiceSession.saveEventData(userId, authRequestedUpdateExpression, authRequestedExpressionAttributeValues)).rejects.toThrow(
				expect.objectContaining({
					statusCode: HttpCodesEnum.SERVER_ERROR,
				}),
			);
		});
	});


	describe("deleteUserSession", () => {
		it("Should throw error if deleteUserSession fails", async () => {
			mockDynamoDbClient.send = jest.fn().mockRejectedValue({});
			return expect(iprServiceSession.deleteUserSession(userId)).rejects.toThrow(
				expect.objectContaining({
					statusCode: HttpCodesEnum.SERVER_ERROR,
				}),
			);
		});
	});

	describe("sendToTXMA", () => {
		it("Should send event to TxMA without encodedHeader if encodedHeader param is missing", async () => {
			const messageBody = JSON.stringify(txmaEventPayload);

			await iprServiceSession.sendToTXMA(txmaEventPayload);

			expect(SendMessageCommand).toHaveBeenCalledWith({
				MessageBody: messageBody,
				QueueUrl: process.env.TXMA_QUEUE_URL,
			});
			expect(sqsClient.send).toHaveBeenCalled();
			expect(iprServiceSession.logger.info).toHaveBeenCalledWith("Sent message to TxMA");
		});

		it("Should send event to TxMA without encodedHeader if encodedHeader param is empty", async () => {  	
			const messageBody = JSON.stringify(txmaEventPayload);	
			
			await iprServiceSession.sendToTXMA(txmaEventPayload, "");
	
			expect(SendMessageCommand).toHaveBeenCalledWith({
				MessageBody: messageBody,
				QueueUrl: process.env.TXMA_QUEUE_URL,
			});
			expect(sqsClient.send).toHaveBeenCalled();
			expect(iprServiceSession.logger.info).toHaveBeenCalledWith("Sent message to TxMA");
		});
	
		it("Should send event to TxMA with the correct details for a payload without restricted present", async () => {  
			await iprServiceSession.sendToTXMA(txmaEventPayload, "ENCHEADER");
	
			const messageBody = JSON.stringify({
				...txmaEventPayload,
				restricted: {
					device_information: {
						encoded: "ENCHEADER",
					},
				},
			});
		
			expect(SendMessageCommand).toHaveBeenCalledWith({
				MessageBody: messageBody,
				QueueUrl: process.env.TXMA_QUEUE_URL,
			});
			expect(sqsClient.send).toHaveBeenCalled();
			expect(iprServiceSession.logger.info).toHaveBeenCalledWith("Sent message to TxMA");
		});

		it("Should send event to TxMA with the correct details for a payload with restricted present", async () => {  
			const restrictedDetails = {
				device_information: {
					encoded: "ENCHEADER",
				},
			};
	
			const payload = { ...txmaEventPayload, ...restrictedDetails };
	
			await iprServiceSession.sendToTXMA(payload);
			const messageBody = JSON.stringify(payload);
	
			expect(SendMessageCommand).toHaveBeenCalledWith({
				MessageBody: messageBody,
				QueueUrl: process.env.TXMA_QUEUE_URL,
			});
			expect(sqsClient.send).toHaveBeenCalled();
			expect(iprServiceSession.logger.info).toHaveBeenCalledWith("Sent message to TxMA");
		});


		it("Should send event to TxMA with the correct details for a payload with extensions present", async () => {  
			const extensions = {
				previous_govuk_signin_journey_id: "test_previous_govuk_signin_journey_id",
				emailType: "testEmailType"
			};

			const payload = { ...txmaEventPayload, ...extensions };

			await iprServiceSession.sendToTXMA(payload);
			const messageBody = JSON.stringify(payload);

			expect(SendMessageCommand).toHaveBeenCalledWith({
				MessageBody: messageBody,
				QueueUrl: process.env.TXMA_QUEUE_URL,
			});
			expect(sqsClient.send).toHaveBeenCalled();
			expect(iprServiceSession.logger.info).toHaveBeenCalledWith("Sent message to TxMA");
		});
	
		it("Should throw error if is fails to send to TXMA queue", async () => {
			sqsClient.send.mockRejectedValueOnce({});

			await iprServiceSession.sendToTXMA(txmaEventPayload);
	
			expect(logger.error).toHaveBeenCalledWith({
				message: "Error when sending event IPR_RESULT_NOTIFICATION_EMAILED to TXMA Queue",
				error: {},
				messageCode: MessageCodes.FAILED_TO_WRITE_TXMA,
			});
		});
	});

	describe("getSessionBySub", () => {
		it("Should throw error if session has expired", async () => {
			mockDynamoDbClient.send = jest.fn().mockResolvedValue({
				Item: {
					expiresOn: absoluteTimeNow() - 1000,
				},
			});

			await expect(iprServiceSession.getSessionBySub(userId)).rejects.toThrow(new AppError( HttpCodesEnum.UNAUTHORIZED, "Session has expired"));
			expect(logger.error).toHaveBeenCalledWith({ message: "Session has expired", messageCode: MessageCodes.SESSION_EXPIRED });
		});

		it("Should throw error if dynamo get command fails", async () => {
			mockDynamoDbClient.send = jest.fn().mockRejectedValue({});

			await expect(iprServiceSession.getSessionBySub(userId)).rejects.toThrow(new AppError(HttpCodesEnum.SERVER_ERROR, "Error retrieving Session"));
			expect(logger.error).toHaveBeenCalledWith({ message: "getSessionBySub - failed executing get from dynamodb" });
		});

		it("Should return the valid session fetched from dynamo", async () => {
			const Item = {
				userId,
				expiresOn: absoluteTimeNow() + 1000,
				userEmail: "test@digital.cabinet-office.gov.uk",
			};
			mockDynamoDbClient.send = jest.fn().mockResolvedValue({ Item });
			const result = await iprServiceSession.getSessionBySub(userId);
			expect(result).toEqual(Item);
		});
	});

	describe("obfuscateJSONValues", () => {
		it("should obfuscate all fields except those in txmaFieldsToShow", async () => {
			const inputObject = {
				field1: "sensitive1",
				field2: "sensitive2",
				field3: "non-sensitive",
				nested: {
					field4: "sensitive3",
					field5: "non-sensitive",
					field6: null,
					field7: undefined,
				},
			};
	
			const txmaFieldsToShow = ["field3", "field5"];
	
			const obfuscatedObject = await iprServiceSession.obfuscateJSONValues(inputObject, txmaFieldsToShow);
	
			// Check that sensitive fields are obfuscated and non-sensitive fields are not
			expect(obfuscatedObject.field1).toBe("***");
			expect(obfuscatedObject.field2).toBe("***");
			expect(obfuscatedObject.field3).toBe("non-sensitive");
			expect(obfuscatedObject.nested.field4).toBe("***");
			expect(obfuscatedObject.nested.field5).toBe("non-sensitive");
			expect(obfuscatedObject.nested.field6).toBeNull();
			expect(obfuscatedObject.nested.field7).toBeUndefined();
		});
	
		it("should handle arrays correctly", async () => {
			const inputObject = {
				field1: "sensitive1",
				arrayField: [
					{
						field2: "sensitive2",
						field3: "non-sensitive",
					},
					{
						field2: "sensitive3",
						field3: "non-sensitive",
					},
				],
			};
	
			const txmaFieldsToShow = ["field3"];
	
			const obfuscatedObject = await iprServiceSession.obfuscateJSONValues(inputObject, txmaFieldsToShow);
	
			// Check that sensitive fields are obfuscated and non-sensitive fields are not
			expect(obfuscatedObject.field1).toBe("***");
			expect(obfuscatedObject.arrayField[0].field2).toBe("***");
			expect(obfuscatedObject.arrayField[0].field3).toBe("non-sensitive");
			expect(obfuscatedObject.arrayField[1].field2).toBe("***");
			expect(obfuscatedObject.arrayField[1].field3).toBe("non-sensitive");
		});
	
		it("should obfuscate values of different types", async () => {
			const inputObject = {
				stringField: "sensitive-string",
				numberField: 42,
				booleanField: true,
			};
	
			const txmaFieldsToShow: string[] | undefined = [];
	
			const obfuscatedObject = await iprServiceSession.obfuscateJSONValues(inputObject, txmaFieldsToShow);
	
			// Check that all fields are obfuscated
			expect(obfuscatedObject.stringField).toBe("***");
			expect(obfuscatedObject.numberField).toBe("***");
			expect(obfuscatedObject.booleanField).toBe("***");
		});
	
		it('should return "***" for non-object input', async () => {
			const input = "string-input";
	
			const obfuscatedValue = await iprServiceSession.obfuscateJSONValues(input);
	
			// Check that non-object input is obfuscated as '***'
			expect(obfuscatedValue).toBe("***");
		});
	});
});
