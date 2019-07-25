const cp = require('child_process');
const q = require('q');

const opt = require('../../options.js');
const utils = require('./utils.js');

const { CancelError, UnknownDownloadError } = require('./errors.js');

const ContentType = require('./ContentType.js');

class YtDownloader {
	constructor(progressQueue) {
		this.progressQueue = progressQueue;
		this.userQueues = {};
	}

	download(vid, destination) {
		let proc;

		const prom = new Promise((resolve, reject) => {
			proc = cp.spawn(opt.youtubeDlPath, ['--no-playlist', vid, '-o', destination]);
			let errMessage = '';

			proc.on('close', (code, signal) => {
				if (code === 0) {
					//youtube-dl adds an unknown file extension
					const mvProc = cp.spawn('mv', [destination + '.*', destination], {shell:true});
					mvProc.on('close', () => {
						return resolve();
					});
				} else {
					return reject(new UnknownDownloadError(`A non-zero exit code (${code}) downloading a YouTube video.`, ContentType.music));
				}
			});

			proc.on('error', (part) => {
				errMessage += part;
			});
		});

		return [ prom, proc ];
	}

	downloadNext(uid) {
		const queue = this.userQueues[uid];

		if (queue.length === 0) return;

		const head = queue[0]; //item at head of the queue
		const { cid, defer, destination, title, vid } = head;

		const [ dlProm, dlProc ] = this.download(vid, destination);
		dlProm.then(() => {
			defer.resolve();
		}, (e) => {
			if (head.cancelled) {
				defer.reject(new CancelError(ContentType.music));
			} else {
				defer.reject(e);
			}
		}).then(() => {
			// whether or not this download was successful
			queue.shift(); // remove this item from queue (defined as `head` above)
			this.downloadNext(uid);
		});

		dlProc.stdout.pause();

		queue[0].proc = dlProc; //save ref to proc

		//deal with progress updating

		const percentReader = new PercentReader(dlProc);
		const updater = this.progressQueue.createUpdater(uid, cid);

		this.progressQueue.addAutoUpdate(uid, cid, () => {
			updater(percentReader.get());
		});

		this.progressQueue.addCancelFunc(uid, cid, () => this.tryCancel(uid, cid));
	}

	getQueue(uid) {
		const queue = this.userQueues[uid];

		if (!queue) return [];

		return queue.map((item) => {
			return utils.cloneWithout(item, ['defer', 'destination', 'proc', 'vid']);
		});
	}

	new(cid, userId, title, vid, destination) {
		let queue = this.userQueues[userId];
		if (!queue) queue = this.userQueues[userId] = [];

		const defer = q.defer();

		queue.push({ cid, userId, title, vid, destination, defer, percent: 0 });

		//if the queue was empty just now, need to initiate download sequence
		//otherwise the download queue is already being worked on
		if (queue.length === 1) this.downloadNext(userId);

		return defer.promise;
	}

	tryCancel(uid, cid) {
		const queue = this.userQueues[uid];

		if (!queue) return false;

		for (let i = 0; i < queue.length; i++) {
			let item = queue[i];

			if (item.cid == cid) {
				YtDownloader.cancel(queue, i);
				return true;
			}
		}

		return false;
	}

	//static

	static cancel(queue, index) {
		const item = queue[index];

		if (item.proc) {
			item.cancelled = true;
			item.proc.kill(); // exit code 2 (SIGINT)
		} else {
			// head of the queue can be looked at
			// so don't remove it from the queue if the download is in progress
			queue.splice(index, 1);
		}
	}
}

class PercentReader {

	constructor(dlProc) {
		this.lastPercent = 0;
		this.phase = 1;
		this.proc = dlProc;
	}

	get() {
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

	static extractPercent(s) {
		const start = s.lastIndexOf('[download]') + 10; //[download] has length 10
		const end = s.lastIndexOf('%');
		const pcStr = s.substring(start, end).trim();

		return parseFloat(pcStr);
	}
}

module.exports = YtDownloader;