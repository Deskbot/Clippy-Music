export function makeOnce<T>(make: () => T) {
	let made = false;
	let value: T;

	return {
		get() {
			if (!made) {
				value = make();
				made = true;
			}

			return value;
		}
	}
}
