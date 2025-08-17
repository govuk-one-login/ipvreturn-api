/* eslint-disable @typescript-eslint/unbound-method */
import { Metrics, MetricUnits } from "@aws-lambda-powertools/metrics";
import { Logger } from "@aws-lambda-powertools/logger";
import { POFailureEventProcessor } from "../../../services/POFailureEventProcessor";
import { mock } from "jest-mock-extended";
import { IPRServiceSession } from "../../../services/IPRServiceSession";
import { Constants } from "../../../utils/Constants";
import { AppError } from "../../../utils/AppError";
import { HttpCodesEnum } from "../../../models/enums/HttpCodesEnum";
import { DynamoDBStreamEvent } from "aws-lambda";
import { VALID_DYNAMODB_STREAM_EVENT_PO_FAILURE, VALID_DYNAMODB_STREAM_EVENT } from "../data/dynamodb-stream-record";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { SessionEvent } from "../../../models/SessionEvent";
import { MessageCodes } from "../../../models/enums/MessageCodes";

let poFailureEventProcessorTest: POFailureEventProcessor;
const mockIprService = mock<IPRServiceSession>();
const mockLogger = mock<Logger>();
const metrics = mock<Metrics>();
let streamEvent: DynamoDBStreamEvent;
jest.spyOn(console, "log").mockImplementation(() => {});

const mockSessionEvent: SessionEvent = {
		userId: "01333e01-dde3-412f-a484-4444",
		clientName: "ipv",
		clientSessionId: "clientSessionId",
		userEmail: "test.user@digital.cabinet-office.gov.uk",
		notified: true,
		ipvStartedOn: 1681902001,
		journeyWentAsyncOn: 1681902002,
		readyToResumeOn: 1681902003,
		redirectUri: "http://redirect.url",
		nameParts: [
			{
				type: "GivenName",
				value: "ANGELA",
			},
			{
				type: "GivenName",
				value: "ZOE",
			},
			{
				type: "FamilyName",
				value: "UK SPECIMEN",
			},
		],
	};

