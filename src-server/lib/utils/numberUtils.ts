/**
 * Takes two numbers. If the first number is NaN, return the second number,
 * otherwise return the first number.
 * @param nanable The number whose NaNness to check.
 * @param fallback The number to return when the first argument is NaN
 */
export function defaultIfNaN(nanable: number, fallback: number): number {
    return Number.isNaN(nanable) ? fallback : nanable;
}

/**
 * Converts a value to a number.
 * @returns NaN iff a numeric string is not given, otherwise a number.
 */
export function parseNaNableInt(maybeANumericString: any, radix?: number) {
    return parseInt(maybeANumericString as string, radix);
}
