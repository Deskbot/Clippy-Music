const co = require('co');
const cp = require('child_process');
const crc_32 = requie('crc-32');
const request = require('request');
const fs = require('fs');
const q = require('q');

const opt = require('../options.js');
const utils = require('./utils.js');
const Queue = require('./Queue2000.js');

const playQueueFilePath = opt.storageDir + '/playQueue.json';
const logPath = opt.storageDir + '/log.txt'
const dlMusicPath = opt.storageDir + '/music/';
const dlPicsPath = opt.storageDir + '/pictures/';

class ContentManager2000 {
	constructor() {
		//data stores
		this.contentData = new Map();
		this.dlQueue = [];
		this.hashes = {};
		this.ytIds = {};

		//unique Ids
		this.contentId = 0;
		this.musicId = 0;
		this.pictureId = 0;

		//processes
		this.runningMusicProc = null;
		this.runningPicProc = null;

		this.currentlyRunningId = null;

		//retreive suspended queue
		if (fs.exists(playQueueFilePath)) {

			try {
				const pqContent = fs.readFileSync(playQueueFilePath);
				pqObject = JSON.parse(pqContent);
				this.playQueue = new Queue(pqObject);

			} catch (e) {
				if (e instanceof SyntaxError) {
					console.err.log('Syntax error in playQueue.json file.');
					console.err.log(e.message);
					this.playQueue = new Queue();
				} else {
					throw e;
				}
			}

		} else {
			console.log('No suspended play queue found. This is ok.');
			this.playQueue = new Queue();
		}
	}

