/**
 * Calculate the actual duration of some time period, possibly given a start time and/or end time.
 */
export function clipTimeByStartAndEnd(
    totalTime: number,
    start: number | null | undefined,
    end: number | null | undefined
): number {
    if (start === null || start === undefined) {
        start = 0;
    }

    if (end === null || end === undefined) {
        end = totalTime;
    }

    return end - start;
}
