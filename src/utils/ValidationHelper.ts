import { validateOrReject } from "class-validator";
import { AppError } from "./AppError";
import { Logger } from "@aws-lambda-powertools/logger";
import { HttpCodesEnum } from "../models/enums/HttpCodesEnum";
import { ExtSessionEvent, SessionEvent } from "../models/SessionEvent";
import { JwtPayload } from "./IVeriCredential";
import { absoluteTimeNow } from "./DateTimeUtils";
import { Constants } from "./Constants";
import { MessageCodes } from "../models/enums/MessageCodes";
import { FallbackEmail } from "../models/Email";

export class ValidationHelper {

	async validateModel(model: object, logger: Logger): Promise<void> {
		try {
			await validateOrReject(model, { forbidUnknownValues: true });
		} catch (errors) {
			const errorDetails = this.getErrors(errors);
			logger.error({ message: `ValidationHelper: Failed to validate data ${model.constructor.name}` + JSON.stringify(errorDetails) });
			throw new AppError(HttpCodesEnum.UNPROCESSABLE_ENTITY, `Failed to Validate - ${model.constructor.name} ${errorDetails}` );
		}
	}

	private getErrors(errors: any): any {
		return errors.map((error: any) => {
			return {
				property: error.property,
				constraints: error.constraints,
				children: error?.children, // Gets error messages from nested Objects
			};
		});
	}

	validateSessionEventFields(sessionEventData: SessionEvent): void {
		if (!sessionEventData.ipvStartedOn || !(sessionEventData.ipvStartedOn > 0)) {
			throw new AppError(HttpCodesEnum.UNPROCESSABLE_ENTITY, "ipvStartedOn is not yet populated, unable to process the DB record.");
		} else if (!sessionEventData.journeyWentAsyncOn || !(sessionEventData.journeyWentAsyncOn > 0)) {
			throw new AppError(HttpCodesEnum.UNPROCESSABLE_ENTITY, "journeyWentAsyncOn is not yet populated, unable to process the DB record.");
		} else if (!sessionEventData.readyToResumeOn || !(sessionEventData.readyToResumeOn > 0)) {
			throw new AppError(HttpCodesEnum.UNPROCESSABLE_ENTITY, "readyToResumeOn is not yet populated, unable to process the DB record.");
		}
	}

	validatePOFailureEventFields(sessionEventData: SessionEvent): void {
		if (!sessionEventData.nameParts || !Array.isArray(sessionEventData.nameParts) || sessionEventData.nameParts.length === 0) {
			throw new AppError(HttpCodesEnum.UNPROCESSABLE_ENTITY, "nameParts is not yet populated, unable to process the DB record.");
		}
		else if (!sessionEventData.readyToResumeOn || !(sessionEventData.readyToResumeOn > 0)) {
			throw new AppError(HttpCodesEnum.UNPROCESSABLE_ENTITY, "readyToResumeOn is not yet populated, unable to process the DB record.");
		}
	}

	async validateSessionEvent(sessionEvent: ExtSessionEvent | SessionEvent, emailType: string, logger: Logger): Promise<{ sessionEvent: ExtSessionEvent | SessionEvent | FallbackEmail; emailType: string }> {
		//Validate all necessary fields are populated required to send the email before processing the data.
		try {
			await this.validateModel(sessionEvent, logger);
			// ignored so as not log PII
			/* eslint-disable @typescript-eslint/no-unused-vars */				
		} catch (error) {
			if (emailType === Constants.VIST_PO_EMAIL_DYNAMIC) {
				logger.info("Unable to process the DB record as the necessary fields to send the dynamic template email are not populated, trying to send the static template email.", { messageCode: MessageCodes.MISSING_NEW_PO_FIELDS_IN_SESSION_EVENT });
				// Send the static template email
				sessionEvent = new SessionEvent(sessionEvent);		
				emailType = Constants.VIST_PO_EMAIL_STATIC;
				// Validate fields required for sending the static email
				await this.validateSessionEvent(sessionEvent, emailType, logger);
			} else {
				logger.error("The mandatory fields required for static template email are missing in session record, trying to send the fallback template email.", { messageCode: MessageCodes.MISSING_MANDATORY_FIELDS_IN_SESSION_EVENT });
				throw new AppError(HttpCodesEnum.SERVER_ERROR, "The mandatory fields required for static template email are missing in session record, trying to send the fallback template email.");			
			}			
		}
		return { sessionEvent, emailType };
	}

	isJwtComplete = (payload: JwtPayload): boolean => {
		const { iss, sub, aud, exp, iat, nonce } = payload;
		const mandatoryJwtValues = [iss, sub, aud, exp, iat, nonce];
		return !mandatoryJwtValues.some((value) => value === undefined);
	};

	isJwtValid = (jwtPayload: JwtPayload,
				  clientId: string, expectedIssuer: string): string => {

		if (!this.isJwtComplete(jwtPayload)) {
			return "JWT validation/verification failed: Missing mandatory fields in JWT payload";
		} else if ((jwtPayload.sub == null || jwtPayload.sub === undefined)) {
			return "JWT validation/verification failed: JWT sub undefined";
		} else if ((jwtPayload.exp == null) || (absoluteTimeNow() > jwtPayload.exp)) {
			return "JWT validation/verification failed: JWT expired";
		} else if (jwtPayload.iat == null || (absoluteTimeNow() < jwtPayload.iat)) {
			return "JWT validation/verification failed: JWT not yet valid";
		} else if (jwtPayload.aud !== clientId) {
			return `JWT validation/verification failed: Mismatched client_id in request body (${clientId}) & jwt (${jwtPayload.aud})`;
		} else if (expectedIssuer !== jwtPayload.iss) {
			return `JWT validation/verification failed: Issuer ${jwtPayload.iss} does not match configuration uri ${expectedIssuer}`;
		}

		return "";
	};

}
