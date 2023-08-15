import { absoluteTimeNow } from "./DateTimeUtils";

export type TxmaEventName =
	"IPR_RESULT_NOTIFICATION_EMAILED"
	| "IPR_USER_REDIRECTED";

export interface TxmaUser {
	// TODO user_id will be required
	"user_id"?: string;
	"email"?: string;
	"govuk_signin_journey_id"?: string;
}

export interface BaseTxmaEvent {
	"user"?: TxmaUser;
	"timestamp": number;
}

export interface ExtensionObject {
	"previous_govuk_signin_journey_id"?: string;
}

export interface TxmaEvent extends BaseTxmaEvent {
	"event_name": TxmaEventName;
	"extensions"?: ExtensionObject;
}

export const buildCoreEventFields = (user: TxmaUser, getNow: () => number = absoluteTimeNow): BaseTxmaEvent => {
	return {
		user: {
			...user,
		},
		timestamp: getNow(),
	};
};
