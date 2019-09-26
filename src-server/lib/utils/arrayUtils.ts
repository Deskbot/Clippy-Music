export function arrSum(a: number[]): number {
    return a.reduce((n, p) => n + p);
}

export function allTrue(bools: boolean[]): boolean {
    for (const bool of bools) {
        if (bool === false) return false;
    }

    return true;
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

export function removeAll<T>(arr: T[], predicate: (elem: T) => boolean) {
    // when an item is removed the indices to the right will change
    // so check whether to remove items from right to left
    for (let i = arr.length - 1; i >= 0; i--) {
        if (predicate(arr[i])) {
            arr.splice(i, 1);
        }
    }
}