describe("POFailureEventProcessor", () => {
	beforeAll(() => {
		poFailureEventProcessorTest = new POFailureEventProcessor(mockLogger, metrics);
		// @ts-expect-error private access manipulation used for testing
		poFailureEventProcessorTest.iprService = mockIprService;
		streamEvent = VALID_DYNAMODB_STREAM_EVENT_PO_FAILURE; 
	});

	beforeEach(() => {
		jest.clearAllMocks();
		streamEvent = VALID_DYNAMODB_STREAM_EVENT_PO_FAILURE; 
		// @ts-expect-error allow direct value passed to promise
		mockIprService.getSessionBySub.mockReturnValue(mockSessionEvent);
	});

	it("Successfully processes PO failure event and sends email", async () => {
		// @ts-expect-error allow undefined to be passed
		const sessionEvent = unmarshall(streamEvent.Records[0].dynamodb?.NewImage);
		const updateExpression = "SET poFailureNotified = :poFailureNotified";
		const expressionAttributeValues = {
			":poFailureNotified": true,
		};

		await poFailureEventProcessorTest.processRequest(sessionEvent);

		expect(mockIprService.getSessionBySub).toHaveBeenCalledWith("01333e01-dde3-412f-a484-4444");
		expect(mockIprService.sendToGovNotify).toHaveBeenCalledTimes(1);
		expect(mockIprService.sendToGovNotify).toHaveBeenCalledWith({
			Message: {
				userId: "01333e01-dde3-412f-a484-4444",
				emailAddress: "test.user@digital.cabinet-office.gov.uk",
				firstName: "ANGELA",
				lastName: "UK SPECIMEN",
				messageType: Constants.PO_FAILURE_EMAIL,
			},
		});
		expect(mockIprService.saveEventData).toHaveBeenCalledWith("01333e01-dde3-412f-a484-4444", updateExpression, expressionAttributeValues);
		expect(mockLogger.appendKeys).toHaveBeenCalledWith({ govuk_signin_journey_id: "clientSessionId" });
		expect(metrics.addMetric).toHaveBeenCalledWith("POFailureEventProcessor_successfully_processed_events", MetricUnits.Count, 1);
	});

	it("Throws error when session record not found", async () => {
		// @ts-expect-error allow undefined to be passed
		const sessionEvent = unmarshall(streamEvent.Records[0].dynamodb?.NewImage);
		// @ts-expect-error allow direct value passed to promise
		mockIprService.getSessionBySub.mockResolvedValue(null);

		await expect(poFailureEventProcessorTest.processRequest(sessionEvent)).rejects.toThrow(
			new AppError(HttpCodesEnum.SERVER_ERROR, "Session record not found for PO failure event")
		);

		expect(mockIprService.getSessionBySub).toHaveBeenCalledWith("01333e01-dde3-412f-a484-4444");
		expect(mockIprService.sendToGovNotify).not.toHaveBeenCalled();
		expect(mockIprService.saveEventData).not.toHaveBeenCalled();
	});

	it("Throws error when user is already notified for PO failure", async () => {
		// @ts-expect-error allow undefined to be passed
		const sessionEvent = unmarshall(streamEvent.Records[0].dynamodb?.NewImage);
		const alreadyNotifiedRecord = {
			...mockSessionEvent,
			poFailureNotified: true
		};
		// @ts-expect-error allow direct value passed to promise
		mockIprService.getSessionBySub.mockResolvedValue(alreadyNotifiedRecord);

		await expect(poFailureEventProcessorTest.processRequest(sessionEvent)).rejects.toThrow(
			new AppError(HttpCodesEnum.SERVER_ERROR, "User is already notified for this PO failure event.")
		);

		expect(mockIprService.sendToGovNotify).not.toHaveBeenCalled();
		expect(mockIprService.saveEventData).not.toHaveBeenCalled();
	});

	it("Throws error when failed to send to GovNotify queue", async () => {
		// @ts-expect-error allow undefined to be passed
		const sessionEvent = unmarshall(streamEvent.Records[0].dynamodb?.NewImage);
		mockIprService.sendToGovNotify.mockRejectedValueOnce("Failed to send to GovNotify Queue");

		await expect(poFailureEventProcessorTest.processRequest(sessionEvent)).rejects.toThrow(
			new AppError(HttpCodesEnum.SERVER_ERROR, "An error occurred when sending PO_FAILURE_EMAIL type message to GovNotify handler")
		);

		expect(mockIprService.sendToGovNotify).toHaveBeenCalledTimes(1);
		expect(mockLogger.error).toHaveBeenCalledWith("FAILED_TO_WRITE_GOV_NOTIFY", {
			reason: "Processing Event session data, failed to post PO_FAILURE_EMAIL type message to GovNotify SQS Queue",
			error: "Failed to send to GovNotify Queue",
		}, { messageCode: MessageCodes.FAILED_TO_WRITE_GOV_NOTIFY});
		expect(mockIprService.saveEventData).not.toHaveBeenCalled();
	});

	it("Throws error when failed to update session record with PO failure notified flag", async () => {
		// @ts-expect-error allow undefined to be passed
		const sessionEvent = unmarshall(streamEvent.Records[0].dynamodb?.NewImage);
		mockIprService.saveEventData.mockRejectedValueOnce(new Error("Error updating session record"));

		await expect(poFailureEventProcessorTest.processRequest(sessionEvent)).rejects.toThrow(
			new AppError(HttpCodesEnum.SERVER_ERROR, "Error updating session record")
		);

		expect(mockIprService.sendToGovNotify).toHaveBeenCalledTimes(1);
		expect(mockIprService.saveEventData).toHaveBeenCalledTimes(1);
		expect(metrics.addMetric).toHaveBeenCalledWith("po_failure_email_added_to_queue", MetricUnits.Count, 1);
	});

	it("Logs correct message when sending PO failure email", async () => {
		// @ts-expect-error allow undefined to be passed
		const sessionEvent = unmarshall(streamEvent.Records[0].dynamodb?.NewImage);
		await poFailureEventProcessorTest.processRequest(sessionEvent);

		expect(mockLogger.info).toHaveBeenCalledWith({ message: "Trying to send PO_FAILURE_EMAIL type message to GovNotify handler" });
		expect(mockLogger.info).toHaveBeenCalledWith({ message: "Updated the PO failure event record with poFailureNotified flag" });
	});
});