export interface ReturnSQSEvent {
	event_id: string;
	client_id: string;
	component_id: string;
	event_name: string;
	timestamp: number;
	timestamp_formatted: string;
	user: {
		user_id: string;
		email?: string;
		sub?: string;
	};
}

