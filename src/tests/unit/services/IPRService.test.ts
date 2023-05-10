import { mock } from "jest-mock-extended";
import { IPRService } from "../../../services/IPRService";
import { Logger } from "@aws-lambda-powertools/logger";
import { createDynamoDbClient } from "../../../utils/DynamoDBFactory";
import { HttpCodesEnum } from "../../../models/enums/HttpCodesEnum";
import { Constants } from "../../../utils/Constants";

const logger = mock<Logger>();

let iprService: IPRService;
const tableName = "MYTABLE";
const userId = "SESSID";
const mockDynamoDbClient = jest.mocked(createDynamoDbClient());
const authRequestedUpdatExpression = "SET ipvStartedOn = :ipvStartedOn, userEmail = :userEmail, nameParts = :nameParts, clientName = :clientName,  redirectUri = :redirectUri";
const authRequestedExpressionAttributeValues = {
	":ipvStartedOn": 1681902001,
	":userEmail": "viveak@test.com",
	":nameParts": [{ type: "Firstname", value: "test" }],
	// pragma: allowlist secret
	":clientName": "RqFZ83csmS4Mi4Y7s7ohD9-ekwU",
	":redirectUri": "UNKNOWN",
	":expiryDate": 604800 * 1000,
};


describe("IPR Service", () => {
	
	beforeAll(() => {
		jest.clearAllMocks();
	});

	beforeEach(() => {
		jest.resetAllMocks();
		iprService = new IPRService(tableName, logger, mockDynamoDbClient);

	});

	it("Should throw error if isFlaggedForDeletionOrEventAlreadyProcessed check fails", async () => {
		return expect(iprService.isFlaggedForDeletionOrEventAlreadyProcessed(userId, Constants.AUTH_IPV_AUTHORISATION_REQUESTED)).rejects.toThrow(expect.objectContaining({
			statusCode: HttpCodesEnum.SERVER_ERROR,
		}));
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
		mockDynamoDbClient.send = jest.fn().mockResolvedValue( recordNotFlaggedForDeletetionAndNotProcessed );
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
		mockDynamoDbClient.send = jest.fn().mockResolvedValue( recordFlaggedForDeletetion );
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
		mockDynamoDbClient.send = jest.fn().mockResolvedValue( recordFlaggedForAlreadyProcessed );
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
		mockDynamoDbClient.send = jest.fn().mockResolvedValue( recordFlaggedForAlreadyProcessed );
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
		mockDynamoDbClient.send = jest.fn().mockResolvedValue( recordFlaggedForAlreadyProcessed );
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
		mockDynamoDbClient.send = jest.fn().mockResolvedValue( recordFlaggedForAlreadyProcessed );
		const result = await iprService.isFlaggedForDeletionOrEventAlreadyProcessed(userId, Constants.AUTH_DELETE_ACCOUNT);
		expect(result).toBe(true);
	});

	it("Should not process the AUTH_DELETE_ACCOUNT session record is not found", async () => {
		mockDynamoDbClient.send = jest.fn().mockResolvedValue({} );
		const result = await iprService.isFlaggedForDeletionOrEventAlreadyProcessed(userId, Constants.AUTH_DELETE_ACCOUNT);
		expect(result).toBe(true);
	});

	it("Should throw error if saveEventData fails", async () => {
		mockDynamoDbClient.send = jest.fn().mockRejectedValue({});
		return expect(iprService.saveEventData(userId, authRequestedUpdatExpression, authRequestedExpressionAttributeValues)).rejects.toThrow(expect.objectContaining({
			statusCode: HttpCodesEnum.SERVER_ERROR,
		}));
	});
});
