export const VALID_SQS_EVENT = {
	"Records": [
		{
			"messageId": "6e67a34a-94f1-493f-b9eb-3d421aa701a8",
			// pragma: allowlist nextline secret
			"receiptHandle": "AQEBDzpW+TMqnd6I8zcqmrq8g8BTsuDjI745ci0bJ46g0Ej",
			"body": "{\"Message\":{\"emailAddress\":\"bhavana.hemanth@digital.cabinet-office.gov.uk\",\"firstName\":\"Frederick\",\"lastName\":\"Flintstone\",\"messageType\":\"email\"}}",
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
}
;

export const VALID_AUTH_IPV_AUTHORISATION_REQUESTED_EVENT = {
	"Records": [
		{
			"messageId": "6e67a34a-94f1-493f-b9eb-3d421aa701a8",
			// pragma: allowlist nextline secret
			"receiptHandle": "AQEBDzpW+TMqnd6I8zcqmrq8g8BTsuDjI745ci0bJ46g0Ej",
			"body": "{\n\t\"event_id\": \"588f4a66-f75a-4728-9f7b-8afd865c233c\",\n\t\"client_id\": \"RqFZ83csmS4Mi4Y7s7ohD9-ekwU\",\n\t\"component_id\": \"UNKNOWN\",\n\t\"event_name\": \"AUTH_IPV_AUTHORISATION_REQUESTED\",\n\t\"timestamp\": 1681902001,\n\t\"timestamp_formatted\": \"2023-04-19T11:00:01.000Z\",\n\t\"user\": {\n\t\t\t\"user_id\": \"urn:fdc:gov.uk:2022:YbunsNpXM56SE0NMMcC0LmTRWrWMg33FqiFz-CWvxD8\",\n\t\t\t\"email\": \"e914e32172adcdad6c0906f7e5a0f4f43a6e99847c4370df783c7142f71ba454\"\n\t}\n}",
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
}
;
