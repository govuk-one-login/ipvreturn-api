 
import { logger } from "@govuk-one-login/cri-logger";
import { AppError } from "../utils/AppError";
import { DynamoDBDocument, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
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

	private readonly environmentVariables: EnvironmentVariables;

	private static instance: IPRServiceAuth;

	private readonly eventAttributeMap = new Map<string, string>([
		[Constants.AUTH_IPV_AUTHORISATION_REQUESTED, "ipvStartedOn"],
	]);

	constructor(tableName: any, dynamoDbClient: DynamoDBDocument) {
		this.tableName = tableName;
		this.dynamo = dynamoDbClient;
		this.environmentVariables = new EnvironmentVariables(ServicesEnum.NA);
	}

	static getInstance(tableName: string, dynamoDbClient: DynamoDBDocument): IPRServiceAuth {
		if (!IPRServiceAuth.instance) {
			IPRServiceAuth.instance = new IPRServiceAuth(tableName, dynamoDbClient);
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
			logger.error({ message: "getAuthEventBySub - failed executing get from dynamodb", name: error?.name, info: error?.message });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, "Error retrieving Session");
		}

		if (event.Item) {
			if (event.Item.expiresOn < absoluteTimeNow()) {
				logger.error({ message: "Auth event has expired", messageCode: MessageCodes.AUTH_EVENT_EXPIRED });
				throw new AppError( HttpCodesEnum.UNAUTHORIZED, "Auth event has expired");
			}
			return event.Item as AuthEvent;
		}
	}

	async saveEventData(userId: string, updateExpression: string, expressionAttributeValues: any): Promise<string | void> {
		logger.info({ message: "Saving event data to dynamodb", tableName: this.tableName });
		const updateSessionInfoCommand = new UpdateCommand({
			TableName: this.tableName,
			Key: {
				userId,
			},
			UpdateExpression: updateExpression,
			ExpressionAttributeValues: expressionAttributeValues,
		});

		logger.info("Updating auth event record");

		try {
			await this.dynamo.send(updateSessionInfoCommand);
		} catch (e: any) {
			logger.error({ message: "Failed to update auth event record in dynamo", e });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, "Error updating auth event record");
		}
	}
}
