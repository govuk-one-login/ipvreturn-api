export enum EventNameEnum {
	INSERT = "INSERT",
	MODIFY = "MODIFY",
	REMOVE = "REMOVE",
}

export enum StreamViewType {
	NEW_IMAGE = "NEW_IMAGE",
	KEYS_ONLY = "KEYS_ONLY",
	OLD_IMAGE = "OLD_IMAGE",
	NEW_AND_OLD_IMAGES = "NEW_AND_OLD_IMAGES",
}

export const VALID_DYNAMODB_STREAM_EVENT = {
	"Records": [
		{
			"eventID": "testa13d34c",
			"eventName": EventNameEnum.MODIFY,
			"eventVersion": "1.1",
			"eventSource": "aws:dynamodb",
			"awsRegion": "eu-west-2",
			"dynamodb": {
				"ApproximateCreationDateTime": 1479499740,
				"Keys": {
					"userId": {
						"S": "userId",
					},
				},
				"NewImage": {
					"userEmail": {
						"S": "bhavana.hemanth@digital.cabinet-office.gov.uk",
					},
					"userId": {
						"S": "01333e01-dde3-412f-a484-4444",
					},
					"clientName": {
						"S": "clientName",
					},
					"redirectUri": {
						"S": "redirect_uri",
					},
					"ipvStartedOn": {
						"N": "1681902001",
					},
					"journeyWentAsyncOn": {
						"N": "1681902002",
					},
					"readyToResumeOn": {
						"N": "1681902003",
					},
				},
				"SequenceNumber": "13021600000000001596893679",
				"SizeBytes": 112,
				"StreamViewType": StreamViewType.NEW_IMAGE,
			},
			"eventSourceARN": "arn:aws:dynamodb:region:123456789012:table/SessionEventsTable/stream/2016-11-16T20:42:48.104",
		},
	],
}
;

