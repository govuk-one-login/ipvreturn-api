import { validateOrReject } from "class-validator";
import { AppError } from "./AppError";
import { Logger } from "@aws-lambda-powertools/logger";
import { HttpCodesEnum } from "../models/enums/HttpCodesEnum";
import { SessionEvent } from "../models/SessionEvent";

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
}