	start() {
		//play items in the play queue
		co(function*() {
			while (true) {
				yield; //hopefully if the dl queue is empty this will prevent a block in the event loop

				const contentId = this.playQueue.next();
				const contentData = this.data.get(contentId);

				//play content

				const defer = q.defer();
				
				const duration = contentData.duration > opt.timeout ? opt.timeout : contentData.duration;
				if (typeof duration !== 'number') {
					console.err('PROBLEM. Duration for content is not a number. Potentially unsafe. Better safe than sorry.');
					console.err('Item in question: ');
					console.err(`${contentData.nickname} (${contentData.userId}), ${contentData.vidName} at ${currentTime} to last ${duration}.`);
					process.exit(1);
				}

				const currentTime = new Date().toGMTString();
				const timeString = utils.secToMinStr(duration);

				this.currentlyRunningId = contentId;

				this.startMusic(contentData.vidPath, duration);
				this.runningMusicProc.on('close', function(code, signal) {
					defer.resolve();
				});
				
				let picName;
				if (contentData.hasPic) {
					picName = contentData.picTitle;
					this.startPic(contentData.picPath);
				} else {
					picName = 'no picture';
				}

				//public log uses publicly facing info
				console.log(`${contentData.nickname} played ${contentData.vidName} with ${picName} at ${currentTime} to last ${timeString}.`);

				//private log uses private facing info
				fs.appendFile(logPath, `${contentData.userId} played ${contentData.vidName} with ${picName} at ${currentTime} to last ${timeString}.`);

				//wait until runningMusicProc has terminated

				yield defer.promise;

				this.killCurrent();
			}
		});
		
		let hash; //memory efficiency

		//download items in the download queue
		co(function*() {
			while (true) {
				yield; //hopefully if the dl queue is empty this will prevent a block in the event loop

				const dlInfo = this.dlQueue.shift();
				const itemData = utils.clone(dlInfo);

				const result = {
					musicDlProblem: false,
					picDlProblem: null,
					musicUniqueProblem: false,
					picUniqueProblem: null,
				};

				itemData.title = dlInfo.title;
				itemData.duration = dlInfo.duration;

				if (dlInfo.musicIsLocal) {
					itemData.musicPath = dlInfo.musicPath;

				} else {
					if ( !dlInfo.musicIsLocal ) {
						let ytId = utils.extractYtVideoId(dlInfo.musicUrl);

						if (this.ytIdIsUnique(ytId)) {
							result.musicUniqueProblem = true;
							dlInfo.deferred.reject(result); //send message to user
							continue;

						} else {
							this.addYtId(ytId);
						}
					}

					let nmp = this.nextMusicPath();

					try {
						yield this.downloadYtVid(dlInfo.musicUrl, nmp);

					} catch (e) {
						result.musicDlProblem = true;
						dlInfo.deferred.reject(result); //send message to user
						continue;
					}
				}

				//validate by music hash
				hash = utils.fileHash(nmp);
				if (this.hashIsUnique(hash)) {
					this.addHash(hash);
				} else {
					result.musicUniqueProblem = true;
					dlInfo.deferred.reject(result);
				}

				//download picture if one is specified
				if (dlInfo.hasPic) {
					if (dlInfo.picIsLocal) {
						itemData.picIsLocal = dlInfo.picIsLocal;

					} else {
						try {
							let npp = this.nextPicPath();
							let picInfo = yield this.downloadPic(dlInfo.picUrl, npp);
							result.picDlProblem = false;
							itemData.picPath = npp;
							itemData.picName = picInfo.picName;
						}
						catch (e) {
							itemData.hasPic = false;
							result.picDlProblem = '';
							dlInfo.deferred.reject(result); //send message to user
						}
					}

					hash = utils.fileHash(npp);
					if (this.hashIsUnique(hash) {
						this.addHash(hash);
					} else {
						result.picUniqueProblem = true;
						dlInfo.deferred.reject(result);
					}

				} else {
					itemData.picPath = null;
				}

				itemData.contentId = this.nextContentId();

				console.log("Adding to queue:");
				console.log(itemData);

				this.playQueue.add(itemData);

				dlInfo.deferred.resolve(result);

			}
		});
	}

	add(info) {
		return new Promise(function(resolve, reject) {
			if (!info.musicIsLocal) {
				this.downloadYtInfo(info.musicUrl).then(function(data) {
					info.duration = data.duration;
					info.musicTitle = data.musicTitle;
					resolve();

				}).catch(function() {
					reject('Failed to retreive data about YouTube video requested.');
				});

			} else {
				resolve();
			}

		}).then(function() {
			this.dlQueue.push(info);
		});
	}

	nextMusicPath() {
		return dlMusicPath + this.musicId++;
	}

	nextPicPath() {
		return dlPicsPath + this.pictureId++;
	}

	nextContentId() {
		return this.contentId++;
	}

	startMusic(path, duration) {
		this.runningMusicProc = cp.spawn('timeout', [duration + 's', 'mpv', '-vo', 'xv', '-fs', '-quiet', '--af=drc=2:0.25', path]); //settings match those by music.get
	}

	stopMusic() {
		this.runningMusicProc.kill();
	}

	startPic() {
		this.runningPicProc = cp.spawn('eog', [path, '-f']);
	}

	stopPic() {
		this.runningPicProc.kill();
	}

	killCurrent() {
		this.stopMusic();
		this.stopPic();
		
		const data = this.contentDataMap.get(this.currentlyRunningId)
		fs.unlink(data.musicPath);

		if (data.hasPic) {
			fs.unlink(data.picPath);
		}
	}

	addHash(hash) {
		this.hashes[hash] = true;
	}

	addYtId(id) {
		this.ytIds[id] = true;
	}

	hashIsUnique(hash) {
		return !this.hashes[hash];
	}

	ytIdIsUnique(id) {
		return !this.ytIds[id];
	}

	itemChosenByUser (queueidm, userid)
		boolean

	remove item (vidId)
		not sure how

	downloadPic url
		//using http(s) request or curl with an event for on done

	downloadYtInfo(url) {
		return new Promise(function(resolve, reject) {
			let infoProc = cp.spawn('../bin/youtube-dl', ['--no-playlist', '--get-title', '--get-duration', url]);
			infoProc.on('close', function(code, signal) {
				if (code === 0) {
					resolve();
				} else {
					reject();
				}
			});
		});
	}

	downloadYtVid(url, destination) {
		return new Promise(function(resolve, reject) {
			const dlProc = cp.spawn('../bin/youtube-dl', ['--no-playlist', url, '-o', destination]); //
			dlProc.on('close', function(code, signal) {
				if (code === 0) {
					resolve();
				} else {
					reject();
				}
			});
		});
	}

	getQueue() {
		return this.playQueue.queue;
	}

	numOfItemsQueuedBy(userId) {
		let i, count = 0;
		for (i = 0; i < this.dlQueue.length; i++) {
			if (this.dlQueue[i].userId === userId) {
				count++;
				if (count === opt.maxQueuedAtOnce) return count;
			}
		}

		for (i of this.playQueue) {
			if (i === userId) {
				count++;
				if (count === opt.maxQueuedAtOnce) return count;
			}
		}

		return count;
	}
}

function storageLocation(contentId, isMusic) {
	return opt.storageDir + '/' + isMusic ? 'music' : 'pictures' + '/' + contentId;
}

module.exports = ContentManager2000;
