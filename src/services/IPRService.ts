/* eslint-disable no-console */
import { Logger } from "@aws-lambda-powertools/logger";
import { AppError } from "../utils/AppError";
import { DynamoDBDocument, GetCommand, QueryCommandInput, UpdateCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { HttpCodesEnum } from "../models/enums/HttpCodesEnum";
import { IpvStartedOnEvent, JourneyWentAsyncOnEvent, ReadyToResumeOnEvent, AccountDeletedOnEvent } from "../models/IPREventTypes";

export class IPRService {
	readonly tableName: string;

	private readonly dynamo: DynamoDBDocument;

	readonly logger: Logger;

	private static instance: IPRService;

	constructor(tableName: any, logger: Logger, dynamoDbClient: DynamoDBDocument) {
		this.tableName = tableName;
		this.dynamo = dynamoDbClient;
		this.logger = logger;
	}

	static getInstance(tableName: string, logger: Logger, dynamoDbClient: DynamoDBDocument): IPRService {
		if (!IPRService.instance) {
			IPRService.instance = new IPRService(tableName, logger, dynamoDbClient);
		}
		return IPRService.instance;
	}

	async isFlaggedForDeletion(userId: string): Promise<boolean | undefined> {
		this.logger.debug("Table name " + this.tableName);
		const getSessionCommand = new GetCommand({
			TableName: this.tableName,
			Key: {
				userId,
			},
		});

		let session;
		try {
			session = await this.dynamo.send(getSessionCommand);
			if (session.Item) return session.Item.accountDeletedOn ? true : false;
		} catch (e: any) {
			this.logger.error({ message: "getSessionById - failed executing get from dynamodb:", e });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, "Error retrieving Session");
		}
		return false;
	}

	async saveEventData(userId: string, updateExpression: string, expressionAttributeValues: IpvStartedOnEvent | JourneyWentAsyncOnEvent | ReadyToResumeOnEvent | AccountDeletedOnEvent ): Promise<string | void> {
		const isFlaggedForDeletion = await this.isFlaggedForDeletion(userId);
		if (isFlaggedForDeletion) {
			this.logger.info({ message: "Record flagged for deletion, skipping update", userId });
			return "Record flagged for deletion, skipping update";
		}

		this.logger.debug("Table name " + this.tableName);
		const updateSessionInfoCommand = new UpdateCommand({
			TableName: this.tableName,
			Key: {
				userId,
			},
			UpdateExpression: updateExpression,
			ExpressionAttributeValues: expressionAttributeValues,
		});

		this.logger.info({ message: "Updating session record for userID:", userId });

		try {
			await this.dynamo.send(updateSessionInfoCommand);
		} catch (e: any) {
			this.logger.error({ message: "Failed to update session record in dynamo", e });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, "Error updating session record");
		}
	}

}
