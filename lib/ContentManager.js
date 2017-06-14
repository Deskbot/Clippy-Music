const co = require('co');
const cp = require('child_process');
const crc_32 = require('crc-32');
const request = require('request');
const fs = require('fs');
const q = require('q');

const opt = require('../options.js');
const utils = require('./utils.js');
const Queue = require('./Queue2000.js');

//paths
const dlQueueFilePath = opt.storageDir + '/dlQueue.json';
const playQueueFilePath = opt.storageDir + '/playQueue.json';
const logPath = opt.storageDir + '/log.txt'
const dlMusicPath = opt.storageDir + '/music/';
const dlPicsPath = opt.storageDir + '/pictures/';

class ContentManager {
	constructor() { console.log("contentmanger: constructor");
		//data stores
		this.contentData = new Map();
		this.dlQueue = [];
		this.playQueue = null;
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
		this.runningStartTime = null;

		//retreive suspended queue
		if (fs.exists(playQueueFilePath)) {

			try {
				const pqContent = fs.readFileSync(playQueueFilePath);
				pqObject = JSON.parse(pqContent);
				this.playQueue = new Queue(pqObject);

			} catch (e) {
				console.log('err1');
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

	start() { console.log("contentmanger: start");
		let that = this; //don't think I should need this
		const userRecord = require('../main.js').userRecord;

		//play items in the play queue
		co(function*() {
			while (true) {
				yield q.delay(1000); //hopefully if the dl queue is empty this will prevent a block in the event loop

				const contentData = this.playQueue.next();

				console.log('next play item', contentData);
				console.log('rest of the playqueue', this.playQueue);

				if (contentData === null) {
					continue;
				}

				const contentId = contentData.contentId;

				console.log('playing item from queue');

				//const contentData = this.contentData.get(contentId);

				//play content

				const defer = q.defer();
				
				const nickname = userRecord.getNickname(contentData.userId);
				const currentTime = new Date().toGMTString();
				
				if (typeof opt.timeout !== 'number') {
					console.error('PROBLEM. Duration for content is not a number. Potentially unsafe. Better safe than sorry.');
					console.error('Item in question: ');
					console.error(`${nickname} (${contentData.userId}), ${contentData.vidName} at ${currentTime} to last a max of ${opt.timeout}.`);
					process.exit(1);
				}

				const timeString = utils.secToMinStr(opt.timeout);

				this.currentlyRunningId = contentId;

				this.startMusic(contentData.musicPath, opt.timeout);
				this.runningMusicProc.on('close', function(code, signal) {
					this.stopPic();
					this.deleteContent(contentData);
					defer.resolve();
				}.bind(this));
				this.runningStartTime = Date.now();
				
				let picName;
				if (contentData.hasPic) {
					picName = contentData.picTitle;
					this.startPic(contentData.picPath, opt.timeout);
				} else {
					picName = 'no picture';
				}

				//public log uses publicly facing info
				console.log(`${nickname} played ${contentData.musicTitle} with ${picName} at ${currentTime}.`);

				//private log uses private facing info
				fs.appendFile(logPath, `${contentData.userId} played ${contentData.musicTitle} with ${picName} at ${currentTime}.`);

				//wait until runningMusicProc has terminated

				yield defer.promise.then(function() {
					let secs = Math.floor((Date.now() - this.runningStartTime) / 1000); //seconds ran for
					this.playQueue.updatePosteriority(contentData.userId, secs);
				}.bind(this));

				this.killCurrent();
			}
		}.bind(this));
		
		let hash; //memory efficiency

		//download items in the download queue
		co(function*() {
			while (true) {
				
				yield q.delay(1000); //hopefully if the dl queue is empty this will prevent a block in the event loop
				console.log('dlq1', this.dlQueue);
				const dlInfo = this.dlQueue.shift();
				if (!dlInfo) continue;
				console.log('adding item to queue');

				const itemData = utils.clone(dlInfo);

				const result = {
					musicDlProblem: false,
					picDlProblem: null,
					musicUniqueProblem: false,
					picUniqueProblem: null,
				};

				itemData.title = dlInfo.musicTitle;

				if (dlInfo.musicIsLocal) {
					itemData.musicPath = dlInfo.musicPath;

				} else {
					if (!dlInfo.musicIsLocal) {
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
						itemData.musicPath = nmp;

					} catch (e) {
						console.log('err3');
						result.musicDlProblem = true;
						dlInfo.deferred.reject(result); //send message to user
						continue;
					}
				}

				//validate by music hash
				hash = utils.fileHash(itemData.musicPath);
				if (this.hashIsUnique(hash)) {
					this.addHash(hash);
				} else {
					result.musicUniqueProblem = true;
					dlInfo.deferred.reject(result);
				}

				if (dlInfo.hasPic) {
					if (!dlInfo.picIsLocal) {
						itemData.picPath = itemData.picUrl; //it turns out eog accepts URLs
					}
				} else {
					itemData.picPath = null;
				}

				/*
				//download picture if one is specified
				if (dlInfo.hasPic) {
					if (dlInfo.picIsLocal) {
						itemData.picIsLocal = dlInfo.picIsLocal; //not sure this is needed, but I'm not using this section now so :/

					} else {
						try {
							let npp = this.nextPicPath();
							let picInfo = yield this.downloadPic(dlInfo.picUrl, npp);
							result.picDlProblem = false;
							itemData.picPath = npp;
							itemData.picName = picInfo.picName;
						}
						catch (e) {
							console.log('err4');
							itemData.hasPic = false;
							result.picDlProblem = '';
							dlInfo.deferred.reject(result); //send message to user
						}
					}

					hash = utils.fileHash(npp);
					if (this.hashIsUnique(hash)) {
						this.addHash(hash);
					} else {
						result.picUniqueProblem = true;
						dlInfo.deferred.reject(result);
					}

				} else {
					itemData.picPath = null;
				}
				*/

				itemData.contentId = this.nextContentId();

				console.log("Adding to queue:");
				console.log(itemData);

				this.contentData.set(++this.contentId, itemData);
				
				this.playQueue.add(itemData);

				dlInfo.deferred.resolve(result);

			}
		}.bind(this)
		).catch((err) => {
			console.log('err5');
			console.log(err);
			console.trace();
		});
	}

	add(info) { console.log("contentmanger: add");
		let that = this;
		return new Promise(function(resolve, reject) {
			if (!info.musicIsLocal) {
				that.downloadYtInfo(info.musicUrl).then(function(data) {
					info.musicTitle = data.musicTitle;
					resolve();

				}).catch(function() {
					console.log('err6');
					reject('Failed to retreive data about YouTube video requested.');
				});

			} else {

				resolve();
			}

		}).then(function() {
			console.log('dlq2');
			that.dlQueue.push(info);
		});
	}

	nextMusicPath() { console.log("contentmanger: nextMusicPath");
		return dlMusicPath + this.musicId++;
	}

	nextPicPath() { console.log("contentmanger: nextPicPath");
		return dlPicsPath + this.pictureId++;
	}

	nextContentId() { console.log("contentmanger: nextContentId");
		return this.contentId++;
	}

	startMusic(path, duration) { console.log("contentmanger: startMusic");
		console.log('timeout', [duration + 's', 'mpv', '-vo', 'xv', '-fs', '--softvol=no', '-quiet', '--af=drc=2:0.25', path]);
		this.runningMusicProc = cp.spawn('timeout', [duration + 's', 'mpv', '-vo', 'xv', '-fs', '-quiet', '--af=drc=2:0.25', path]); //settings match those by music.get
	}

	stopMusic() { console.log("contentmanger: stopMusic");
		if (this.runningMusicProc) this.runningMusicProc.kill();
	}

	startPic(path, duration) { console.log("contentmanger: startPic");
		console.log('timeout', [duration + 's', 'eog', path, '-f']);
		this.runningPicProc = cp.spawn('timeout', [duration + 's', 'eog', path, '-f']);
	}

	stopPic() { console.log("contentmanger: stopPic");
		if (this.runningPicProc) this.runningPicProc.kill();
	}

	killCurrent() { console.log("contentmanger: killCurrent");
		this.stopMusic();
		this.stopPic();
		
		const data = this.contentData[this.currentlyRunningId];

		if (!data) return;

		fs.unlink(data.musicPath);

		if (data.hasPic) {
			fs.unlink(data.picPath);
		}
	}

	addHash(hash) { console.log("contentmanger: addHash");
		this.hashes[hash] = true;
	}

	addYtId(id) { console.log("contentmanger: addYtId");
		this.ytIds[id] = true;
	}

	hashIsUnique(hash) { console.log("contentmanger: hashIsUnique");
		return !this.hashes[hash];
	}

	ytIdIsUnique(id) { console.log("contentmanger: ytIdIsUnique");
		return !this.ytIds[id];
	}

	downloadPic(url, destination) { console.log("contentmanger: downloadPic");
		return new Promise(function(resolve, reject) {
			request.head(url, function(err, res, body) {
				if (err) reject(err.message);

				if (res.headers['content-type'].split('/')[0] !== 'image') reject('A non-image was requested.');
				if (res.headers['content-length'] > opt.imageSizeLimit) reject('Image requested was too large (over ' + opt.imageSizeLimit + ' bytes).');

				let picName = url.split('/').pop();
				picName = picName.length <= 1 ? null : picName.split('.').shift();

				const picinfo = {
					name: picName,
				};

				const stream = request(url).pipe(fs.createWriteStream(destination));

				stream.on('close', () => {
					resolve(picinfo);
				});
				stream.on('error', () => {
					reject('Unknown error.');
				});
			});
		});
	}

	downloadYtInfo(url) { console.log("contentmanger: downloadYtInfo");
		return new Promise(function(resolve, reject) {
			let infoProc = cp.spawn('../bin/youtube-dl', ['--no-playlist', '--get-title', '--get-duration', url]);
			let rawData;

			infoProc.stdout.on('data', function(chunk) {
				console.log(typeof chunk);
				rawData += chunk;
			});
			infoProc.on('close', function(code, signal) {
				if (code === 0) {
					let dataArr = rawData.split('\n');
					resolve({
						musicTitle: dataArr[0],
						duration: utils.ytTimeStrToSec(dataArr[1]),
					});
				} else {
					reject();
				}
			});
		});
	}

	downloadYtVid(url, destination) { console.log("contentmanger: downloadYtVid");
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

	getQueue() { console.log("contentmanger: getQueue");
		return this.playQueue.queue;
	}

	numOfItemsQueuedBy(userId) { console.log("contentmanger: numOfItemsQueuedBy");
		let i, count = 0;
		console.log('dlq3');
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

	store() { console.log("contentmanger: store");
		console.log('dlq4');
		fs.writeFile(playQueueFilePath, this.playQueue.toJson());
		fs.writeFile(dlQueueFilePath, JSON.stringify(this.dlQueue));
	}

	deleteContent(contentObj) {
		if (contentObj.musicIsLocal) utils.deleteFile(contentObj.musicPath);
		if (contentObj.picIsLocal) utils.deleteFile(contentObj.picPath);
	}
}

function storageLocation(contentId, isMusic) {
	return opt.storageDir + '/' + isMusic ? 'music' : 'pictures' + '/' + contentId;
}

module.exports = ContentManager;
