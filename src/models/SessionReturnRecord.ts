import { ReturnSQSEvent } from "./ReturnSQSEvent";
import { Constants } from "../utils/Constants";

export interface NamePart {
	type: string;
	value: string;
}

export class SessionReturnRecord {
	constructor(data: ReturnSQSEvent, expiresOn: number) {
		this.userId = data.user.user_id;
		switch (data.event_name) {
			case Constants.AUTH_IPV_AUTHORISATION_REQUESTED:{
				this.clientName = data.client_id!;
				this.redirectUri = data.component_id!;
				this.userEmail = data.user.email;
				this.ipvStartedOn = data.timestamp;
				this.expiresDate = expiresOn;
				break;
			}
			case Constants.F2F_YOTI_START:{
				this.journeyWentAsyncOn = data.timestamp;
				break;
			}
			case Constants.IPV_F2F_CRI_VC_CONSUMED:{
				this.readyToResumeOn = data.timestamp;
				this.nameParts = data.restricted?.nameParts;
				break;
			}
			case Constants.AUTH_DELETE_ACCOUNT:{
				this.accountDeletedOn = data.timestamp;
				this.clientName = "";
				this.redirectUri = "";
				this.userEmail = "";
				this.nameParts = [];
				break;
			}
			default:{
				break;
			}
		}
	}

    userId: string;

    userEmail?: string;

    nameParts?: NamePart[];

    clientName?: string;

    redirectUri?: string;

    ipvStartedOn?: number;

    journeyWentAsyncOn?: number;

    readyToResumeOn?: number;

    accountDeletedOn?: number;

    expiresDate?: number;
}
