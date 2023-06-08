import { personalIdentityUtils } from "../../../utils/PersonalIdentityUtils";

describe("PersonalIdentityUtils", () => {
	describe("getNames", () => {
		it("returns formatted object with given names and family names", () => {
			const nameParts = [
				{
					type: "GivenName",
					value: "ANGELA"
				},
				{
					type: "GivenName",
					value: "ZOE"
				},
				{
					type: "FamilyName",
					value: "UK SPECIMEN"
				}
			];
			const result = personalIdentityUtils.getNames(nameParts);
			expect(result).toEqual({
				givenNames: ["ANGELA", "ZOE"],
				familyNames: ["UK SPECIMEN"]
			});
		});
	});
});
