const co = require('co');
const cp = require('child_process');
const crc_32 = require('crc-32');
const Html5Entities = require('html-entities').Html5Entities;
const request = require('request');
const fs = require('fs');
const q = require('q');

const opt = require('../options.js');
const utils = require('./utils.js');
const ClippyQueue = require('./ClippyQueue.js');

//paths
const contentFilePath = opt.storageDir + '/suspendedContentManager.json';
const logFilePath = opt.storageDir + '/log.txt'
const dlMusicPath = opt.storageDir + '/music/';
const dlPicsPath = opt.storageDir + '/pictures/';

class ContentManager {
	constructor(startState) { console.log("contentmanger: constructor");
		//data stores
		this.dlQueue = [];
		this.playQueue = null;
		this.hashes = {};
		this.picHashes = {};
		this.ytIds = {};

		//unique Ids
		this.musicId = 0;
		this.pictureId = 0;
		this.contentId = 0;

		//processes
		this.runningMusicProc = null;
		this.runningPicProc = null;
		this.currentlyPlaying = null;
		this.runningStartTime = null;
		this.playingPromise = null;

		if (startState) {
			console.log('Using suspended content manager');

			this.dlQueue = startState.dlQueue;
			this.playQueue = new ClippyQueue(startState.playQueue);
			this.hashes = startState.hashes;
			this.picHashes = startState.picHashes;
			this.ytIds = startState.ytIds;
			this.musicId = startState.musicId;
			this.pictureId = startState.pictureId;
			this.contentId = startState.contentId;
		} else {
			this.playQueue = new ClippyQueue();
		}
	}

	static recover() {
		//retreive suspended queue
		let obj, pqContent;
		let success = true;

		//I'm trying some weird control flow because I don't like try catch. Usually there's only 1 line you want to try and you don't want to assume something has been caught for the wrong reasons.
		try {
			success = true && success;
			pqContent = fs.readFileSync(contentFilePath);
			
		} catch (e) {
			success = false && success;
			console.log('No suspended content manager found. This is ok.');
		}

		if (success) {
			console.log('Reading suspended content manager');

			try {
				success = true && success;
				obj = JSON.parse(pqContent);
				
			} catch (e) {
				success = false && success;
				if (e instanceof SyntaxError) {
					console.error('Syntax error in suspendedContentManager.json file.');
					console.error(e);
					console.error('Ignoring suspended content manager');
				} else {
					throw e;
				}
			}
		}

		return success ? obj : null;
	}

	static get suspendedFilePath() {
		return contentFilePath;
	}

	static get logFilePath() {
		return logFilePath;
	}

