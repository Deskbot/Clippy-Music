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

	//static

	static restore(): number | undefined {
		let fileContent: string;

		try {
			fileContent = fs.readFileSync(consts.files.idFactory).toString();
			console.log("Reading suspended ID Factory");

		} catch (e) {
			if (e.message.includes("ENOENT")) return undefined;
			else throw e;
		}

		return parseInt(fileContent);
	}

	//object methods

	new() {
		return this.nextId++;
	}

	store() {
		console.log("Storing id factory...");
		fs.writeFileSync(consts.files.idFactory, this.nextId);
	}
}
