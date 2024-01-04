import { ReturnSQSEvent } from "./ReturnSQSEvent";
import { Constants } from "../utils/Constants";

export interface NamePart {
	type: string;
	value: string;
}

export interface PostOfficeVisitDetails {
	post_office_date_of_visit: string;
	post_office_time_of_visit: string;
}

export interface PostOfficeInfo {
	name?: string;
	address: string;
	post_code: string;
	location: [
		{
			latitude: number;
			longitude: number;
		},
	];
}

export interface DocumentDetails {
	passport?: DocumentTypeDetails[] | null;
	residencePermit?: DocumentTypeDetails[] | null;
	drivingPermit?: DocumentTypeDetails[] | null;
	idCard?: DocumentTypeDetails[] | null;
}

export interface DocumentTypeDetails {
	documentType: string;
}

export class SessionReturnRecord {
	constructor(data: ReturnSQSEvent, expiresOn: number) {
		this.userId = data.user.user_id;
		switch (data.event_name) {
			case Constants.AUTH_IPV_AUTHORISATION_REQUESTED:{
				this.clientName = data.client_id!;
				this.redirectUri = data.clientLandingPageUrl!;
				this.userEmail = data.user.email;
				this.ipvStartedOn = data.timestamp;
				this.expiresDate = expiresOn;
				break;
			}
			case Constants.F2F_YOTI_START: {
				this.journeyWentAsyncOn = data.timestamp;
				this.expiresDate = expiresOn;
				if (data.user.govuk_signin_journey_id && (data.user.govuk_signin_journey_id).toLowerCase() !== "unknown") {
					this.clientSessionId = data.user.govuk_signin_journey_id;
				}
				this.postOfficeInfo = data.extensions?.post_office_details;
				if (data.restricted?.document_details) {
					Object.values(data.restricted.document_details).forEach(docArray => {
						if (Array.isArray(docArray)) {
							docArray.forEach(doc => {
								this.documentType = doc.documentType;
							});
						}
					});
				}
				break;
			}
			case Constants.IPV_F2F_CRI_VC_CONSUMED: {
				this.readyToResumeOn = data.timestamp;
				this.nameParts = data.restricted?.nameParts;
				this.documentExpiryDate = data.restricted?.docExpiryDate;
				break;
			}
			case Constants.F2F_DOCUMENT_UPLOADED: {
				this.documentUploadedOn = data.timestamp;
				this.postOfficeVisitDetails = data.extensions?.post_office_visit_details;
				break;
			}
			case Constants.AUTH_DELETE_ACCOUNT: {
				this.accountDeletedOn = data.timestamp;
				this.clientSessionId = "";
				this.clientName = "";
				this.redirectUri = "";
				this.userEmail = "";
				this.nameParts = [];
				break;
			}
			default: {
				break;
			}
		}
	}

    userId: string;

    userEmail?: string;

    nameParts?: NamePart[];

	postOfficeVisitDetails?: PostOfficeVisitDetails[];

	postOfficeInfo?: PostOfficeInfo[];

    clientName?: string;

    redirectUri?: string;

    ipvStartedOn?: number;

    journeyWentAsyncOn?: number;

    readyToResumeOn?: number;

	documentUploadedOn?: number;

    accountDeletedOn?: number;

    expiresDate?: number;

    clientSessionId?: string;

	documentType?: string;

	documentExpiryDate?: string;
}
