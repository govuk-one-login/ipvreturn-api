import { buildCoreEventFields } from "../../../utils/TxmaEvent";

const timestamp = 1687181105;
const user_id = "userId";
const email = "test@test.com";

jest.mock("../../../utils/DateTimeUtils", () => ({
	absoluteTimeNow: () => timestamp,
}));

describe("TxmaEvents", () => {
	describe("buildCoreEventFields", () => {
		it("Returns object with default values user and timestamp", () => {
			expect(buildCoreEventFields({ user_id })).toEqual({ user: { user_id }, timestamp });
		});

		it("Returns object with user with email if provided", () => {
			expect(buildCoreEventFields({ user_id, email })).toEqual({ user: { user_id, email }, timestamp });
		});
	});
});
