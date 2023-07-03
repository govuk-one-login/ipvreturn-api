export interface GovNotifyEvent {
	"Message": {
		"userId": string;
		"emailAddress": string;
		"firstName": string;
		"lastName": string;
		"messageType": string;
	};
}

export const buildGovNotifyEventFields = (userId: string, email: string, firstName: string, lastName: string): GovNotifyEvent => {

	return {
		Message : {
			userId,
			emailAddress: email,
			firstName,
			lastName,
			messageType: "email",
		},
	};
};
