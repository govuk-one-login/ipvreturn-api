import { absoluteTimeNow } from "./DateTimeUtils";

export type TxmaEventName =
	"IPR_RESULT_NOTIFICATION_EMAILED"
	| "IPR_USER_REDIRECTED";

export interface TxmaUser {
	"user_id": string;
}

export interface BaseTxmaEvent {
	"user"?: TxmaUser;
	"timestamp": number;
}

export interface TxmaEvent extends BaseTxmaEvent {
	"event_name": TxmaEventName;
}

export const buildCoreEventFields = ({ sub, getNow = absoluteTimeNow }: { sub?: string; getNow?(): number }): BaseTxmaEvent => {
	return {
		...(sub && { user: {
			user_id: sub,
		} }),
		timestamp: getNow(),
	};
};
