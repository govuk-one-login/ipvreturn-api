export interface IpvReturnEvent {
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

export interface IpvStartedOnAttributes {
	":ipvStartedOn": number;
	":userEmail": string;
	":nameParts": Array<{
		type: string;
		value: string;
	}>;
	":clientName": string;
	":redirectUri": string;
	":expiryDate": number;
}

export interface JourneyWentAsyncOnAttributes {
	":journeyWentAsyncOn": number;
	":expiryDate": number;
}

export interface ReadyToResumeOnAttributes {
	":readyToResumeOn": number;
	":expiryDate": number;
}

export interface AccountDeletedOnAttributes {
	":accountDeletedOn": number;
	":userEmail": string;
	":nameParts": never[];
	":clientName": string;
	":redirectUri": string;
	":expiryDate": number;
}
