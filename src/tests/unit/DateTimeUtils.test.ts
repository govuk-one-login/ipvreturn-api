import {
  translateDateToWelsh,
  getFormattedDateFromIsoString,
  getFormattedDateFromUnixTimestamp,
  getFormattedTimeFromUnixTimestamp,
} from "../../utils/DateTimeUtils";

describe("getFormattedDateFromIsoString", () => {
  it.each([
    ["2024-02-04", "4 February 2024"],
    ["2025-03-30", "30 March 2025"],
    ["2026-07-12", "12 July 2026"],
    ["2027-12-28", "28 December 2027"],
  ])(
    "should convert the date from %s to be %s when the language is English",
    (isoString: string, expectedDate: string) => {
      const formattedEnglishDate = getFormattedDateFromIsoString(
        isoString,
        "en-GB",
      );

      expect(formattedEnglishDate).toBe(expectedDate);
    },
  );

  it.each([
    ["2024-02-04", "4 Chwefror 2024"],
    ["2025-03-30", "30 Mawrth 2025"],
    ["2026-07-12", "12 Gorffennaf 2026"],
    ["2027-12-28", "28 Rhagfyr 2027"],
  ])(
    "should convert the date from %s to be %s when the language is Welsh",
    (isoString: string, expectedDate: string) => {
      const formattedEnglishDate = getFormattedDateFromIsoString(
        isoString,
        "cy-GB",
      );

      expect(formattedEnglishDate).toBe(expectedDate);
    },
  );
});

describe("getFormattedDateFromUnixTimestamp", () => {
  it.each([
    [1704241220, "3 January 2024"],
    [1750119620, "17 June 2025"],
    [1792484420, "20 October 2026"],
    [1827582615, "30 November 2027"],
  ])(
    "should convert the timestamp from %s to %s when the language is English",
    (timestamp: number, expectedDate: string) => {
      const formattedEnglishDate = getFormattedDateFromUnixTimestamp(
        timestamp,
        "en-GB",
      );

      expect(formattedEnglishDate).toBe(expectedDate);
    },
  );

  it.each([
    [1704241220, "3 Ionawr 2024"],
    [1750119620, "17 Mehefin 2025"],
    [1792484420, "20 Hydref 2026"],
    [1827582615, "30 Tachwedd 2027"],
  ])(
    "should convert the timestamp from %s to %s when the language is Welsh",
    (timestamp: number, expectedDate: string) => {
      const formattedWelshDate = getFormattedDateFromUnixTimestamp(
        timestamp,
        "cy-GB",
      );

      expect(formattedWelshDate).toBe(expectedDate);
    },
  );
});

describe("getFormattedTimeFromUnixTimestamp", () => {
  it.each([
    [1704268800, "8:00am"], // January - GMT
    [1772364840, "11:34am"], // March - GMT
    [1827594240, "5:04pm"], // November - GMT
    [1796428800, "12:00am"], // December - GMT
  ])(
    "should convert the timestamp from %s to %s when the date is during GMT",
    (timestamp: number, expectedTime: string) => {
      const formattedTime = getFormattedTimeFromUnixTimestamp(timestamp);

      expect(formattedTime).toBe(expectedTime);
    },
  );

  it.each([
    [1778572800, "9:00am"], // May - BST
    [1783245360, "10:56am"], // July - BST
    [1787839320, "3:02pm"], // August - BST
    [1788562920, "12:02am"], // September - BST
  ])(
    "should convert the timestamp from %s to %s (one hour ahead of UTC) when the date is during BST",
    (timestamp: number, expectedTime: string) => {
      const formattedTime = getFormattedTimeFromUnixTimestamp(timestamp);

      expect(formattedTime).toBe(expectedTime);
    },
  );
});

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
