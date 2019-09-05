import * as fs from "fs";

import * as consts from "./consts";

export class IdFactory {
	private nextId: number;

	constructor(startingId?: number) {
		if (typeof startingId != "undefined") {
			console.log("Using suspended ID Factory");
			this.nextId = startingId;
		} else {
			this.nextId = 0;
		}
	}

	new() {
		return this.nextId++;
	}

	store() {
		console.log("Storing id factory...");
		fs.writeFileSync(consts.files.idFactory, this.nextId);
	}
}
