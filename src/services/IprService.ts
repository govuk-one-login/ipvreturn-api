import { GovNotifyEvent } from "../utils/GovNotifyEvent";
import { AppError } from "../utils/AppError";
import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { sqsClient } from "../utils/SqsClient";
import { EnvironmentVariables } from "./EnvironmentVariables";
import { Logger } from "@aws-lambda-powertools/logger";
import { ServicesEnum } from "../models/enums/ServicesEnum";
import { HttpCodesEnum } from "../models/enums/HttpCodesEnum";
import { DynamoDBDocument, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import {
	AccountDeletedOnEvent,
	IpvStartedOnEvent,
	JourneyWentAsyncOnEvent, Notified,
	ReadyToResumeOnEvent,
} from "../models/IPREventTypes";

export class IprService {
    readonly logger: Logger;

    private readonly environmentVariables: EnvironmentVariables;

	private readonly tableName: string;

	private readonly dynamo: DynamoDBDocument;

    private static instance: IprService;

    constructor(tableName: any, logger: Logger, dynamoDbClient: DynamoDBDocument) {
    	this.logger = logger;
    	this.tableName = tableName;
    	this.environmentVariables = new EnvironmentVariables(logger, ServicesEnum.NA);
    	this.dynamo = dynamoDbClient;
    }

    static getInstance(tableName: string, logger: Logger, dynamoDbClient: DynamoDBDocument): IprService {
    	if (!IprService.instance) {
    		IprService.instance = new IprService(tableName, logger, dynamoDbClient);
    	}
    	return IprService.instance;
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

    async saveEventData(userId: string, updateExpression: string, expressionAttributeValues: IpvStartedOnEvent | JourneyWentAsyncOnEvent | ReadyToResumeOnEvent | AccountDeletedOnEvent | Notified ): Promise<string | void> {
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

    async sendToGovNotify(event: GovNotifyEvent): Promise<void> {
    	try {
    		const messageBody = JSON.stringify(event);
    		const params = {
    			MessageBody: messageBody,
    			QueueUrl: this.environmentVariables.getGovNotifyQueueURL(this.logger),
    		};

    		await sqsClient.send(new SendMessageCommand(params));
    		this.logger.info("Sent message to Gov Notify");
    	} catch (error) {
    		this.logger.error({ message: "Error when sending message to GovNotify Queue", error });
    		throw new AppError(HttpCodesEnum.SERVER_ERROR, "sending event to govNotify queue - failed ");
    	}
    }
}
