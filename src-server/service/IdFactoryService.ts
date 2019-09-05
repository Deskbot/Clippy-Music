import * as fs from "fs";

import * as consts from "../lib/consts";

import { IdFactory } from "../lib/IdFactory";
import { MakeOnce } from "../lib/MakeOnce";

export const IdFactoryServiceGetter = new (class extends MakeOnce<IdFactory> {
	make(): IdFactory {
		return new IdFactory(restore());
	}
})();

function restore(): number | undefined {
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
