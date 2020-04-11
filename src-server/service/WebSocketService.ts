import ws = require("ws");

import * as debug from "../lib/utils/debug";
import * as opt from "../options";

import { WebSocketHandler } from "../lib/WebSocketHandler";
import { ContentServiceGetter } from "./ContentService";
import { ProgressQueueServiceGetter } from "./ProgressQueueService";
import { UserRecordGetter } from "./UserRecordService";
import { MakeOnce } from "../lib/utils/MakeOnce";
import { ContentManager } from "../lib/ContentManager";
import { UserRecord } from "../lib/UserRecord";

//really a namespace where all functions are hoisted
class WebSocketService {
	private readonly wsh: WebSocketHandler;

	private readonly contentService: ContentManager;
	private readonly userRecordService: UserRecord;

	constructor() {
		this.contentService = ContentServiceGetter.get();
		this.userRecordService = UserRecordGetter.get();

		this.wsh = new WebSocketHandler(
			this.onConnect.bind(this),
			this.onMessage.bind(this),
			this.onClose.bind(this),
		);
	}

	// handlers

	private onClose(soc: ws, id: string) {
		this.userRecordService.unsetWS(id, soc);
	};

	private onConnect(soc: ws, id: string) {
		//save user
		this.userRecordService.add(id);
		this.userRecordService.setWS(id, soc);

		//notify if banned
		if (this.userRecordService.isBanned(id)) {
			this.sendBanned(soc);
		}

		//tell user their nickname
		if (this.userRecordService.isUser(id)) {
			this.sendNickname(soc, this.userRecordService.getNickname(id));
		}

		//send queue
		this.sendQueue(soc);
		this.sendDlQueue(soc, id);
	};

	private onMessage(soc: ws, id: string, data: any) {
		const dataObj = JSON.parse(data);

		if (dataObj.type === "delete-content") {
			if (!this.contentService.remove(dataObj.contentId)) {
				soc.send(JSON.stringify({
					type: dataObj.type,
					success: false,
					reason: "The queue item you tried to remove was not chosen by you.",
				}));
			}

		} else {
			soc.send(JSON.stringify({
				type: dataObj.type,
				success: false,
				reason: "The server did not recognise the type of message you were trying to send.",
			}));
		}
	};

	//message related

	sendMessage(socs: ws[] | undefined, type: string, mes: any) {
		if (!socs) {
			debug.log("no socs given");
			debug.trace();
			return;
		}

		const message = JSON.stringify({
			type,
			success: true,
			message: mes,
		});

		this.wsh.sendToMany(socs, message);
	}

	sendNickname(soc: ws, nickname: string) {
		this.sendMessage([soc], "nickname", nickname);
	}

	sendNicknameToUser(userId: string, nickname: string) {
		const UserRecordService = UserRecordGetter.get();

		const socs = UserRecordService.getSockets(userId);
		for (let soc of socs) this.sendNickname(soc, nickname);
	}

	sendBanned(socs: ws | ws[]) {
		if (!socs) {
			debug.log("no socs given");
			debug.trace();
			return;
		}

		const message = JSON.stringify({
			type: "banned",
			success: true,
			banned: true,
		});

		this.wsh.sendToMany(socs, message);
	}

	sendDlQueue(soc: ws, userId: string) {
		const ProgressQueueService = ProgressQueueServiceGetter.get();

		const queue = ProgressQueueService.getQueue(userId);
		if (queue) {
			this.sendMessage([soc], "dl-list", queue);
		}
	}

	//queue related

	sendQueue(socs: ws | ws[]) {
		if (!socs) {
			debug.log("no socs given");
			debug.trace();
			return;
		}

		const message = JSON.stringify(makeQueueMessage());

		this.wsh.sendToMany(socs, message);
	}

	broadcastEmptyQueue() {
		this.wsh.broadcast(JSON.stringify({
			type: "queue",
			current: null,
			queue: [],
		}));
	}

	broadcastQueue() {
		this.wsh.broadcast(JSON.stringify(makeQueueMessage()));
	}
}

export const WebSocketServiceGetter = new (class extends MakeOnce<WebSocketService> {
	make() {
		return new WebSocketService();
	}
})();

function makeQueueMessage() {
	const ContentService = ContentServiceGetter.get();

	return {
		current: ContentService.getPublicCurrentlyPlaying(),
		maxBucketTime: opt.timeout,
		queue: ContentService.getBucketsForPublic(),
		type: "queue",
	};
}

export function startWebSocketService() {
	const ContentService = ContentServiceGetter.get();
	const ProgressQueueService = ProgressQueueServiceGetter.get();
	const UserRecordService = UserRecordGetter.get();
	const WebSocketService = WebSocketServiceGetter.get();

	let lastQueueWasEmpty = false;
	ContentService.on("queue-empty", () => {
		if (!lastQueueWasEmpty) {
			WebSocketService.broadcastEmptyQueue();
			lastQueueWasEmpty = true;
		}
	});

	ContentService.on("queue-update", () => {
		lastQueueWasEmpty = false;
		WebSocketService.broadcastQueue();
	});

	ProgressQueueService.on("prepared", (userId, title) => {
		WebSocketService.sendMessage(UserRecordService.getSockets(userId), "dl-prep", title);
	});

	ProgressQueueService.on("delete", (userId, contentId) => {
		const socs = UserRecordService.getSockets(userId);
		WebSocketService.sendMessage(socs, "dl-delete", contentId);
	});

	ProgressQueueService.on("error", (userId, contentId, error) => {
		const data = {
			contentId,
			error,
			errorMessage: error.message,
			errorType: error.constructor.name
		};

		WebSocketService.sendMessage(UserRecordService.getSockets(userId), "dl-error", data);
	});

	ProgressQueueService.on("list", (userId, list) => {
		WebSocketService.sendMessage(UserRecordService.getSockets(userId), "dl-list", list);
	});
}
