import * as utils from "./utils";

export function arrSum(a: number[]): number {
    return a.reduce((n, p) => n + p);
}

/**
 * @return True when the all the elements are true or when there are no elements.
 */
export function allTrue(bools: boolean[]): boolean {
    for (const bool of bools) {
        if (bool === false) return false;
    }

    return true;
}

/**
 * @return True when the given array contains at least one true
 */
export function anyTrue(bools: boolean[]): boolean {
    for (const bool of bools) {
        if (bool === true) return true;
    }

    return false;
}

export function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
    for (let i = arr.length - 1; i >= 0; i--) {
        if (predicate(arr[i])) {
            return i;
        }
    }

    return -1;
}

export function isNumberArray(val: any): val is number[] {
    return Array.isArray(val)
        && allTrue(
            val.map((item: any) => typeof item === "number")
        );
}

/**
 * Modify a list by inserting an item into it at a location randomly chosen after a given index.
 *
 * @param arr The array to modify
 * @param index The location of the list to insert the new item after
 * @param newItem The item to insert into the list
 */
export function randInsertAfter<T>(arr: T[], index: number, newItem: T) {
    const targetIndex = utils.randIntBetween(index + 1, arr.length);
    const itemsAfterNew = arr.splice(targetIndex);
    // arr is modified to lose all items after new

    arr.push(newItem, ...itemsAfterNew);
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

export function zip<T,U>(arr1: T[], arr2: U[]): [T,U][] {
    const len = Math.min(arr1.length, arr2.length);
    const result = [] as [T, U][];

    for (let i = 0; i < len; i++) {
        result.push([arr1[i], arr2[i]]);
    }

    return result;
}
