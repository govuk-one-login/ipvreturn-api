import { mock } from "jest-mock-extended";
import { IPRService } from "../../../services/IPRService";
import { Logger } from "@aws-lambda-powertools/logger";
import { createDynamoDbClient } from "../../../utils/DynamoDBFactory";
import { HttpCodesEnum } from "../../../models/enums/HttpCodesEnum";

const logger = mock<Logger>();

let iprService: IPRService;
const tableName = "MYTABLE";
const userId = "SESSID";
const mockDynamoDbClient = jest.mocked(createDynamoDbClient());
const authRequestedUpdatExpression = "SET ipvStartedOn = :ipvStartedOn, userEmail = :userEmail, nameParts = :nameParts, clientName = :clientName,  redirectUri = :redirectUri";
const authRequestedExpressionAttributeValues = {
	":ipvStartedOn": "1681902001",
	":userEmail": "viveak@test.com",
	":nameParts": [{ type: "Firstname", value: "test" }],
	":clientName": "RqFZ83csmS4Mi4Y7s7ohD9-ekwU",
	":redirectUri": "UNKNOWN",
};


describe("IPR Service", () => {
	
	beforeAll(() => {
		jest.clearAllMocks();
	});

	beforeEach(() => {
		jest.resetAllMocks();
		iprService = new IPRService(tableName, logger, mockDynamoDbClient);

	});

	it("Should throw error if isFlaggedForDeletion check fails", async () => {
		return expect(iprService.isFlaggedForDeletion(userId)).rejects.toThrow(expect.objectContaining({
			statusCode: HttpCodesEnum.SERVER_ERROR,
		}));
	});

	it("Should return false  for isFlaggedForDeletion if record does not exist", async () => {
		mockDynamoDbClient.send = jest.fn().mockResolvedValue({});
		const result = await iprService.isFlaggedForDeletion(userId);
		expect(result).toBe(false);
	});

	it("Should return false  for isFlaggedForDeletion if record exist", async () => {
		const recordNotFlaggedForDeletetion = {
			Session:  {
				Item: {
					clientName: "",
					userEmail: "",
					ipvStartedOn: 1681902001,
					userId: "01333e01-dde3-412f-a484-3333",
					accountDeletedOn: 1681902001,
					nameParts: [],
					redirectUri: "",
				},
			},
		};
		mockDynamoDbClient.send = jest.fn().mockResolvedValue( recordNotFlaggedForDeletetion );
		const result = await iprService.isFlaggedForDeletion(userId);
		expect(result).toBe(false);
	});

	it("Should return true for isFlaggedForDeletion if record exist and value set for accountDeletedOn", async () => {
		const recordNotFlaggedForDeletetion = {
			Session:  {
				Item: {
					clientName: "",
					userEmail: "",
					ipvStartedOn: 1681902001,
					userId: "01333e01-dde3-412f-a484-3333",
					accountDeletedOn: 1681902001,
					nameParts: [],
					redirectUri: "",
				},
			},
		};
		mockDynamoDbClient.send = jest.fn().mockResolvedValue( recordNotFlaggedForDeletetion );
		const result = await iprService.isFlaggedForDeletion(userId);
		expect(result).toBe(false);
	});

	it("Should throw error if saveEventData fails", async () => {
		return expect(iprService.saveEventData(userId, authRequestedUpdatExpression, authRequestedExpressionAttributeValues)).rejects.toThrow(expect.objectContaining({
			statusCode: HttpCodesEnum.SERVER_ERROR,
		}));
	});
});
