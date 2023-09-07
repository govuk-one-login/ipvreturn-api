import { PostOfficeInfo, PostOfficeVisitDetails } from "../models/SessionReturnRecord";

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

export const buildOldGovNotifyEventFields = (userId: string, email: string, firstName: string, lastName: string): GovNotifyEvent => {
	
	return {
		Message : {
			userId,
			emailAddress: email,
			firstName,
			lastName,
			messageType: "oldEmail",
		},
	};		
	
};

export const buildNewGovNotifyEventFields = (userId: string, email: string, firstName: string, lastName: string, documentType: string , documentExpiryDate: string, poInfo: PostOfficeInfo , poVisitDetails: PostOfficeVisitDetails ): GovNotifyEvent => {
	
	return {
		Message : {
			userId,
			emailAddress: email,
			firstName,
			lastName,
			documentType,
			poAddress: poInfo.address + " " + poInfo.post_code,
			poVisitDate: poVisitDetails.post_office_date_of_visit,
			poVisitTime: poVisitDetails.post_office_time_of_visit,
			documentExpiryDate,
			messageType: "newEmail",
		},
	};	

};
