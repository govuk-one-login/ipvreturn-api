import { translateDateToWelsh } from "../../utils/DateTimeUtils";

describe("translateDateToWelsh", () => {
  it.each([
    ["18 January 2024", "18 Ionawr 2024"],
    ["12 April 2025", "12 Ebrill 2025"],
    ["5 June 2026", "5 Mehefin 2026"],
    ["27 October 2027", "27 Hydref 2027"],
  ])(
    "should translate the date from %s in English to %s in Welsh",
    (englishDate: string, expectedDate: string) => {
      const welshDate = translateDateToWelsh(englishDate);

      expect(welshDate).toBe(expectedDate);
    },
  );
});
