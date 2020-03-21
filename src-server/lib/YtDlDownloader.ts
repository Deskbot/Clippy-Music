import * as cp from "child_process";
import * as q from "q";

import * as opt from "../options";

import { CancelError, UnknownDownloadError } from "./errors";
import { ContentPart } from "../types/ContentPart";
import { EventEmitter } from "events";

interface YtDlQueueItem {
	cancelled: boolean,
	cid: number,
	defer: q.Deferred<void>,
	destination: string,
	percent: number,
	proc?: cp.ChildProcess,
	userId: string,
	target: string,
}

export class YtDlDownloader extends EventEmitter {
	private userQueues: {
		[userId: string]: YtDlQueueItem[]
	};

	public emit(eventName: "new", uid: string, cid: number): boolean;
	public emit(eventName: "started", uid: string, cid: number, getUpdate: () => number): boolean;
	public emit(eventName: string, ...args: any[]): boolean {
		return super.emit(eventName, ...args);
	}

	public on(eventName: "new", handler: (uid: string, cid: number) => void): this;
	public on(eventName: "started", handler: (uid: string, cid: number, getUpdate: () => number) => void): this;
	public on(eventName: string, handler: (...args: any[]) => void): this {
		return super.on(eventName, handler);
	}

	constructor() {
		super();
		this.userQueues = {};
	}

	private cancel(queue: YtDlQueueItem[], index: number) {
		const item = queue[index];

		// head of the queue can be looked at
		// so don't remove it from the queue if the download is in progress
		if (item.proc) {
			item.cancelled = true;
			item.proc.kill(); // exit code 2 (SIGINT)
		} else {
			queue.splice(index, 1);
		}
	}

	private download(target: string, destination: string): [Promise<void>, cp.ChildProcessWithoutNullStreams] {
		let proc = cp.spawn(opt.youtubeDlCommand, ["--no-playlist", target, "-o", destination]);

		const prom = new Promise<void>((resolve, reject) => {
			let errMessage = "";

			proc.on("close", (code, signal) => {
				if (code === 0) {
					//youtube-dl adds an unknown file extension
					const mvProc = cp.spawn("mv", [destination + ".*", destination], {shell:true});
					mvProc.on("close", () => {
						return resolve();
					});
				} else {
					console.error(errMessage);
					console.trace();
					return reject(new UnknownDownloadError(`A non-zero exit code (${code}) downloading a YouTube video.`, ContentPart.Music));
				}
			});

			proc.stderr.on("data", (part) => {
				errMessage += part;
			});
		});

		return [ prom, proc ];
	}

	private downloadNext(uid: string) {
		const queue = this.userQueues[uid];

		if (queue.length === 0) return;

		const head = queue[0]; //item at head of the queue
		const { cid, defer, destination, target } = head;

		const [ dlProm, dlProc ] = this.download(target, destination);
		dlProm.then(() => {
			defer.resolve();
		}, (e) => {
			if (head.cancelled) {
				defer.reject(new CancelError(target));
			} else {
				defer.reject(e);
			}
		}).then(() => {
			// whether or not this download was successful
			queue.shift(); // remove this item from queue (defined as `head` above)
			this.downloadNext(uid);
		});

		dlProc.stdout.pause();

		head.proc = dlProc; //save ref to proc

		// allow the outside world to get percentage updates
		const percentReader = new PercentReader(dlProc);
		this.emit("started", uid, cid, () => percentReader.get());
	}

	new(cid: number, userId: string, target: string, destination: string): q.Promise<void> {
		let queue = this.userQueues[userId];
		if (!queue) {
			queue = this.userQueues[userId] = [];
		}

		const defer = q.defer<void>();

		queue.push({
			cancelled: false,
			cid,
			defer,
			destination,
			percent: 0,
			userId,
			target,
		});

		//if the queue was empty just now, need to initiate download sequence
		//otherwise the download queue is already being worked on
		if (queue.length === 1) {
			this.downloadNext(userId);
		}

		return defer.promise;
	}

	tryCancel(uid: string, cid: number): boolean {
		const queue = this.userQueues[uid];

		if (!queue) return false;

		let atLeatOneCancelled = false;

		for (let i = 0; i < queue.length; i++) {
			const item = queue[i];

			if (item.cid == cid) {
				this.cancel(queue, i);
				atLeatOneCancelled = true;
			}
		}

		return atLeatOneCancelled;
	}
}

class PercentReader {
	private lastPercent: number;
	/**
	 * targets with a video and music component will have 2 sequential downloads each with their own percentage
	 */
	private phase: 1 | 2;
	private proc: cp.ChildProcessWithoutNullStreams;

	private static phaseSize = 0.5;

	constructor(dlProc: cp.ChildProcessWithoutNullStreams) {
		this.lastPercent = 0;
		this.phase = 1;
		this.proc = dlProc;
	}

	get(): number {
		const data = this.proc.stdout.read();

		if (data === null) return this.lastPercent;

		let pc = PercentReader.extractPercent(data.toString());

		if (isNaN(pc)) return this.lastPercent;

		pc /= 100; //convert to fraction

		if (this.phase === 1) {
			if (pc < this.lastPercent) {
				this.phase = 2;
			} else {
				pc *= 1 - PercentReader.phaseSize;
			}
		}

		if (this.phase === 2) {
			pc = 1 - PercentReader.phaseSize + pc * PercentReader.phaseSize;
		}

		this.lastPercent = pc;

		return pc;
	}

	private static extractPercent(s: string): number {
		const start = s.lastIndexOf("[download]") + 10; //[download] has length 10
		const end = s.lastIndexOf("%");
		const pcStr = s.substring(start, end).trim();

		return parseFloat(pcStr);
	}
}
