import * as fs from "fs";

import * as consts from "../lib/consts";
import * as opt from "../options";

import { IdFactoryGetter } from "./IdFactoryService";
import { ProgressQueueServiceGetter } from "./ProgressQueueService";
import { UserRecordGetter } from "./UserRecordService";
import { ContentManager, SuspendedContentManager, isSuspendedContentManager } from "../lib/ContentManager";
import { YtDlDownloader } from "../lib/YtDownloader";
import { MakeOnce } from "../lib/MakeOnce";

export const ContentServiceGetter = new (class extends MakeOnce<ContentManager> {
	protected make(): ContentManager {
		const recoveredContentManager = recover();

		if (recoveredContentManager != null && !isSuspendedContentManager(recoveredContentManager)) {
			throw new Error("The suspended content manager is not of a valid format. Consider restarting the program with the --clean option.");
		}

		const cm = new ContentManager(
			opt.timeout,
			recoveredContentManager,
			IdFactoryGetter.get(),
			ProgressQueueServiceGetter.get(),
			UserRecordGetter.get(),
			new YtDlDownloader(ProgressQueueServiceGetter.get())
		);

		cm.on("end", () => play(cm));

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

export function startPlayingContent() {
	play(ContentServiceGetter.get());
}

export function store() {
	console.log("Storing content manager...");
	const json =  ContentServiceGetter.get().toJSON();
	fs.writeFileSync(consts.files.content, json);
}
