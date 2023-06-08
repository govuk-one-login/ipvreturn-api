import { NamePart } from "../models/SessionReturnRecord";

export const personalIdentityUtils = {
	getNames(nameParts: NamePart[]): { givenNames: string[]; familyNames: string[] } {
		const givenNames: string[] = [];
		const familyNames: string[] = [];

		for (const namePart of nameParts) {
			if (namePart.type === "GivenName") {
				givenNames.push(namePart.value);
			}
			if (namePart.type === "FamilyName") {
				familyNames.push(namePart.value);
			}
		}

		return { givenNames, familyNames };
	}
};
