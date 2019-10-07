import * as fs from "fs";

import * as consts from "../consts";

import { UserRecord } from "../lib/UserRecord";
import { MakeOnce } from "../lib/utils/MakeOnce";

export const UserRecordGetter = new (class extends MakeOnce<UserRecord> {
	protected make(): UserRecord {
		return new UserRecord(recover());
	}
})();

function recover() {
	//retreive suspended queue
	let obj, recordContent;
	let success = true;

	try {
		recordContent = fs.readFileSync(consts.files.users).toString();

	} catch (e) {
		console.log("No suspended user record found. This is ok.");
		return null
	}

	console.log("Reading suspended user record");

	try {
		success = true && success;
		obj = JSON.parse(recordContent);

	} catch (e) {
		success = false;
		if (e instanceof SyntaxError) {
			console.error("Syntax error in suspendedUserRecord.json file.");
			console.error(e);
			console.error("Ignoring suspended content manager");
		} else {
			throw e;
		}
	}

	return success ? obj : null;
}

export function store() {
	console.log("Storing user record...");
	fs.writeFileSync(consts.files.users, UserRecordGetter.get().toJSON());
}
