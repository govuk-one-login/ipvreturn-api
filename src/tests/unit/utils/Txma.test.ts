import { buildCoreEventFields } from "../../../utils/TxmaEvent";

const timestamp = 1687181105;
const sub = "userId";

jest.mock("../../../utils/DateTimeUtils", () => ({
	absoluteTimeNow: () => timestamp,
}));

describe("TxmaEvents", () => {
	describe("buildCoreEventFields", () => {
		it("Returns object with default values", () => {
			expect(buildCoreEventFields({})).toEqual({ timestamp });
		});

		it("Returns object with user if sub id provided", () => {
			expect(buildCoreEventFields({ sub })).toEqual({ user: { user_id: sub }, timestamp });
		});
	});
});
