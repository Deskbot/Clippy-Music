/*
 * The same as a regular Map except .quickValues is a list equivalent to [...map.values]
 * .valuesQuick() updates the list if needed and returns it
 * We know it needs updating when particular methods on Map are called
*/

export class QuickValuesMap extends Map {
    private quickValuesArr;
    private valuesNeedUpdating;

    constructor(...args) {
        super(...args);
        this.quickValuesArr = [];
        this.valuesNeedUpdating = true;
    }

    clear() {
        super.clear();
        this.valuesNeedUpdating = true;
    }

    delete(key) {
        super.delete(key);
        this.valuesNeedUpdating = true;
    }

    forEach(...args) {
        super.forEach(...args);
        this.valuesNeedUpdating = true;
    }

    set(key, val) {
        super.set(key,val);
        this.valuesNeedUpdating = true;
    }

    valuesQuick() {
        if (this.valuesNeedUpdating) {
            this.quickValuesArr = [...super.values()];
        }

        this.valuesNeedUpdating = false;

        return this.quickValuesArr;
    }
}
