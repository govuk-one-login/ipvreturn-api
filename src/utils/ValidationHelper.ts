import { validateOrReject } from "class-validator";
import { AppError } from "./AppError";
import { Logger } from "@aws-lambda-powertools/logger";
import { HttpCodesEnum } from "../models/enums/HttpCodesEnum";
import { SessionEvent } from "../models/SessionEvent";
import { JwtPayload } from "./IVeriCredential";
import { absoluteTimeNow } from "./DateTimeUtils";

export class ValidationHelper {

	async validateModel(model: object, logger: Logger): Promise<void> {
		try {
			await validateOrReject(model, { forbidUnknownValues: true });
		} catch (errors) {
			const errorDetails = this.getErrors(errors);
			console.log(`${model.constructor.name}`);
			console.log("**** Error validating " + `${model.constructor.name}` + "   " + JSON.stringify(errorDetails));
			console.log(`Failed to validate data - ${model.constructor.name}`, "ValidationHelper", HttpCodesEnum.UNPROCESSABLE_ENTITY, errorDetails);
			throw new AppError(HttpCodesEnum.UNPROCESSABLE_ENTITY, `Failed to Validate - ${model.constructor.name} ${errorDetails}` );
		}
	}

	private getErrors(errors: any): any {
		return errors.map((error: any) => {
			return {
				property: error.property,
				value: error.value,
				constraints: error.constraints,
				children: error?.children, // Gets error messages from nested Objects
			};
		});
	}

	validateSessionEventFields(sessionEventData: SessionEvent): void {
		if (!sessionEventData.ipvStartedOn || !(sessionEventData.ipvStartedOn > 0)) {
			throw new AppError(HttpCodesEnum.UNPROCESSABLE_ENTITY, `ipvStartedOn is not yet populated for userId: ${sessionEventData.userId}, unable to process the DB record.`);
		} else if (!sessionEventData.journeyWentAsyncOn || !(sessionEventData.journeyWentAsyncOn > 0)) {
			throw new AppError(HttpCodesEnum.UNPROCESSABLE_ENTITY, `journeyWentAsyncOn is not yet populated for userId: ${sessionEventData.userId}, unable to process the DB record.`);
		} else if (!sessionEventData.readyToResumeOn || !(sessionEventData.readyToResumeOn > 0)) {
			throw new AppError(HttpCodesEnum.UNPROCESSABLE_ENTITY, `readyToResumeOn is not yet populated for userId: ${sessionEventData.userId}, unable to process the DB record.`);
		}
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
