export class RoundRobin<T> {
    private list: T[] = [];
    private set: Set<T> = new Set();

    add(value: T) {
        const beforeSize = this.set.size;
        this.set.add(value);
        const afterSize = this.set.size;

        if (afterSize > beforeSize) {
            this.list.push(value);
        }
    }

    isEmpty(): boolean {
        return this.list.length === 0;
    }

    next(): T {
        if (this.isEmpty()) {
            throw new Error("Tried to get the next item when there are none.");
        }

        const head = this.list.splice(0, 1)[0];
        this.list.push(head);

        return head;
    }
}
