export class OneToManyMap<K,V> {
    private readonly map: Map<K,V[]>;

    constructor() {
        this.map = new Map();
    }

    entries(): IterableIterator<[K, V[]]> {
        return this.map.entries();
    }

    getAll(k: K): ReadonlyArray<V> | undefined {
        return this.map.get(k);
    }

    keys(): IterableIterator<K> {
        return this.map.keys();
    }

    removeAll(k: K) {
        this.map.delete(k);
    }

    removeIf(k: K, pred: (v: V) => boolean): boolean {
        const values = this.map.get(k);

        if (values === undefined) {
            return false;
        }

        for (let i = 0; i < values.length; i++) {
            if (pred(values[i])) {
                values.splice(i, 1);
                return true;
            }
        }

        return false;
    }

    set(k: K, v: V) {
        const mappedTo = this.map.get(k);

        if (mappedTo) {
            mappedTo.push(v);
        } else {
            this.map.set(k, [v]);
        }
    }

    setMany(k: K, vs: V[]) {
        const mappedTo = this.map.get(k);

        if (mappedTo) {
            mappedTo.push(...vs);
        } else {
            this.map.set(k, [...vs]);
        }
    }

    values(): IterableIterator<V[]> {
        return this.map.values();
    }
}
