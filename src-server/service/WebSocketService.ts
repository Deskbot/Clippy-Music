import * as debug from "../lib/debug";
import ws = require("ws");
import { WebSocketHandler } from "../lib/WebSocketHandler";

import { ContentServiceGetter } from "./ContentService";
import { ProgressQueueServiceGetter } from "./ProgressQueueService";
import { UserRecordGetter } from "./UserRecordService";

const ContentService = ContentServiceGetter.get();
const ProgressQueueService = ProgressQueueServiceGetter.get();
const UserRecordService = UserRecordGetter.get();

//really a namespace where all functions are hoisted
class Api {
	private wsh: WebSocketHandler;

	constructor() {
		const onConnect = (soc: ws, id: string) => {
			//save user
			UserRecordService.add(id);
			UserRecordService.setWS(id, soc);

			//notify if banned
			if (UserRecordService.isBanned(id)) this.sendBanned(soc);

			//tell user their nickname
			if (UserRecordService.isUser(id)) this.sendNickname(soc, UserRecordService.getNickname(id));

			//send queue
			this.sendQueue(soc);
			this.sendDlQueue(soc, id);
		};

		const onMessage = (soc: ws, id: string, data: any) => {
			const dataObj = JSON.parse(data);

			if (dataObj.type === "delete-content") {
				if (!ContentService.remove(dataObj.contentId)) {
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

		const onClose = (soc: ws, id: string) => {
			UserRecordService.unsetWS(id, soc);
		};

		this.wsh = new WebSocketHandler(
			onConnect,
			onMessage,
			onClose,
		);
	}

	//message related

	sendMessage(socs: ws[] | undefined, type: string, mes: any) {
		if (!socs) {
			debug.log("no socs given");
			debug.trace();
			return;
		}

		const message = JSON.stringify({
			type: type,
			success: true,
			message: mes,
		});

		this.wsh.sendToMany(socs, message);
	}

	sendNickname(soc: ws, nickname: string) {
		this.sendMessage([soc], "nickname", nickname);
	}

	sendNicknameToUser(userId: string, nickname: string) {
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
		const queue = ProgressQueueService.getQueue(userId);
		if (queue) WebSocketService.sendMessage([soc], "dl-list", queue);
	}

	broadcastMessage(type: string, mes: string) {
		const message = JSON.stringify({
			type: type,
			message: mes,
		});

		this.wsh.broadcast(message);
	}

	//queue related

	makeQueueMessage() {
		return {
			type: "queue",
			current: ContentService.getCurrentlyPlaying(),
			queue: ContentService.getBucketsForPublic(),
		};
	}

	sendQueue(socs: ws | ws[]) {
		if (!socs) {
			debug.log("no socs given");
			debug.trace();
			return;
		}

		const message = JSON.stringify(this.makeQueueMessage());

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
		this.wsh.broadcast(JSON.stringify(this.makeQueueMessage()));
	}
}

export const WebSocketService = new Api();

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

ProgressQueueService.on("prepared", (userId, content) => {
	WebSocketService.sendMessage(UserRecordService.getSockets(userId), "dl-prep", content);
});

ProgressQueueService.on("delete", (userId, contentId) => {
	const socs = UserRecordService.getSockets(userId);
	WebSocketService.sendMessage(socs, "dl-delete", contentId);
});

//extraInfo is an optional argument
ProgressQueueService.on("error", (userId, contentId, error, extraInfo) => {
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
