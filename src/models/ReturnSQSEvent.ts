import { NamePart, PostOfficeVisitDetails, PostOfficeInfo, DocumentDetails } from "./SessionReturnRecord";

export type EventType = "AUTH_IPV_AUTHORISATION_REQUESTED" | "F2F_YOTI_START" | "IPV_F2F_CRI_VC_CONSUMED" | "AUTH_DELETE_ACCOUNT" | "F2F_DOCUMENT_UPLOADED" | "IPV_F2F_RESTART" | "IPV_F2F_CRI_VC_ERROR";


export interface ReturnSQSEvent {
	event_id: string;
	client_id: string;
	component_id?: string;
	redirect_uri?: string;
	clientLandingPageUrl?: string;
	event_name: EventType;
	timestamp: number;
	event_timestamp_ms: number;
	timestamp_formatted: string;
	user: {
		govuk_signin_journey_id?: string;
		user_id: string;
		email?: string;
	};
	restricted?: {
		nameParts?: NamePart[];
		document_details?: DocumentDetails;
		docExpiryDate?: string;
	};
	extensions?: {
		post_office_visit_details?: PostOfficeVisitDetails[];
		post_office_details?: PostOfficeInfo[];
		error_description?: string;
	};
}

