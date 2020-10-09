import * as arrayUtils from "../utils/arrayUtils";

/**
 * This file contains a class that implements a UniqueArray.
 * This is the same as a Set but the order is retained.
 */

export class UniqueArray<T> {
    private arr: T[];

    constructor(initial: T[] = []) {
        this.arr = initial;
    }

    getArray() {
        return [...this.arr];
    }

    indexOf(elem: T): number {
        return this.arr.indexOf(elem);
    }

    get length() {
        return this.arr.length;
    }

    push(item: T) {
        if (this.arr.includes(item)) {
            return;
        }

        this.arr.push(item);
    }

    shift(): T | undefined {
        return this.arr.shift();
    }

    remove(item: T) {
        arrayUtils.removeItem(this.arr, item);
    }
}
