import { NamePart, PostOfficeVisitDetails } from "./SessionReturnRecord";

export type EventType = "AUTH_IPV_AUTHORISATION_REQUESTED" | "F2F_YOTI_START" | "IPV_F2F_CRI_VC_CONSUMED" | "AUTH_DELETE_ACCOUNT" | "F2F_DOCUMENT_UPLOADED";


export interface ReturnSQSEvent {
	event_id: string;
	client_id: string;
	clientLandingPageUrl?: string;
	event_name: EventType;
	timestamp: number;
	timestamp_formatted: string;
	user: {
		govuk_signin_journey_id?: string;
		user_id: string;
		email?: string;
	};
	restricted?: {
		nameParts: NamePart[];
	};
	extensions?: {
		post_office_visit_details: PostOfficeVisitDetails[];
	};
}

