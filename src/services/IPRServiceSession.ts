/* eslint-disable no-console */
import { Logger } from "@aws-lambda-powertools/logger";
import { AppError } from "../utils/AppError";
import { DynamoDBDocument, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { HttpCodesEnum } from "../models/enums/HttpCodesEnum";
import { Constants } from "../utils/Constants";
import { sqsClient } from "../utils/SqsClient";
import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { GovNotifyEvent } from "../utils/GovNotifyEvent";
import { TxmaEvent } from "../utils/TxmaEvent";
import { EnvironmentVariables } from "./EnvironmentVariables";
import { ServicesEnum } from "../models/enums/ServicesEnum";
import { ExtSessionEvent } from "../models/SessionEvent";
import { MessageCodes } from "../models/enums/MessageCodes";
import { absoluteTimeNow } from "../utils/DateTimeUtils";

export class IPRServiceSession {
	readonly tableName: string;

	private readonly dynamo: DynamoDBDocument;

	readonly logger: Logger;

	private readonly environmentVariables: EnvironmentVariables;

	private static instance: IPRServiceSession;

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

	static getInstance(tableName: string, logger: Logger, dynamoDbClient: DynamoDBDocument): IPRServiceSession {
		if (!IPRServiceSession.instance) {
			IPRServiceSession.instance = new IPRServiceSession(tableName, logger, dynamoDbClient);
		}
		return IPRServiceSession.instance;
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
			this.logger.error({ message: "getSessionBySub - failed executing get from dynamodb", name: error?.name, info: error?.message });
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
		this.logger.info({ message: "Checking if record is flagged for deletion or already processed", tableName: this.tableName });
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
				this.logger.info({ message: "Received AUTH_DELETE_ACCOUNT event and no session with that userId was found OR session was found but accountDeletedOn was already set" });
				return true;
			// If Event type is IPV_F2F_USER_CANCEL_END and no record was found, or flagged for deletion then do not process the event.
			} else if (eventType === Constants.IPV_F2F_USER_CANCEL_END && (!session.Item || session?.Item?.accountDeletedOn)) {
				this.logger.info({ message: "Received IPV_F2F_USER_CANCEL_END event and no session with that userId was found OR session was found but accountDeletedOn was already set" });
				return true;
			} else if (session.Item && (session.Item.accountDeletedOn || session.Item[eventAttribute!])) {
				// Do not process the event if the record is flagged for deletion or the event mapped attribute exists.
				this.logger.info({ message: `Session record with that userId was found with either accountDeletedOn set or with ${eventAttribute} already set` });
				return true;
			} else {
				// Process all events except AUTH_DELETE_ACCOUNT or IPV_F2F_USER_CANCEL_END when no record exists.
				return false;
			}
		} catch (e: any) {
			this.logger.error({ message: "getSessionById - failed executing get from dynamodb:", e });
			throw new AppError(HttpCodesEnum.SERVER_ERROR, "Error retrieving Session");
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

		this.logger.info("Updating session record" );

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

	async sendToTXMA(event: TxmaEvent, encodedHeader?: string): Promise<void> {
		try {
			if (encodedHeader) {
				event.restricted = event.restricted ?? { device_information: { encoded: "" } };
				event.restricted.device_information = { encoded: encodedHeader };
			}
			const messageBody = JSON.stringify(event);
			const params = {
				MessageBody: messageBody,
				QueueUrl: process.env.TXMA_QUEUE_URL,
			};
			this.logger.info({ message: "Sending message to TxMA", eventName: event.event_name });
			await sqsClient.send(new SendMessageCommand(params));
			this.logger.info("Sent message to TxMA");

			const obfuscatedObject = await this.obfuscateJSONValues(event, Constants.TXMA_FIELDS_TO_SHOW);
			this.logger.info({ message: "Obfuscated TxMA Event", txmaEvent: JSON.stringify(obfuscatedObject, null, 2) });
		} catch (error) {
			this.logger.error({
				message: `Error when sending event ${event.event_name} to TXMA Queue`,
				error,
				messageCode: MessageCodes.FAILED_TO_WRITE_TXMA,
			});
		}
	}

	async obfuscateJSONValues(input: any, txmaFieldsToShow: string[] = []): Promise<any> {
		if (typeof input === "object" && input !== null) {
			if (Array.isArray(input)) {
				return Promise.all(input.map((element) => this.obfuscateJSONValues(element, txmaFieldsToShow)));
			} else {
				const obfuscatedObject: any = {};
				for (const key in input) {
					if (Object.prototype.hasOwnProperty.call(input, key)) {
						if (txmaFieldsToShow.includes(key)) {
							obfuscatedObject[key] = input[key];
						} else {
							obfuscatedObject[key] = await this.obfuscateJSONValues(input[key], txmaFieldsToShow);
						}
					}
				}
				return obfuscatedObject;
			}
		} else {
			return input === null || input === undefined ? input : "***";
		}
	}
}
