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
			"eventID": "testId",
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
						"S": "test.user@digital.cabinet-office.gov.uk",
					},
					"userId": {
						"S": "01333e01-dde3-412f-a484-4444",
					},
					"clientName": {
						"S": "clientName",
					},
					"clientSessionId": {
						"S": "clientSessionId",
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
					"nameParts": {
						"L": [
							{
								"M": {
									"type": { "S": "GivenName" },
									"value": { "S": "ANGELA" },
								},
							},
							{
								"M": {
									"type": { "S": "GivenName" },
									"value": { "S": "ZOE" },
								},
							},
							{
								"M": {
									"type": { "S": "FamilyName" },
									"value": { "S": "UK SPECIMEN" },
								},
							},
						],
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

export const VALID_DYNAMODB_STREAM_EVENT_WITH_PO_DETAILS = {
	"Records": [
		{
			"eventID": "testId",
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
						"S": "test.user@digital.cabinet-office.gov.uk",
					},
					"userId": {
						"S": "01333e01-dde3-412f-a484-4444",
					},
					"clientName": {
						"S": "clientName",
					},
					"clientSessionId": {
						"S": "clientSessionId",
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
					"documentExpiryDate": {
						"S": "2030-01-01",
					},
					"documentUploadedOn": {
						"N": "1685821541",
					},
  					"documentType": {
    					"S": "PASSPORT",
  					},
					"postOfficeVisitDetails": {
						"L": [
						  {
								"M": {
							  "post_office_date_of_visit": {
										"S": "1985-01-25",
							  },
							  "post_office_time_of_visit": {
										"S": "1688477191",
							  },
								},
						  },
						],
					},
					"postOfficeInfo": {
						"L": [
						  {
								"M": {
							  "address": {
										"S": "1 The Street, Funkytown",
							  },
							  "location": {
										"L": [
								  {
												"M": {
									  "latitude": {
														"N": "0.34322",
									  },
									  "longitude": {
														"N": "-42.48372",
									  },
												},
								  },
										],
							  },
							  "name": {
										"S": "Post Office Name",
							  },
							  "post_code": {
										"S": "N1 2AA",
							  },
								},
						  },
						],
					},
					"nameParts": {
						"L": [
							{
								"M": {
									"type": { "S": "GivenName" },
									"value": { "S": "ANGELA" },
								},
							},
							{
								"M": {
									"type": { "S": "GivenName" },
									"value": { "S": "ZOE" },
								},
							},
							{
								"M": {
									"type": { "S": "FamilyName" },
									"value": { "S": "UK SPECIMEN" },
								},
							},
						],
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

