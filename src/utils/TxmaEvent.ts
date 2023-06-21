import { absoluteTimeNow } from "./DateTimeUtils";

export type TxmaEventName =
	"IPR_RESULT_NOTIFICATION_EMAILED"
	| "IPR_USER_REDIRECTED";

export interface TxmaUser {
	// TODO user_id will be required
	"user_id"?: string;
	"email"?: string;
}

export interface BaseTxmaEvent {
	"user"?: TxmaUser;
	"timestamp": number;
}

export interface TxmaEvent extends BaseTxmaEvent {
	"event_name": TxmaEventName;
}

export const buildCoreEventFields = (user: TxmaUser, getNow: () => number = absoluteTimeNow): BaseTxmaEvent => {
	return {
		user: {
			...user,
		},
		timestamp: getNow(),
	};
};
