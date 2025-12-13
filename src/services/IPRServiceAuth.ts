 
import { Logger } from "@aws-lambda-powertools/logger";
import { AppError } from "../utils/AppError";
import { DynamoDBDocument, GetCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { HttpCodesEnum } from "../models/enums/HttpCodesEnum";
import { Constants } from "../utils/Constants";
import { EnvironmentVariables } from "./EnvironmentVariables";
import { ServicesEnum } from "../models/enums/ServicesEnum";
import { AuthEvent } from "../models/AuthEvent";
import { MessageCodes } from "../models/enums/MessageCodes";
import { absoluteTimeNow } from "../utils/DateTimeUtils";

export class IPRServiceAuth {
	readonly tableName: string;

	private readonly dynamo: DynamoDBDocument;

	readonly logger: Logger;

	private readonly environmentVariables: EnvironmentVariables;

	private static instance: IPRServiceAuth;

	private readonly eventAttributeMap = new Map<string, string>([
		[Constants.AUTH_IPV_AUTHORISATION_REQUESTED, "ipvStartedOn"],
	]);

	constructor(tableName: any, logger: Logger, dynamoDbClient: DynamoDBDocument) {
		this.tableName = tableName;
		this.dynamo = dynamoDbClient;
		this.logger = logger;
		this.environmentVariables = new EnvironmentVariables(logger, ServicesEnum.NA);
	}

	static getInstance(tableName: string, logger: Logger, dynamoDbClient: DynamoDBDocument): IPRServiceAuth {
		if (!IPRServiceAuth.instance) {
			IPRServiceAuth.instance = new IPRServiceAuth(tableName, logger, dynamoDbClient);
		}
		return IPRServiceAuth.instance;
	}

	async getAuthEventBySub(userId: string): Promise<AuthEvent | undefined> {
		const getAuthEventCommand = new GetCommand({
			TableName: this.tableName,
			Key: {
				userId,
			},
		});
		let event;
		try {
			event = await this.dynamo.send(getAuthEventCommand);
		} catch (error: any) {
			this.logger.error({ message: "getAuthEventBySub - failed executing get from dynamodb", name: error?.name, info: error?.message });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, "Error retrieving Session");
		}

		if (event.Item) {
			if (event.Item.expiresOn < absoluteTimeNow()) {
				this.logger.error({ message: "Auth event has expired", messageCode: MessageCodes.AUTH_EVENT_EXPIRED });
				throw new AppError( HttpCodesEnum.UNAUTHORIZED, "Auth event has expired");
			}
			return event.Item as AuthEvent;
		}
	}

	async saveEventData(userId: string, updateExpression: string, expressionAttributeValues: any): Promise<string | void> {
		this.logger.info({ message: "Saving event data to dynamodb", tableName: this.tableName });
		const updateSessionInfoCommand = new UpdateCommand({
			TableName: this.tableName,
			Key: {
				userId,
			},
			UpdateExpression: updateExpression,
			ExpressionAttributeValues: expressionAttributeValues,
		});

		this.logger.info("Updating auth event record");

		try {
			await this.dynamo.send(updateSessionInfoCommand);
		} catch (e: any) {
			this.logger.error({ message: "Failed to update auth event record in dynamo", e });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, "Error updating auth event record");
		}
	}

	async deleteUserSession(userId: string): Promise<string | void> {

		this.logger.info({ message: "Deleting user data from dynamodb", tableName: this.tableName });
		const deleteSessionInfoCommand = new DeleteCommand({
			TableName: this.tableName,
			Key: {
				userId,
			}
		});

		this.logger.info("Deleting auth event record" );

		try {
			await this.dynamo.send(deleteSessionInfoCommand);
		} catch (e: any) {
			this.logger.error({ message: "Failed to delete auth event record in dynamo", e });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, "Error deleting auth event record");
		}
	}
}
