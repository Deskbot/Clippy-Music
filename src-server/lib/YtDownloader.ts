import * as cp from "child_process";
import * as q from "q";

import * as opt from "../options";
import * as utils from "./utils";

import { CancelError, UnknownDownloadError } from "./errors";
import { ContentType } from "../types/ContentType";
import { ProgressQueue } from "./ProgressQueue";

interface YtQueueItem {
	cancelled: boolean,
	cid: number,
	defer: q.Deferred<void>,
	destination: string,
	percent: number,
	proc?: cp.ChildProcess,
	title: string,
	userId: string,
	vid: string,
}

export class YtDownloader {
	private progressQueue: ProgressQueue;
	private userQueues: {
		[userId: string]: (YtQueueItem)[]
	};

	constructor(progressQueue: ProgressQueue) {
		this.progressQueue = progressQueue;
		this.userQueues = {};
	}

	private cancel(queue: YtQueueItem[], index: number) {
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

	download(vid: string, destination: string): [Promise<void>, cp.ChildProcess] {
		let proc = cp.spawn(opt.youtubeDlPath, ["--no-playlist", vid, "-o", destination]);

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
					return reject(new UnknownDownloadError(`A non-zero exit code (${code}) downloading a YouTube video.`, ContentType.Music));
				}
			});

			proc.on("error", (part) => {
				errMessage += part;
			});
		});

		return [ prom, proc ];
	}

	downloadNext(uid: string) {
		const queue = this.userQueues[uid];

		if (queue.length === 0) return;

		const head = queue[0]; //item at head of the queue
		const { cid, defer, destination, vid } = head;

		const [ dlProm, dlProc ] = this.download(vid, destination);
		dlProm.then(() => {
			defer.resolve();
		}, (e) => {
			if (head.cancelled) {
				defer.reject(new CancelError(vid));
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

		//deal with progress updating

		const percentReader = new PercentReader(dlProc);
		const updater = this.progressQueue.createUpdater(uid, cid);

		this.progressQueue.addAutoUpdate(uid, cid, () => {
			updater(percentReader.get());
		});
	}

	getQueue(uid: string): unknown[] {
		const queue = this.userQueues[uid];

		if (!queue) return [];

		return queue.map((item) => {
			return utils.cloneWithout(item, ["defer", "destination", "proc", "vid"]);
		});
	}

	new(cid: number, userId: string, title: string, vid: string, destination: string): q.Promise<void> {
		let queue = this.userQueues[userId];
		if (!queue) queue = this.userQueues[userId] = [];

		const defer = q.defer<void>();

		queue.push({
			cancelled: false,
			cid,
			defer,
			destination,
			percent: 0,
			title,
			userId,
			vid,
		});

		//if the queue was empty just now, need to initiate download sequence
		//otherwise the download queue is already being worked on
		if (queue.length === 1) this.downloadNext(userId);

		this.progressQueue.addCancelFunc(userId, cid, () => this.tryCancel(userId, cid));

		return defer.promise;
	}

	tryCancel(uid: string, cid: number): boolean {
		const queue = this.userQueues[uid];

		if (!queue) return false;

		for (let i = 0; i < queue.length; i++) {
			const item = queue[i];

			if (item.cid == cid) {
				this.cancel(queue, i);
				return true;
			}
		}

		return false;
	}
}

class PercentReader {
	private lastPercent: number;
	private phase: 1 | 2;
	private proc: cp.ChildProcess;

	constructor(dlProc: cp.ChildProcess) {
		this.lastPercent = 0;
		this.phase = 1;
		this.proc = dlProc;
	}

	get(): number {
		let data = this.proc.stdout.read();

		if (data === null) return this.lastPercent;

		let pc = PercentReader.extractPercent(data.toString());

		// console.log(data.toString());
		if (isNaN(pc)) return this.lastPercent;

		pc /= 100; //convert to fraction

		/* There are 2 phases of percentages from the download process
		 * 1: downloading, 2: zipping downloads into a single file
		 * During phase 2 the percent given by the process is added to the full phase 1 percent
		 */
		const zipFraction = 0.05;

		if (this.phase === 1) {
			if (pc < this.lastPercent) {
				this.phase = 2;
			} else {
				pc *= 1 - zipFraction;
			}
		}

		if (this.phase === 2) {
			pc = 1 - zipFraction + zipFraction * pc;
		}

		this.lastPercent = pc;

		return pc;
	}

	static extractPercent(s: string): number {
		const start = s.lastIndexOf("[download]") + 10; //[download] has length 10
		const end = s.lastIndexOf("%");
		const pcStr = s.substring(start, end).trim();

		return parseFloat(pcStr);
	}
}
