export function arrSum(a: number[]): number {
    return a.reduce((n, p) => n + p);
}

export function removeFirst<T>(arr: T[], predicate: (elem: T) => boolean): boolean {
    for (let i = 0; i < arr.length; i++) {
        if (predicate(arr[i])) {
            arr.splice(i, 1);
            return true;
        }
    }

    return false;
}
