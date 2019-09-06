import * as fs from "fs";

import * as consts from "../lib/consts";

import { IdFactoryServiceGetter } from "./IdFactoryService";
import { ProgressQueueServiceGetter } from "./ProgressQueueService";
import { UserRecordServiceGetter } from "./UserRecordService";
import { ContentManager, SuspendedContentManager } from "../lib/ContentManager";
import { YtDownloader } from "../lib/YtDownloader";
import { MakeOnce } from "../lib/MakeOnce";

export const ContentServiceGetter = new (class extends MakeOnce<ContentManager> {

	protected make(): ContentManager {
		const cm = new ContentManager(
			recover(),
			IdFactoryServiceGetter.get(),
			ProgressQueueServiceGetter.get(),
			UserRecordServiceGetter.get(),
			new YtDownloader(ProgressQueueServiceGetter.get())
		);

		cm.on("end", () => play(cm));

		play(cm);

		return cm;
	}

})();

function play(cm: ContentManager) {
	const isNext = cm.playNext();

	if (!isNext) {
		setTimeout(() => play(cm), 1000);
	}
}

// retreive suspended ContentManger
function recover(): SuspendedContentManager | null {
	let obj;
	let pqContent: Buffer;
	let success = true;

	try {
		pqContent = fs.readFileSync(consts.files.content);

	} catch (e) {
		console.log("No suspended content manager found. This is ok.");
		return null;
	}

	console.log("Reading suspended content manager");

	try {
		success = true;
		obj = JSON.parse(pqContent.toString());

	} catch (e) {
		success = false;
		if (e instanceof SyntaxError) {
			console.error("Syntax error in suspendedContentManager.json file.");
			console.error(e);
			console.log("Ignoring suspended content manager");
		} else {
			throw e;
		}
	}

	return success ? obj : null;
}
