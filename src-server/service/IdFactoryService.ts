import * as fs from "fs";

import * as consts from "../consts";

import { IdFactory } from "../lib/IdFactory";
import { makeOnce } from "../lib/utils/makeOnce";

export const IdFactoryGetter = makeOnce(() => new IdFactory(restore()));

function restore(): number | undefined {
	let fileContent: string;

	try {
		fileContent = fs.readFileSync(consts.files.idFactory).toString();
		console.log("Reading suspended ID Factory");

	} catch (e) {
		if (e.message.includes("ENOENT")) return undefined;

		throw e;
	}

	return parseInt(fileContent);
}

export function store() {
	console.log("Storing id factory...");
	fs.writeFileSync(consts.files.idFactory, IdFactoryGetter.get().peekNext());
}
