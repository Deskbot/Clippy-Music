export function mapToObject<T extends keyof any, U>
    (arr: Iterable<T>, mapper: (elem: T) => U): Record<T, U> {
    const o = {} as Record<T, U>;

    for (const elem of arr) {
        o[elem] = mapper(elem);
    }

    return o;
}
