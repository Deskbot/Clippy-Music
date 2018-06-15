const q = require('q');
const cp = require('child_process');

const utils = require('./utils.js');

const { DownloadError } = require('./errors.js');

class YtDlManager {
	constructor() {
		this.userQueues = {};
		this.userIndexes = {};
	}

	download(vid, destination) {
		return new Promise((resolve, reject) => {
			const dlProc = cp.spawn('youtube-dl', ['--no-playlist', vid, '-o', destination]);
			let errMessage = '';

			dlProc.on('error', function(part) {
				errMessage += part;
			});
			dlProc.on('close', function(code, signal) {
				if (code === 0) {
					//youtube-dl adds an unknown file extension
					const mvProc = cp.spawn('mv', [destination + '.*', destination], {shell:true});
					mvProc.on('close', () => {
						resolve();	
					});
					
				} else {
					reject(new DownloadError(errMessage), 'music', true);
				}
			});
		});
	}

	downloadNext(uid) {
		const queue = this.userQueues[uid];

		if (queue.length === 0) {
			return;
		}

		const { vid, destination, defer } = queue[0]; //item at head of the queue

		const dlProm = this.download(vid, destination);
		dlProm.then(() => {
			queue.shift(); //remove head of queue
			this.downloadNext(uid);
			defer.resolve();

		}, () => {
			defer.reject();
		});
	}

	getQueue(uid) {
		const queue = this.userQueues[uid];

		if (!queue) return [];

		return queue.map((item) => {
			return utils.cloneWithout(item, ['defer', 'destination', 'vid']);
		});
	}

	new(uid, title, vid, destination) {
		let queue = this.userQueues[uid];
		if (!queue) queue = this.userQueues[uid] = [];

		if (!this.userIndexes[uid]) this.userIndexes[uid] = 0;
		let index = this.userIndexes[uid]++;

		const defer = q.defer();

		queue.push({ index, title, vid, destination, defer });

		//if the queue was empty just now, need to initiate download sequence
		//otherwise the download queue is already being worked on
		if (queue.length === 1) this.downloadNext(uid);

		return defer.promise;
	}
}

module.exports = YtDlManager