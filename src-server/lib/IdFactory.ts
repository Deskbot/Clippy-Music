export class IdFactory {
	private nextId: number;

	constructor(startingId?: number) {
		if (typeof startingId !== "undefined") {
			console.log("Using suspended ID Factory");
			this.nextId = startingId;
		} else {
			this.nextId = 0;
		}
	}

	peekNext() {
		return this.nextId;
	}

	next() {
		return this.nextId++;
	}
}
