import { buildCoreEventFields } from "../../../utils/TxmaEvent";

const user_id = "userId";
const email = "test@test.com";

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
			expect(buildCoreEventFields({ user_id })).toEqual({
				user: { user_id },
				timestamp: 1585695600,
				event_timestamp_ms: 1585695600000,
			});
		});

		it("Returns object with user with email if provided", () => {
			expect(buildCoreEventFields({ user_id, email })).toEqual({
				user: { user_id, email },
				timestamp: 1585695600,
				event_timestamp_ms: 1585695600000,
			});
		});
	});
});
