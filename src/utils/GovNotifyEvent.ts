import { ExtSessionEvent, SessionEvent } from "../models/SessionEvent";
import { AppError } from "./AppError";
import { HttpCodesEnum } from "./HttpCodesEnum";

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

export const buildGovNotifyEventFields = (nameParts: { givenNames: string[]; familyNames: string[] }, sessionEvent: ExtSessionEvent | SessionEvent, emailType: string): GovNotifyEvent => {
	
	switch (emailType) {					
		case "oldEmail":
			return {
				Message : {
					userId: sessionEvent.userId,
					emailAddress: sessionEvent.userEmail,
					firstName: nameParts.givenNames[0],
					lastName: nameParts.familyNames[0],
					messageType: "oldEmail",
				},
			};
		case "newEmail":{
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
			throw new AppError(HttpCodesEnum.SERVER_ERROR, `An error occurred when sending ${emailType} type message to GovNotify handler`);
		
	}
};
