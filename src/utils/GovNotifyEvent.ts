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
		"firstName"?: string;
		"lastName"?: string;
		"messageType": string;
		"documentType"?: string;
		"documentExpiryDate"?: string;
		"poAddress"?: string;
		"poVisitDate"?: string;
		"poVisitTime"?: string;
	};
}

export const buildGovNotifyEventFields = (nameParts: { givenNames: string[]; familyNames: string[] } | null, sessionEvent: ExtSessionEvent | SessionEvent | any, emailType: string, logger: Logger ): GovNotifyEvent => {
	
	switch (emailType) {					
		case Constants.VIST_PO_EMAIL_STATIC:
			return {
				Message : {
					userId: sessionEvent.userId,
					emailAddress: sessionEvent.userEmail,
					firstName: nameParts?.givenNames[0],
					lastName: nameParts?.familyNames[0],
					messageType: Constants.VIST_PO_EMAIL_STATIC,
				},
			};
		case Constants.VIST_PO_EMAIL_DYNAMIC:
			const newSessionEvent: ExtSessionEvent = new ExtSessionEvent(sessionEvent);
			return {
				Message : {
					userId: newSessionEvent.userId,
					emailAddress: newSessionEvent.userEmail,
					firstName: nameParts?.givenNames[0],
					lastName: nameParts?.familyNames[0],
					documentType: newSessionEvent.documentType,
					poAddress: newSessionEvent.postOfficeInfo[0].address + " " + newSessionEvent.postOfficeInfo[0].post_code,
					poVisitDate: newSessionEvent.postOfficeVisitDetails[0].post_office_date_of_visit,
					poVisitTime: newSessionEvent.postOfficeVisitDetails[0].post_office_time_of_visit,
					documentExpiryDate: newSessionEvent.documentExpiryDate,
					messageType: Constants.VIST_PO_EMAIL_DYNAMIC,
				},
			};
		case Constants.VISIT_PO_EMAIL_FALLBACK:
			return {
				Message : {
					userId: sessionEvent.userId,
					emailAddress: sessionEvent.userEmail,
					messageType: Constants.VISIT_PO_EMAIL_FALLBACK,
				},
			};
		default:
			logger.error(`Unrecognised emailType ${emailType}, unable to build Gov Notify message.`);
			throw new AppError(HttpCodesEnum.SERVER_ERROR, `Could not build Gov Notify fields for ${emailType} emailType.`, { messageCode: MessageCodes.UNRECOGNISED_EMAIL_TYPE });
	}
};