	start() { console.log("contentmanger: start");
		let that = this; //don't think I should need this

		const main = require('../main.js');
		const userRecord = main.userRecord;

		//play items in the play queue
		co(function*() {
			while (true) {
				yield q.delay(1000); //hopefully if the dl queue is empty this will prevent a block in the event loop

				const contentData = this.playQueue.next();

				if (contentData === null) {
					continue;
				}

				//play content

				const defer = q.defer();
				this.playingPromise = defer.promise;
				
				const nickname = userRecord.getNickname(contentData.userId);
				const currentTime = new Date().toGMTString();
				
				if (typeof opt.timeout !== 'number') {
					console.error('PROBLEM. Duration for content is not a number. Potentially unsafe. Better safe than sorry.');
					console.error('Item in question: ');
					console.error(`${nickname} (${contentData.userId}), ${contentData.vidName} at ${currentTime} to last a max of ${opt.timeout}.`);
					process.exit(1);
				}

				const timeString = utils.secToMinStr(opt.timeout);

				this.currentlyPlaying = contentData;

				const path = contentData.musicIsLocal ? contentData.musicPath : contentData.musicUrl;

				let musicProc = this.startMusic(path, opt.timeout, contentData.startTime, contentData.endTime);
				musicProc.on('close', function(code, signal) {
					this.deleteContent(contentData);
					defer.resolve();
				}.bind(this));
				this.runningStartTime = Date.now();
				
				let picName;
				if (contentData.hasPic) {
					picName = Html5Entities.decode(contentData.picTitle);
					this.startPic(contentData.picPath, opt.timeout);
				} else {
					picName = 'no picture';
				}

				let nonEntityTile = Html5Entities.decode(contentData.musicTitle);

				//public log uses publicly facing info
				console.log(`${nickname} played ${nonEntityTile} with ${picName} at (${currentTime}).`);

				//private log uses private facing info

				fs.appendFile(logFilePath, `UserId: ${contentData.userId} played ${nonEntityTile} with ${picName} at ${currentTime}.\n`);

				//update queue for users
				main.wsServer.broadcastQueue();

				//wait until runningMusicProc has terminated

				yield defer.promise.then(() => {
					let secs = Math.floor((Date.now() - this.runningStartTime) / 1000); //seconds ran for
					this.playQueue.updatePosteriority(contentData.userId, secs);

				}).catch((err) => {
					console.error('Unknown Problem: ', err);
				});

				this.currentlyPlaying = null;
			}
		}.bind(this))
		.catch((err) => {
			console.error(err);
		});
		
		let hash; //memory efficiency

		//download items in the download queue
		co(function*() {
			while (true) {
				
				yield q.delay(1000); //hopefully if the dl queue is empty this will prevent a block in the event loop
				
				const dlInfo = this.dlQueue.shift();
				if (!dlInfo) continue;

				const itemData = utils.clone(dlInfo);

				itemData.contentId = this.contentId++;

				const result = {
					musicDlProblem: false,
					picDlProblem: null,
					musicUniqueProblem: false,
					picUniqueProblem: null,
				};

				itemData.title = dlInfo.musicTitle;

				if (dlInfo.musicIsLocal) {
					itemData.musicPath = dlInfo.musicPath;

					//validate by music hash
					hash = utils.fileHash(itemData.musicPath).toString();
					if (this.hashIsUnique(hash)) {
						itemData.musicHash = hash;
						this.addHash(hash);
					} else {
						result.musicUniqueProblem = true;
						dlInfo.deferred.reject(result);
						continue;
					}

				} else {
					let ytId = utils.extractYtVideoId(dlInfo.musicUrl);
					itemData.ytId = ytId;

					if (!this.ytIdIsUnique(itemData.ytId)) {
						result.musicUniqueProblem = true;
						dlInfo.deferred.reject(result); //send message to user
						continue;

					} else {
						this.addYtId(itemData.ytId);
					}
				}

				if (dlInfo.hasPic) {
					if (dlInfo.picIsLocal) {
						itemData.picIsLocal = dlInfo.picIsLocal; //not sure this is needed

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
							result.picDlProblem = e.message;
							dlInfo.deferred.reject(result); //send message to user
							continue;
						}
					}

					hash = utils.fileHash(itemData.picPath);
					if (this.picHashIsUnique(hash)) {
						this.addPicHash(hash);
						itemData.picHash = hash;
					} else {
						result.picUniqueProblem = true;
						dlInfo.deferred.reject(result);
						continue;
					}
				} else {
					itemData.picPath = null;
				}
				
				this.playQueue.add(itemData);

				dlInfo.deferred.resolve(result);

			}
		}.bind(this)
		).catch((err) => {
			console.error(err);
		});
	}

	add(info) { console.log("contentmanger: add");
		let that = this;
		return new Promise(function(resolve, reject) {
			if (!info.musicIsLocal) {
				info.ytId = utils.extractYtVideoId(info.musicUrl);
				that.downloadYtInfo(info.musicUrl).then(function(data) {
					info.musicTitle = data.musicTitle;
					info.duration = data.duration;

					resolve();

				}).catch(function() {
					reject('Failed to retreive data about YouTube video requested: ' + JSON.stringify(info));
				});

			} else {
				resolve();
			}

		}).then(() => {
			that.dlQueue.push(info);
		}).catch((err) => {
			console.error('Unknown problem: ', err);
		});
	}

	remove(userId, contentId) {
		const obj = this.playQueue.getContent(userId, contentId);

		if (obj) {
			this.deleteContent(obj);
			this.playQueue.remove(userId, obj);
			
			delete this.hashes[obj.musicHash];
			delete this.picHashes[obj.picHash];
		}

		return obj ? true : false;
	}

	nextMusicPath() { console.log("contentmanger: nextMusicPath");
		return dlMusicPath + this.musicId++;
	}

	nextPicPath() { console.log("contentmanger: nextPicPath");
		return dlPicsPath + this.pictureId++;
	}

	startMusic(path, duration, startTime, endTime) { console.log("contentmanger: startMusic");
		const args = [duration + 's', 'mpv', '-vo', 'xv', '-fs', '-quiet', '--af=drc=2:0.25', path];

		if (startTime) {
			args.push('--start');
			args.push(startTime);
		}

		if (endTime) {
			args.push('--end');
			args.push(endTime);
		}

		return this.runningMusicProc = cp.spawn('timeout', args); //settings match those by music.get
	}

	stopMusic() { console.log("contentmanger: stopMusic");
		if (this.runningMusicProc) this.runningMusicProc.kill();
	}

	startPic(path, duration) { console.log("contentmanger: startPic");
		this.runningPicProc = cp.spawn('timeout', [duration + 's', 'eog', path, '-f']);
	}

	stopPic() { console.log("contentmanger: stopPic");
		if (this.runningPicProc) this.runningPicProc.kill();
	}

	killCurrent() { console.log("contentmanger: killCurrent");
		this.stopMusic();
		this.stopPic();
	}

	addHash(hash) { console.log("contentmanger: addHash");
		this.hashes[hash] = new Date().getTime();
	}

	addPicHash(hash) { console.log("contentmanger: picHash");
		this.picHashes[hash] = new Date().getTime();
	}

	addYtId(id) { console.log("contentmanger: addYtId");
		this.ytIds[id] = new Date().getTime();
	}

	hashIsUnique(hash) { console.log("contentmanger: hashIsUnique");
		let t = this.hashes[hash];
		return !t || t + opt.uniquenessCoolOff * 1000 < new Date().getTime();
	}

	picHashIsUnique(hash) { console.log("contentmanger: picHashIsUnique");
		let t = this.picHashes[hash];
		return !t || t + opt.uniquenessCoolOff * 1000 < new Date().getTime();
	}

	ytIdIsUnique(id) { console.log("contentmanger: ytIdIsUnique");
		let t = this.ytIds[id];
		return !t || t + opt.uniquenessCoolOff * 1000 < new Date().getTime();
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
					name: Html5Entities.encode(picName),
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

	downloadYtInfo(urlOrId) { console.log("contentmanger: downloadYtInfo");
		return new Promise(function(resolve, reject) {
			let infoProc = cp.spawn('youtube-dl', ['--no-playlist', '--get-title', '--get-duration', '--max-filesize', opt.musicSizeLimit, urlOrId]);
			let rawData = '';
			let rawError = '';

			infoProc.stdout.on('data', function(chunk) {
				rawData += chunk;
			});
			infoProc.on('error', function(message) {
				rawError += message;
			});
			infoProc.on('close', function(code, signal) {
				console.error(rawError);

				if (code === 0) {
					let dataArr = rawData.split('\n');
					resolve({
						musicTitle: Html5Entities.encode(dataArr[0]),
						duration: utils.ytTimeStrToSec(dataArr[1]),
					});
				} else {
					reject(rawError);
				}
			});
		});
	}

	downloadYtVid(urlOrId, destination) { console.log("contentmanger: downloadYtVid");
		return new Promise(function(resolve, reject) {
			const dlProc = cp.spawn('youtube-dl', ['--no-playlist', urlOrId, '--max-filesize', utils.toShortSizeString(opt.musicSizeLimit), '-o', destination]);
			let rawError = '';

			dlProc.on('error', function(message) {
				rawError += message;
			});
			dlProc.on('close', function(code, signal) {
				console.error(rawError);

				if (code === 0) {
					//youtube-dl adds an unknown file extension
					cp.spawnSync('mv', [destination + '.*', destination], {shell:true}); //destination should be generated internally as just an integer !!!

					resolve();
				} else {
					reject(rawError);
				}
			});
		});
	}

	getBucketsForPublic() { console.log("contentmanger: getBucketsForPublic");
		const userRecord = require('../main.js').userRecord; //I don't feel good doing it this way

		let userId, bucketTitles;
		let userIds = this.playQueue.getUsersByPosteriority();
		let returnList = [];

		//map and filter
		for (let i=0; i < userIds.length; i++) {
			userId = userIds[i];
			bucketTitles = this.playQueue.getTitlesFromUserBucket(userId);

			if (bucketTitles.length !== 0) {
				returnList.push({
					nickname: userRecord.getNickname(userId),
					userId: userId,
					bucket: bucketTitles,
				});
			}
		}

		return returnList;
	}

	getCurrentlyPlaying() {
		const userRecord = require('../main.js').userRecord; //I don't feel good doing it this way

		if (this.currentlyPlaying) return {
			nickname: userRecord.getNickname(this.currentlyPlaying.userId),
			title: this.currentlyPlaying.musicTitle,
		};

		else return null;
	}

	store() { console.log("contentmanger: store");
		let storeObj = {
			dlQueue: this.dlQueue,
			playQueue: this.playQueue, //luckily this is jsonable
			hashes: this.hashes,
			picHashes: this.picHashes,
			ytIds: this.ytIds,
			musicId: this.musicId,
			pictureId: this.pictureId,
			contentId: this.contentId,
		};

		fs.writeFileSync(contentFilePath, JSON.stringify(storeObj));
	}

	deleteContent(contentObj) { console.log("contentmanger: deleteContent");
		try {
			utils.deleteFile(contentObj.musicPath);
			if (contentObj.hasPic) utils.deleteFile(contentObj.picPath);

		} catch (e) {
			//dirty way of stopping it exiting when trying to delete a url
		}
	}

	purgeUser(uid) {
		this.playQueue.purge(uid);
		if (this.currentlyPlaying && this.currentlyPlaying.userId === uid) {
			this.killCurrent();
		}
	}
}

module.exports = ContentManager;
