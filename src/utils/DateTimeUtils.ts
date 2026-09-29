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
