export abstract class MakeOnce<T> {
	private object: T | undefined;

	get(): T {
		if (!this.object) {
			this.object = this.make();
		}

		return this.object;
	}

	protected abstract make(): T;
}
