/**
 * Given a list of season years and the currently-selected year,
 * return candidate fallback years for strategy recommendations
 * (most recent years before selectedYear).
 */
export function strategyCandidates(seasonYears: number[], selectedYear: number): number[] {
    const fromStore = [...seasonYears].sort((a, b) => b - a).filter((year) => year < selectedYear)
    if (fromStore.length > 0) return fromStore

    const fallback: number[] = []
    for (let year = selectedYear - 1; year >= Math.max(2020, selectedYear - 2); year -= 1) fallback.push(year)
    return fallback
}
