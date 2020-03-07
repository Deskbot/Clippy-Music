export function toNumber(data: any): number | undefined {
    const maybeNaN = parseInt(data);
    if (Number.isNaN(maybeNaN)) {
        return undefined;
    }

    return maybeNaN;
}
