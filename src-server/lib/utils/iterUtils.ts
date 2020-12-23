export function *map<T extends keyof any, U>
    (itr: Iterable<T>, mapper: (elem: T) => U): IterableIterator<U>
{
    for (const elem of itr) {
        yield mapper(elem);
    }
}
