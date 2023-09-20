import { ExtSessionEvent, SessionEvent } from "../models/SessionEvent";
import { MessageCodes } from "../models/enums/MessageCodes";
import { AppError } from "./AppError";
import { Constants } from "./Constants";
import { HttpCodesEnum } from "./HttpCodesEnum";
import { Logger } from "@aws-lambda-powertools/logger";

export interface GovNotifyEvent {
	"Message": {
		"userId": string;
		"emailAddress": string;
		"firstName": string;
		"lastName": string;
		"messageType": string;
		"documentType"?: string;
		"documentExpiryDate"?: string;
		"poAddress"?: string;
		"poVisitDate"?: string;
		"poVisitTime"?: string;
	};
}

export const buildGovNotifyEventFields = (nameParts: { givenNames: string[]; familyNames: string[] }, sessionEvent: ExtSessionEvent | SessionEvent, emailType: string, logger: Logger ): GovNotifyEvent => {
	
	switch (emailType) {					
		case Constants.OLD_EMAIL:
			return {
				Message : {
					userId: sessionEvent.userId,
					emailAddress: sessionEvent.userEmail,
					firstName: nameParts.givenNames[0],
					lastName: nameParts.familyNames[0],
					messageType: "oldEmail",
				},
			};
		case Constants.NEW_EMAIL:{
			const newSessionEvent: ExtSessionEvent = new ExtSessionEvent(sessionEvent);
			return {
				Message : {
					userId: newSessionEvent.userId,
					emailAddress: newSessionEvent.userEmail,
					firstName: nameParts.givenNames[0],
					lastName: nameParts.familyNames[0],
					documentType: newSessionEvent.documentType,
					poAddress: newSessionEvent.postOfficeInfo[0].address + " " + newSessionEvent.postOfficeInfo[0].post_code,
					poVisitDate: newSessionEvent.postOfficeVisitDetails[0].post_office_date_of_visit,
					poVisitTime: newSessionEvent.postOfficeVisitDetails[0].post_office_time_of_visit,
					documentExpiryDate: newSessionEvent.documentExpiryDate,
					messageType: "newEmail",
				},
			};
		}
		default:
			logger.error(`Unrecognised emailType ${emailType}, unable to build Gov Notify message.`);
			throw new AppError(HttpCodesEnum.SERVER_ERROR, `Could not build Gov Notify fields for ${emailType} emailType.`, { messageCode: MessageCodes.UNRECOGNISED_EMAIL_TYPE_UNABLE_TO_BUILD_GOVNOTIFY_MESSAGE });
		
	}
};
