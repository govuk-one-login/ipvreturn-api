import { VerifiedCredential } from "./IVeriCredential";
import { ISessionItem } from "../models/ISessionItem";
import { absoluteTimeNow } from "./DateTimeUtils";

export type TxmaEventName =
	"IPR_RESULT_NOTIFICATION_EMAILED"
	| "IPR_USER_REDIRECTED";

export interface TxmaUser {
	"user_id": string;
	"transaction_id": string;
	"session_id": string;
	"govuk_signin_journey_id": string;
	"ip_address"?: string | undefined;
}

export interface BaseTxmaEvent {
	"user": TxmaUser;
	"client_id": string;
	"timestamp": number;
	"component_id": string;
}

export interface TxmaEvent extends BaseTxmaEvent {
	"event_name": TxmaEventName;
	"restricted"?: VerifiedCredential["credentialSubject"];
}

export const buildCoreEventFields = (session: ISessionItem, issuer: string, sourceIp?: string | undefined, getNow: () => number = absoluteTimeNow): BaseTxmaEvent => {
	return {
		user: {
			user_id: session.subject,
			transaction_id: "",
			session_id: session.sessionId,
			govuk_signin_journey_id: session.clientSessionId,
			ip_address: sourceIp,
		},
		client_id: session.clientId,
		timestamp: getNow(),
		component_id: issuer,
	};
};
