export interface SQSEvent {
	event_id: string;
	client_id: string;
	component_id: string;
	event_name: string;
	redirect_uri: string;
	rp_name: string;
	timestamp: number;
	timestamp_formatted: string;
	user: {
		user_id: string;
		email?: string;
		sub?: string;
	};
}

export interface IpvStartedOnEvent {
	":ipvStartedOn": number;
	":userEmail": string;
	":nameParts": Array<{
		type: string;
		value: string;
	}>;
	":clientName": string;
	":redirectUri": string;
}

export interface JourneyWentAsyncOnEvent {
	":journeyWentAsyncOn": number;
}

export interface ReadyToResumeOnEvent {
	":readyToResumeOn": number;
}

export interface AccountDeletedOnEvent {
	":accountDeletedOn": number;
	":userEmail": string;
	":nameParts": never[];
	":clientName": string;
	":redirectUri": string;
}
