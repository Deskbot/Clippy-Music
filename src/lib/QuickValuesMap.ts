/*
 * The same as a regular Map except .quickValues is a list equivalent to [...map.values]
 * .valuesQuick() updates the list if needed and returns it
 * We know it needs updating when particular methods on Map are called
*/

export class QuickValuesMap<K,V> extends Map<K,V> {
    private quickValuesArr;
    private valuesNeedUpdating;

    constructor(oldMap?) {
        super(oldMap);
        this.quickValuesArr = [];
        this.valuesNeedUpdating = true;
    }

    clear() {
        super.clear();
        this.valuesNeedUpdating = true;
    }

    delete(key): boolean {
        const isSuccess = super.delete(key);
        this.valuesNeedUpdating = true;
        return isSuccess;
    }

    set(key, val): this {
        super.set(key,val);
        this.valuesNeedUpdating = true;
        return this;
    }

    valuesQuick() {
        if (this.valuesNeedUpdating) {
            this.quickValuesArr = [...super.values()];
        }

        this.valuesNeedUpdating = false;

        return this.quickValuesArr;
    }
}
