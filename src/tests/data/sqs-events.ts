import { ReturnSQSEvent } from "../../models/ReturnSQSEvent";

export const VALID_GOV_NOTIFY_HANDLER_SQS_EVENT = {
	"Records": [
		{
			"messageId": "6e67a34a-94f1-493f-b9eb-3d421aa701a8",
			// pragma: allowlist nextline secret
			"receiptHandle": "AQEBDzpW+TMqnd6I8zcqmrq8g8BTsuDjI745ci0bJ46g0Ej",
			"body": "{\"Message\":{\"userId\":\"user_id\",\"emailAddress\":\"test.user@digital.cabinet-office.gov.uk\",\"firstName\":\"Frederick\",\"lastName\":\"Flintstone\",\"messageType\":\"email\"}}",
			"attributes": {
				"ApproximateReceiveCount": "1",
				"SentTimestamp": "1588867971441",
				"SenderId": "AIDAIVEA3AGEU7NF6DRAG",
				"ApproximateFirstReceiveTimestamp": "1588867971443",
			},
			"messageAttributes": {},
			// pragma: allowlist nextline secret
			"md5OfBody": "ef38e4dfa52ade850f671b7e1915f26b",
			"eventSource": "aws:sqs",
			"eventSourceARN": "queue_arn",
			"awsRegion": "eu-west-2",
		},
	],
};

export const VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT: ReturnSQSEvent = {
	event_id: "588f4a66-f75a-4728-9f7b-8afd865c233c",
	client_id: "ekwU",
	clientLandingPageUrl: "REDIRECT_URL",
	event_name: "AUTH_IPV_AUTHORISATION_REQUESTED",
	// rp_name: "replay",
	timestamp: 1681902001,
	timestamp_formatted: "2023-04-19T11:00:01.000Z",
	user: {
		user_id: "01333e01-dde3-412f-a484-5555",
		email: "jest@test.com",
	},
};

export const VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT_STRING = JSON.stringify(VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT);

export const VALID_AUTH_IPV_AUTHORISATION_REQUESTED_SQS_EVENT = {
	"Records": [
		{
			"messageId": "6e67a34a-94f1-493f-b9eb-3d421aa701a8",
			// pragma: allowlist nextline secret
			"receiptHandle": "AQEBDzpW+TMqnd6I8zcqmrq8g8BTsuDjI745ci0bJ46g0Ej",
			"body": VALID_AUTH_IPV_AUTHORISATION_REQUESTED_TXMA_EVENT_STRING,
			"attributes": {
				"ApproximateReceiveCount": "1",
				"SentTimestamp": "1588867971441",
				"SenderId": "AIDAIVEA3AGEU7NF6DRAG",
				"ApproximateFirstReceiveTimestamp": "1588867971443",
			},
			"messageAttributes": {},
			// pragma: allowlist nextline secret
			"md5OfBody": "ef38e4dfa52ade850f671b7e1915f26b",
			"eventSource": "aws:sqs",
			"eventSourceARN": "queue_arn",
			"awsRegion": "eu-west-2",
		},
	],
};

export const VALID_F2F_YOTI_START_TXMA_EVENT: ReturnSQSEvent = {
	"event_id": "588f4a66-f75a-4728-9f7b-8afd865c233d",
	"client_id": "ekwU",
	"event_name": "F2F_YOTI_START",
	"timestamp": 1681902001,
	"timestamp_formatted": "2023-04-19T11:00:01.000Z",
	"user": {
		"user_id": "01333e01-dde3-412f-a484-4444",
		"email": "jest@test.com",
	},
};

export const VALID_F2F_YOTI_START_TXMA_EVENT_STRING = JSON.stringify(VALID_F2F_YOTI_START_TXMA_EVENT);

export const VALID_IPV_F2F_CRI_VC_CONSUMED_TXMA_EVENT: ReturnSQSEvent = {
	"event_id": "588f4a66-f75a-4728-9f7b-8afd865c233e",
	"client_id": "ekwU",
	"event_name": "IPV_F2F_CRI_VC_CONSUMED",
	"clientLandingPageUrl": "REDIRECT_URL",
	"timestamp": 1681902001,
	"timestamp_formatted": "2023-04-19T11:00:01.000Z",
	"user": {
		"user_id": "01333e01-dde3-412f-a484-4444",
		// pragma: allowlist nextline secret
		"email": "e914e32172adcdad6c0906f7e5a0f4f43a6e99847c4370df783c7142f71ba454",
	},
	"restricted": {
		"nameParts": [
			{
				"type": "GivenName",
				"value": "ANGELA",
			},
			{
				"type": "GivenName",
				"value": "ZOE",
			},
			{
				"type": "FamilyName",
				"value": "UK SPECIMEN",
			},
		],
	},
};

export const VALID_IPV_F2F_CRI_VC_CONSUMED_TXMA_EVENT_STRING = JSON.stringify(VALID_IPV_F2F_CRI_VC_CONSUMED_TXMA_EVENT);

export const VALID_AUTH_DELETE_ACCOUNT_TXMA_EVENT = {
	event_id: "588f4a66-f75a-4728-9f7b-8afd865c233f",
	client_id: "ekwU",
	component_id: "UNKNOWN",
	event_name: "AUTH_DELETE_ACCOUNT",
	redirect_uri: "www.localhost.com",
	timestamp: 1681902001,
	timestamp_formatted: "2023-04-19T11:00:01.000Z",
	user: {
		user_id: "01333e01-dde3-412f-a484-3333",
		// pragma: allowlist nextline secret
		email: "e914e32172adcdad6c0906f7e5a0f4f43a6e99847c4370df783c7142f71ba454",
	},
};

export const VALID_AUTH_DELETE_ACCOUNT_TXMA_EVENT_STRING = JSON.stringify(VALID_AUTH_DELETE_ACCOUNT_TXMA_EVENT);


export const VALID_GOV_NOTIFY_SQS_TXMA_EVENT = {
	Message: {
		emailAddress: "jest@test.com",
		firstName: "Test",
		lastName: "User",
		messageType: "email",
		userId: "1-1333e01-dde3-412f-a484-3333",
	},
};

export const VALID_GOV_NOTIFY_SQS_TXMA_EVENTT_STRING = JSON.stringify(VALID_GOV_NOTIFY_SQS_TXMA_EVENT);

export const VALID_F2F_DOCUMENT_UPLOADED_TXMA_EVENT: ReturnSQSEvent = {
	"event_id": "588f4a66-f75a-4728-9f7b-8afd865c233e",
	"client_id": "ekwU",
	"event_name": "F2F_DOCUMENT_UPLOADED",
	"timestamp": 1681902001,
	"timestamp_formatted": "2023-04-19T11:00:01.000Z",
	"user": {
		"user_id": "01333e01-dde3-412f-a484-4444",
	},
	"extensions": {
		"post_office_visit_details": [
			{
				"post_office_date_of_visit": "1985-01-25",
				"post_office_time_of_visit": 1688477191,
			},
		],
	},
};
