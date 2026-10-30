type SupportedLocale = "en-GB" | "cy-GB";

const EUROPE_LONDON_TIME_ZONE = "Europe/London";
const UTC_TIME_ZONE = "UTC";

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
};

const TIME_OPTIONS: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
};

/**
 * For date-only ISO string e.g. '2026-10-20'
 * These are interpreted as midnight UTC so must be explicitly formatted using UTC not Europe/London timezone
 *
 * @returns Example output: 20 October 2026 or 20 Hydref 2026
 */
export function getFormattedDateFromIsoString(
    isoDateString: string,
    locale: SupportedLocale,
): string {
    const dateObject = new Date(isoDateString);
    const formattedDate = dateObject.toLocaleDateString(locale, {
        timeZone: UTC_TIME_ZONE,
        ...DATE_OPTIONS,
    });
    return formattedDate;
}

/**
 * For Unix Timestamp in seconds e.g. 1792484420
 * Formats it based on whether the date is during GMT or BST
 *
 * @returns Example output: 20 October 2026 or 20 Hydref 2026
 */
export function getFormattedDateFromUnixTimestamp(
    timestamp: number,
    locale: SupportedLocale,
): string {
    const dateObject = new Date(timestamp * 1000);
    const formattedDate = dateObject.toLocaleDateString(locale, {
        timeZone: EUROPE_LONDON_TIME_ZONE,
        ...DATE_OPTIONS,
    });
    return formattedDate;
}

/**
 * For Unix Timestamp in seconds e.g. 1792484420
 * Formats the time based on whether the date is during GMT or BST
 *
 * @returns Example output: 4:05pm
 */
export function getFormattedTimeFromUnixTimestamp(timestamp: number): string {
    const dateObject = new Date(timestamp * 1000);
    const formattedTime = dateObject
        .toLocaleTimeString("en-GB", {
            timeZone: EUROPE_LONDON_TIME_ZONE,
            ...TIME_OPTIONS,
        })
        .replace(" ", "");
    return formattedTime;
}

/**
 * Unix timestamp in seconds
 * The unix timestamp represents seconds elapsed since 01/01/1970
 *
 * @return Example output: 1657099344
 */
export function absoluteTimeNow(): number {
	return Math.floor(Date.now() / 1000);
}

const welshMonths: Record<string, string> = {
    January: "Ionawr",
    February: "Chwefror",
    March: "Mawrth",
    April: "Ebrill",
    May: "Mai",
    June: "Mehefin",
    July: "Gorffennaf",
    August: "Awst",
    September: "Medi",
    October: "Hydref",
    November: "Tachwedd",
    December: "Rhagfyr",
};

export function translateDateToWelsh(englishDate: string): string {
    const [day, month, year] = englishDate.split(" ");
    return `${day} ${welshMonths[month]} ${year}`;
}
