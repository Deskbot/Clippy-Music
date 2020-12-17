export class Cache<T> {
    private func: () => T;
    private needToRecompute: boolean;
    private result: T | undefined;

    constructor(func: () => T) {
        this.func = func;
        this.needToRecompute = false;
    }

    inputsChanged() {
        this.needToRecompute = true;
    }

    get(): T {
        if (this.needToRecompute) {
            this.result = this.func();
            this.needToRecompute = false;
        }

        return this.result!;
    }
}
