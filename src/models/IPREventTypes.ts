export interface IpvStartedOnEvent {
	":ipvStartedOn": string;
	":userEmail": string;
	":nameParts": Array<{
		type: string;
		value: string;
	}>;
	":clientName": string;
	":redirectUri": string;
}

export interface JourneyWentAsyncOnEvent {
	":journeyWentAsyncOn": string;
}

export interface ReadyToResumeOnEvent {
	":readyToResumeOn": string;
}

export interface AccountDeletedOnEvent {
	":accountDeletedOn": string;
	":userEmail": string;
	":nameParts": never[];
	":clientName": string;
	":redirectUri": string;
}
