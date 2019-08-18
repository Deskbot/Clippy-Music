import * as fs from 'fs';

import * as consts from './consts';

export class IdFactory {
	private nextId;

	constructor(startingId) {
		if (typeof startingId != 'undefined') {
			console.log('Using suspended ID Factory');
			this.nextId = startingId;
		} else {
			this.nextId = 0;
		}
	}

	//static

	static restore() {
		let fileContent;

		try {
			fileContent = fs.readFileSync(consts.files.idFactory);
			console.log('Reading suspended ID Factory');

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
