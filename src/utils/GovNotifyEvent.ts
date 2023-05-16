export interface GovNotifyEvent {
	"Message": {
		"emailAddress": string;
		"firstName": string;
		"lastName": string;
		"messageType": string;
	};
}

export const buildGovNotifyEventFields = (email: string, firstName: string, lastName: string): GovNotifyEvent => {

	return {
		Message : {
			emailAddress: email,
			firstName,
			lastName,
			messageType: "email",
		},
	};
};
