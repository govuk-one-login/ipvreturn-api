/* eslint-disable no-console */
import { Logger } from "@aws-lambda-powertools/logger";
import { AppError } from "../utils/AppError";
import { DynamoDBDocument, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { HttpCodesEnum } from "../models/enums/HttpCodesEnum";
import { Constants, TXMA_EVENT_DETAILS } from "../utils/Constants";
import { sqsClient } from "../utils/SqsClient";
import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { GovNotifyEvent } from "../utils/GovNotifyEvent";
import { TxmaEvent } from "../utils/TxmaEvent";
import { EnvironmentVariables } from "./EnvironmentVariables";
import { ServicesEnum } from "../models/enums/ServicesEnum";
import { ExtSessionEvent, SessionEvent } from "../models/SessionEvent";
import { MessageCodes } from "../models/enums/MessageCodes";
import { absoluteTimeNow } from "../utils/DateTimeUtils";

export class IPRService {
	readonly tableName: string;

	private readonly dynamo: DynamoDBDocument;

	readonly logger: Logger;

	private readonly environmentVariables: EnvironmentVariables;

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
		this.environmentVariables = new EnvironmentVariables(logger, ServicesEnum.NA);
	}

	static getInstance(tableName: string, logger: Logger, dynamoDbClient: DynamoDBDocument): IPRService {
		if (!IPRService.instance) {
			IPRService.instance = new IPRService(tableName, logger, dynamoDbClient);
		}
		return IPRService.instance;
	}

	async getSessionBySub(userId: string): Promise<ExtSessionEvent | undefined> {
		const getSessionCommand = new GetCommand({
			TableName: this.tableName,
			Key: {
				userId,
			},
		});
		let session;
		try {
			session = await this.dynamo.send(getSessionCommand);
		} catch (error: any) {
			this.logger.error({ message: "getSessionByUserId - failed executing get from dynamodb:" });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, "Error retrieving Session");
		}

		if (session.Item) {
			if (session.Item.expiresOn < absoluteTimeNow()) {
				this.logger.error({ message: "Session has expired", messageCode: MessageCodes.SESSION_EXPIRED });
				throw new AppError( HttpCodesEnum.UNAUTHORIZED, "Session has expired");
			}
			return session.Item as ExtSessionEvent;
		}
	}


	async isFlaggedForDeletionOrEventAlreadyProcessed(userId: string, eventType: string): Promise<boolean | undefined> {
    try {
        this.logger.info({ message: "Checking if record is flagged for deletion or already processed", tableName: this.tableName });
        const getSessionCommand = new GetCommand({
            TableName: this.tableName,
            Key: {
                userId,
            },
        });

        const session = await this.dynamo.send(getSessionCommand);
        const eventAttribute = this.eventAttributeMap.get(eventType);

        if (
            (eventType === TXMA_EVENT_DETAILS.DELETE_ACCOUNT.Name && (!session.Item || session.Item.accountDeletedOn)) ||
            (session.Item && (session.Item.accountDeletedOn || session.Item[eventAttribute!]))
        ) {
            this.logger.info({
                message: `Record is flagged for deletion or ${eventAttribute} is already set`,
            });
            return true;
        }

        this.logger.info({ message: "Record is not flagged for deletion or processed" });
        return false;
    } catch (error) {
        this.logger.error({ message: "isFlaggedForDeletionOrEventAlreadyProcessed - Error retrieving session from DynamoDB", error });
        throw new AppError(HttpCodesEnum.SERVER_ERROR, "Error retrieving Session");
    }
}


	async saveEventData(userId: string, UpdateExpression: string, ExpressionAttributeValues: any): Promise<void> {
    try {
        this.logger.info({ message: "Saving event data to DynamoDB", tableName: this.tableName });
        const updateSessionInfoCommand = new UpdateCommand({
            TableName: this.tableName,
            Key: {
                userId,
            },
            UpdateExpression,
            ExpressionAttributeValues,
        });

        this.logger.info("Updating session record");
        await this.dynamo.send(updateSessionInfoCommand);
    } catch (error) {
        this.logger.error({ message: "Failed to update session record in DynamoDB", error });
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

	async sendToTXMA(event: TxmaEvent): Promise<void> {
		try {
			const messageBody = JSON.stringify(event);
			const params = {
				MessageBody: messageBody,
				QueueUrl: process.env.TXMA_QUEUE_URL,
			};
			this.logger.info({ message: "Sending message to TxMA", eventName: event.event_name });
			await sqsClient.send(new SendMessageCommand(params));
			this.logger.info("Sent message to TxMA");
		} catch (error) {
			this.logger.error({ message: "Error when sending message to TXMA Queue", error });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, "sending event to txma queue - failed");
		}
	}
}
