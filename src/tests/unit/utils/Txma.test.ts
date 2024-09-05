import { buildCoreEventFields } from "../../../utils/TxmaEvent";
import { EnvironmentVariables } from "../../../services/EnvironmentVariables";

const user_id = "userId";
const email = "test@test.com";
const mockComponentId = "test-component-id";
const mockEnvironmentVariables = { componentId: () => mockComponentId } as Pick<EnvironmentVariables, "componentId">;

describe("TxmaEvents", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.useFakeTimers();
		jest.setSystemTime(new Date(1585695600000));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe("buildCoreEventFields", () => {
		it("Returns object with default values user and timestamp", () => {
			expect(buildCoreEventFields({ user_id }, mockEnvironmentVariables)).toEqual({
				user: { user_id },
				timestamp: 1585695600,
				event_timestamp_ms: 1585695600000,
				component_id: mockComponentId,
			});
		});

		it("Returns object with user with email if provided", () => {
			expect(buildCoreEventFields({ user_id, email }, mockEnvironmentVariables)).toEqual({
				user: { user_id, email },
				timestamp: 1585695600,
				event_timestamp_ms: 1585695600000,
				component_id: "test-component-id",
			});
		});
	});
});
