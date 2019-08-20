/**
 * Calculate the actual duration of some time period, possibly given a start time and/or end time.
 * @param {number} totalTime
 * @param {(number\|null\|undefined)} start
 * @param {(number\|null\|undefined)} end
 */
export function clipTimeByStartAndEnd(totalTime: number, start: number, end: number): number {
    if (start === null || start === undefined) {
        start = 0;
    }

    if (end === null || end === undefined) {
        end = totalTime;
    }

    return end - start;
}
