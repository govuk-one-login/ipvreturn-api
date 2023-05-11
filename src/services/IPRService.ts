/* eslint-disable no-console */
import { Logger } from "@aws-lambda-powertools/logger";
import { AppError } from "../utils/AppError";
import { DynamoDBDocument, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { HttpCodesEnum } from "../models/enums/HttpCodesEnum";
import { Constants } from "../utils/Constants";

export class IPRService {
	readonly tableName: string;

	private readonly dynamo: DynamoDBDocument;

	readonly logger: Logger;

	private static instance: IPRService;

	private readonly eventAttributeMap = new Map<string, string>([
		[Constants.AUTH_IPV_AUTHORISATION_REQUESTED, "ipvStartedOn"],
		[Constants.F2F_YOTI_START, "journeyWentAsyncOn"],
		[Constants.IPV_F2F_CRI_VC_CONSUMED, "readyToResumeOn"],
		[Constants.AUTH_DELETE_ACCOUNT, "accountDeletedOn"],
	]);

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

	async isFlaggedForDeletionOrEventAlreadyProcessed(userId: string, eventType: string): Promise<boolean | undefined> {
		this.logger.info({ message: "Checking if record is flagged for deletion or already processed", tableName: this.tableName, userId });
		const getSessionCommand = new GetCommand({
			TableName: this.tableName,
			Key: {
				userId,
			},
		});

		try {
			const session = await this.dynamo.send(getSessionCommand);
			const eventAttribute = this.eventAttributeMap.get(eventType);
			// If Event type is AUTH_DELETE_ACCOUNT and no record was found, or flagged for deletion then do not process the event.
			if (eventType === Constants.AUTH_DELETE_ACCOUNT && (!session.Item || (session.Item && session.Item.accountDeletedOn))) {
				return true;
			} else if (session.Item && (session.Item.accountDeletedOn || session.Item[eventAttribute!])) {
				// Do not process the event if the record is flagged for deletion or the event mapped attribute exists.
				return true;
			} else {
				// Process all events except AUTH_DELETE_ACCOUNT when no record exists.
				return false;
			}
		} catch (e: any) {
			this.logger.error({ message: "getSessionById - failed executing get from dynamodb:", e });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, "Error retrieving Session");
		}
	}

	async saveEventData(userId: string, updateExpression: string, expressionAttributeValues: any): Promise<string | void> {

		this.logger.info({ message: "Saving event data to dynamodb", tableName: this.tableName, userId });
		const updateSessionInfoCommand = new UpdateCommand({
			TableName: this.tableName,
			Key: {
				userId,
			},
			UpdateExpression: updateExpression,
			ExpressionAttributeValues: expressionAttributeValues,
		});

		this.logger.debug("UpdateSessionInfoCommand: ", { updateSessionInfoCommand });
		this.logger.info("Updating session record", userId );

		try {
			await this.dynamo.send(updateSessionInfoCommand);
		} catch (e: any) {
			this.logger.error({ message: "Failed to update session record in dynamo", e });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, "Error updating session record");
		}
	}

}
