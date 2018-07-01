const cp = require('child_process');
const EventEmitter = require('events');
const q = require('q');

const opt = require('../options.js');
const utils = require('./utils.js');

const { CancelError, DownloadError } = require('./errors.js');

class YtDlManager extends EventEmitter {
	constructor() {
		super();
		this.userQueues = {};
		this.userIndexes = {};
	}

	cancel(queue, index) {
		const item = queue[index];

		if (item.proc) {
			item.cancelled = true;
			item.proc.kill();
		}

		queue.splice(index, 1);
	}

	download(vid, destination) {
		let prom, proc;
		
		prom = new Promise((resolve, reject) => {
			proc = cp.spawn(opt.youtubeDlPath, ['--no-playlist', vid, '-o', destination]);
			let errMessage = '';

			proc.on('error', (part) => {
				errMessage += part;
			});
			proc.on('close', (code, signal) => {
				if (code === 0) {
					//youtube-dl adds an unknown file extension
					const mvProc = cp.spawn('mv', [destination + '.*', destination], {shell:true});
					mvProc.on('close', () => {
						resolve();	
					});
				} else {
					reject();
				}
			});
		});

		return [ prom, proc ];
	}

	downloadNext(uid) {
		const queue = this.userQueues[uid];

		if (queue.length === 0) {
			return;
		}

		const head = queue[0]; //item at head of the queue
		const { defer, destination, index, vid } = head;

		const [ dlProm, dlProc ] = this.download(vid, destination);
		dlProm.then(() => {
			queue.shift(); //remove head of queue
			this.downloadNext(uid);
			defer.resolve();

		}, (e) => {
			if (head.cancelled) {
				defer.reject(new CancelError('Download was cancelled.'));
			} else {
				defer.reject(new DownloadError(errMessage, 'music'));
			}
		});

		//extract percent completion at frequency
		let phase = 1;
		dlProc.stdout.pause();
		const dlPcInterval = setInterval(() => {
			let data = dlProc.stdout.read();
			
			if (data === null) return;
			
			let pc = YtDlManager.extractPercent(data.toString());

			if (isNaN(pc)) return;

			pc /= 100; //convert to fraction

			/* There are 2 phases of percentages from the download process
			 * 1: downloading, 2: zipping downloads into a single file
			 * During phase 2 the percent given by the process is added to the full phase 1 percent
			 */
			const zipFraction = 0.05;

			if (phase === 1) {
				if (pc < head.percent) {
					phase = 2;
				} else {
					pc *= 1 - zipFraction;
				}
			}

			if (phase === 2) {
				pc = 1 - zipFraction + zipFraction * pc;
			}

			head.percent = pc;
			this.emit('dl-percent-update', uid, index, pc);
			
		}, opt.dlPercentUpdateFreq);

		//stop updating the percentage when the 
		dlProc.on('exit', () => {
			clearInterval(dlPcInterval);
		});

		queue[0].proc = dlProc; //save ref to proc
	}

	getQueue(uid) {
		const queue = this.userQueues[uid];

		if (!queue) return [];

		return queue.map((item) => {
			return utils.cloneWithout(item, ['defer', 'destination', 'proc', 'vid']);
		});
	}

	new(uid, title, vid, destination) {
		let queue = this.userQueues[uid];
		if (!queue) queue = this.userQueues[uid] = [];

		if (!this.userIndexes[uid]) this.userIndexes[uid] = 0;
		let index = this.userIndexes[uid]++;

		const defer = q.defer();

		queue.push({ index, title, vid, destination, defer, percent: 0 });

		//if the queue was empty just now, need to initiate download sequence
		//otherwise the download queue is already being worked on
		if (queue.length === 1) this.downloadNext(uid);

		return defer.promise;
	}

	tryCancel(uid, dlid) {

		const queue = this.userQueues[uid];

		if (!queue) return false;

		//index num required for this.cancel()
		for (let i = 0; i < queue.length; i++) {
			let item = queue[i];

			if (item.index == dlid) {
				this.cancel(queue, i);
				return true;
			}
		}

		return false;
	}

	//static

	static extractPercent(s) {
		const start = s.lastIndexOf('[download]') + 10; //[download] has length 10
		const end = s.lastIndexOf('%');
		const pcStr = s.substring(start, end).trim();

		return parseFloat(pcStr);
	}
}

module.exports = YtDlManager