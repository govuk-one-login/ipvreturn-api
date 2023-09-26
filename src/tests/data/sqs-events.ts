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
    "event_name": "F2F_YOTI_START",
    "user": {
        "user_id": "5eba8106-bda4-4277-8ac7-e60676f68ac3",
        "govuk_signin_journey_id": "dec81183321f52130801ea131741dc45",
    },
    "client_id": "RqFZ83csmS4Mi4Y7s7ohD9-ekwU",
    "timestamp": 1688477191,
    "timestamp_formatted": "2023-04-19T11:00:01.000Z",
    "rp_name": "replay",
    "extensions": {
        "post_office_details": [
            {
                "name": "Post Office Name",
                "address": "1 The Street, Funkytown",
                "location": [
                    {
                        "latitude": 0.34322,
                        "longitude": -42.48372,
                    },
                ],
                "post_code": "N1 2AA",
            },
        ],
    },
    "restricted": {
        "document_details": [
            {
                "documentType": "PASSPORT",
            },
        ],
    },
};

export const VALID_F2F_YOTI_START_TXMA_EVENT_STRING = JSON.stringify(VALID_F2F_YOTI_START_TXMA_EVENT);

export const VALID_IPV_F2F_CRI_VC_CONSUMED_TXMA_EVENT: ReturnSQSEvent = {
    "event_name": "IPV_F2F_CRI_VC_CONSUMED",
	"client_id": "ekwU",
    "event_id": "ad040c0c-6729-4814-8569-aa9dd759d2c8",
    "component_id": "https://g1vp8kzas9.execute-api.eu-west-2.amazonaws.com",
    "user": {
        "user_id": "5eba8106-bda4-4277-8ac7-e60676f68ac3",
        "session_id": null,
        "govuk_signin_journey_id": "a-test-journey-id",
        "ip_address": null,
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
            }
        ],
        "docExpiryDate": "2030-11-21"
    },
    "timestamp": 1685821531,
};

export const VALID_IPV_F2F_CRI_VC_CONSUMED_TXMA_EVENT_STRING = JSON.stringify(VALID_IPV_F2F_CRI_VC_CONSUMED_TXMA_EVENT);

export const VALID_IPV_F2F_DOCUMENT_UPLOADED_TXMA_EVENT: ReturnSQSEvent = {
    "event_name": "F2F_DOCUMENT_UPLOADED",
	"client_id": "ekwU",
    "event_id": "ad040c0c-6729-4814-8569-aa9dd759d2c9",
    "user": {
        "user_id": "5eba8106-bda4-4277-8ac7-e60676f68ac3",
    },
    "extensions": {
        "post_office_visit_details": [
            {
                "post_office_date_of_visit": "7 September 2023",
                "post_office_time_of_visit": "4:43 pm",
            },
        ],
    },
    "timestamp": 1685821541,
};

export const VALID_IPV_F2F_DOCUMENT_UPLOADED_TXMA_EVENT_STRING = JSON.stringify(VALID_IPV_F2F_DOCUMENT_UPLOADED_TXMA_EVENT);

export const VALID_IPV_F2F_CRI_VC_CONSUMED_WITH_DOC_EXPIRYDATE_TXMA_EVENT: ReturnSQSEvent = {
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
		"docExpiryDate": "2030-01-01",
	},
};

export const VALID_IPV_F2F_CRI_VC_CONSUMED_WITH_DOC_EXPIRYDATE_TXMA_EVENT_STRING = JSON.stringify(VALID_IPV_F2F_CRI_VC_CONSUMED_WITH_DOC_EXPIRYDATE_TXMA_EVENT);


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
				"post_office_date_of_visit": "7 September 2023",
				"post_office_time_of_visit": "4:43 pm",
			},
		],
	},
};

export const VALID_F2F_YOTI_START_WITH_PO_DOC_DETAILS_TXMA_EVENT: ReturnSQSEvent = {
	"event_id": "588f4a66-f75a-4728-9f7b-8afd865c233d",
	"client_id": "ekwU",
	"event_name": "F2F_YOTI_START",
	"timestamp": 1681902001,
	"timestamp_formatted": "2023-04-19T11:00:01.000Z",
	"user": {
		"user_id": "01333e01-dde3-412f-a484-4444",
		"email": "jest@test.com",
	},
	"extensions": {
		"post_office_details": [
			{
				"name": "Post Office Name",
				"address": "1 The Street, Funkytown",
				"location": [
					{
						"latitude": 0.34322,
						"longitude": -42.48372,
					},
				],
				"post_code": "N1 2AA",
			},
		],
	},
	"restricted": {
		"document_details": [
			{
				"documentType": "PASSPORT",
			},
		],
	},
};
