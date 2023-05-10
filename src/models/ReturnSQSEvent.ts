import { Constants } from "../utils/Constants";

export type EventType = "AUTH_IPV_AUTHORISATION_REQUESTED" | "F2F_YOTI_START" | "IPV_F2F_CRI_VC_CONSUMED" | "AUTH_DELETE_ACCOUNT";

export interface ReturnSQSEvent {
	event_id: string;
	client_id: string;
	component_id: string;
	event_name: EventType;
	timestamp: number;
	timestamp_formatted: string;
	user: {
		user_id: string;
		email?: string;
		sub?: string;
	};
}

