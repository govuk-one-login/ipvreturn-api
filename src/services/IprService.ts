import { GovNotifyEvent } from "../utils/GovNotifyEvent";
import { AppError } from "../utils/AppError";
import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { sqsClient } from "../utils/SqsClient";
import { EnvironmentVariables } from "./EnvironmentVariables";
import { Logger } from "@aws-lambda-powertools/logger";
import { ServicesEnum } from "../models/enums/ServicesEnum";
import { HttpCodesEnum } from "../models/enums/HttpCodesEnum";

export class IprService {
    readonly logger: Logger;

    private readonly environmentVariables: EnvironmentVariables;

    private static instance: IprService;

    constructor(logger: Logger) {
    	this.logger = logger;
    	this.environmentVariables = new EnvironmentVariables(logger, ServicesEnum.NA);
    }

    static getInstance(logger: Logger): IprService {
    	if (!IprService.instance) {
    		IprService.instance = new IprService(logger);
    	}
    	return IprService.instance;
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
