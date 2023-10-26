import { ValidationHelper } from "../utils/ValidationHelper";
import { personalIdentityUtils } from "../utils/PersonalIdentityUtils";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { ExtSessionEvent, SessionEvent } from "../models/SessionEvent";
import { HttpCodesEnum } from "../models/enums/HttpCodesEnum";
import { buildGovNotifyEventFields } from "../utils/GovNotifyEvent";
import { EnvironmentVariables } from "./EnvironmentVariables";
import { ServicesEnum } from "../models/enums/ServicesEnum";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
import { IPRService } from "./IPRService";
import { AppError } from "../utils/AppError";
import { MessageCodes } from "../models/enums/MessageCodes";
import { Constants } from "../utils/Constants";

export class RecordStreamProcessor {
  private static instance: RecordStreamProcessor;
  private readonly logger: Logger;
  private readonly metrics: Metrics;
  private readonly validationHelper: ValidationHelper;
  private readonly iprService: IPRService;
  private readonly environmentVariables: EnvironmentVariables;

  constructor(logger: Logger, metrics: Metrics) {
    this.logger = logger;
    this.environmentVariables = new EnvironmentVariables(logger, ServicesEnum.RECORD_STREAM_PROCESSOR);
    this.validationHelper = new ValidationHelper();
    this.metrics = metrics;
    this.iprService = IPRService.getInstance(this.environmentVariables.sessionEventsTable(), this.logger, createDynamoDbClient());
  }

  static getInstance(logger: Logger, metrics: Metrics): RecordStreamProcessor {
    if (!RecordStreamProcessor.instance) {
      RecordStreamProcessor.instance = new RecordStreamProcessor(logger, metrics);
    }
    return RecordStreamProcessor.instance;
  }

  async processRequest(sessionEvent: any): Promise<void> {

    let sessionEventData: any = ExtSessionEvent.parseRequest(JSON.stringify(sessionEvent));

    this.logger.appendKeys({ govuk_signin_journey_id: sessionEventData.clientSessionId });

    if (sessionEventData.notified) {
      this.handleNotifiedUser();
    }

    try {
      this.validationHelper.validateSessionEventFields(sessionEventData);
    } catch (error: any) {
      this.handleValidationFailure(error);
    }

    let emailType = Constants.VIST_PO_EMAIL_DYNAMIC;
    if (!sessionEventData.documentUploadedOn || !(sessionEventData.documentUploadedOn > 0)) {
      const result = this.handleDocumentUploadedOnNotSet(sessionEventData);
      emailType = result.emailType;
      sessionEventData = result.sessionEventData;
    }

    const data = await this.validationHelper.validateSessionEvent(sessionEventData, emailType, this.logger);

    await this.sendEmailMessageToGovNotify(data.sessionEvent, data.emailType);

    try {
      await this.iprService.setNotifiedFlag(data.sessionEvent.userId, true);
    } catch (error: any) {
      throw new AppError(HttpCodesEnum.SERVER_ERROR, error.message);
    }

  }

  private handleNotifiedUser(): void {
    this.logger.warn("User is already notified for this session event.", { messageCode: MessageCodes.USER_ALREADY_NOTIFIED });
    throw new AppError(HttpCodesEnum.SERVER_ERROR, "User is already notified for this session event.");
  }

  private handleValidationFailure(error: any): void {
    this.logger.warn(error.message, { messageCode: MessageCodes.MISSING_MANDATORY_FIELDS_IN_SESSION_EVENT });
    throw new AppError(HttpCodesEnum.SERVER_ERROR, error.message);
  }

  private handleDocumentUploadedOnNotSet(eventData: any): { emailType: string; sessionEventData: SessionEvent; } {
    this.logger.info({ message: "documentUploadedOn is not yet populated, sending the old template email." });
    const emailType = Constants.VIST_PO_EMAIL_STATIC;
    const sessionEventData = new SessionEvent(eventData);
    return { emailType, sessionEventData }
  }

  private async sendEmailMessageToGovNotify(sessionEvent: ExtSessionEvent | SessionEvent, emailType: string): Promise<void> {
    try {
      this.logger.info({ message: `Trying to send ${emailType} type message to GovNotify handler` });
      const nameParts = personalIdentityUtils.getNames(sessionEvent.nameParts);
      await this.iprService.sendToGovNotify(buildGovNotifyEventFields(nameParts, sessionEvent, emailType, this.logger));
      this.logger.info({ message: `Sent ${emailType} message to GovNotify handler` });
    } catch (error) {
      this.handleGovNotifyError(error, emailType);
    }
  }

  private handleGovNotifyError(error: any, emailType: string): void {
    this.logger.error("FAILED_TO_WRITE_GOV_NOTIFY", {
      reason: `Processing Event session data, failed to post ${emailType} type message to GovNotify SQS Queue`,
      error,
    }, { messageCode: MessageCodes.FAILED_TO_WRITE_GOV_NOTIFY });
    throw new AppError(HttpCodesEnum.SERVER_ERROR, `An error occurred when sending ${emailType} type message to GovNotify handler`);
  }
}

