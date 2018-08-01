const cp = require('child_process');
const EventEmitter = require('events');
const Html5Entities = require('html-entities').Html5Entities;
const request = require('request');
const fs = require('fs');
const q = require('q');

const consts = require('./consts.js');
const debug = require('./debug.js');
const opt = require('../options.js');
const utils = require('./utils.js');

const ClippyQueue = require('./ClippyQueue.js');
const YtDownloader = require('./YtDownloader.js');
const { CancelError, DownloadError, UniqueError, YTError } = require('./errors.js');

const UserRecordServer = require('../serv/UserRecordServer.js');

class ContentManager extends EventEmitter {
	constructor(startState, idFactory, progressQueue, ytDownloader) {
		super();
		
		//data stores
		this.dlQueue = [];
		this.playQueue = null;
		this.musicHashes = {};
		this.picHashes = {};
		this.ytIds = {};

		//injected objects
		this.idFactory = idFactory;
		this.progressQueue = progressQueue;
		this.ytDownloader = ytDownloader;

		//processes
		this.runningMusicProc = null;
		this.runningPicProc = null;
		this.currentlyPlaying = null;

		if (startState) {
			console.log('Using suspended content manager');

			this.dlQueue = startState.dlQueue;
			this.playQueue = new ClippyQueue(startState.playQueue);
			this.musicHashes = startState.hashes;
			this.picHashes = startState.picHashes;
			this.ytIds = startState.ytIds;
		} else {
			this.playQueue = new ClippyQueue();
		}
	}

	//static

	static recover() {
		//retreive suspended queue
		let obj, pqContent;
		let success = true;

		//I'm trying some weird control flow because I don't like try catch. Usually there's only 1 line you want to try and you don't want to assume something has been caught for the wrong reasons.
		try {
			success = true;
			pqContent = fs.readFileSync(consts.files.content);
			
		} catch (e) {
			success = false;
			console.log('No suspended content manager found. This is ok.');
		}

		if (success) {
			console.log('Reading suspended content manager');

			try {
				success = true;
				obj = JSON.parse(pqContent);
				
			} catch (e) {
				success = false;
				if (e instanceof SyntaxError) {
					console.error('Syntax error in suspendedContentManager.json file.');
					console.error(e);
					console.log('Ignoring suspended content manager');
				} else {
					throw e;
				}
			}
		}

		return success ? obj : null;
	}

	//object methods

	add(uplData) {
		const that = this;

		const p = new Promise(function(resolve, reject) {
			if (!uplData.music.isUrl) {
				resolve();
				return;
			}

			let ytId = uplData.music.ytId = utils.extractYtVideoId(uplData.music.path);

			if (that.ytIdIsUnique(ytId)) {
				that.downloadYtInfo(uplData.music.path).then((info) => {
					uplData.music.title = info.title;
					uplData.duration = info.duration;

					resolve();

				}, (e) => {
					debug.error(e);
					reject(new YTError(`Failed to retreive data about the YouTube video requested (${uplData.music.ytId}). The URL may not be correct.`));
				});
			
			} else {
				const when = consts.uniqueCoolOffStr.startsWith('Infinity') ? 'already' : `within the past ${consts.uniqueCoolOffStr}`;
				reject(new YTError(`The YouTube video (${ytId}) requested has been played ${when}.`));
			}
		});

		//errors here are sent by websocket
		p.then(() => {
			this.tryQueue(uplData);
		});

		//p includes everything that needs to happen before http response
		return p;
	}

	addHash(hash) {
		this.musicHashes[hash] = new Date().getTime();
	}

	addPicHash(hash) {
		this.picHashes[hash] = new Date().getTime();
	}

	addYtId(id) {
		this.ytIds[id] = new Date().getTime();
	}

	cancelDownload(uid, dlid) {
		return this.ytDownloader.tryCancel(uid, dlid);
	}

	deleteContent(contentObj) {
		if (!contentObj.music.stream) utils.deleteFile(contentObj.music.path);
		if (contentObj.pic.exists) utils.deleteFile(contentObj.pic.path); //empty picture files can be uploaded and will persist
	}

	downloadPic(url, destination) {
		return new Promise((resolve, reject) => {
			request.head(url, (err, res, body) => {
				if (err) reject(new DownloadError(err.message, 'pic'));

				if (res.headers['content-type'].split('/')[0] !== 'image') reject(new DownloadError('A non-image was requested.', 'pic'));
				if (res.headers['content-length'] > opt.imageSizeLimit) reject(new DownloadError(`Image requested was too large (over ${opt.imageSizeLimit} bytes).`, 'pic'));

				let picName = url.split('/').pop();
				picName = picName.length <= 1 ? null : picName.split('.').shift();

				const picinfo = {
					title: Html5Entities.encode(picName),
				};

				const stream = request(url).pipe(fs.createWriteStream(destination));

				stream.on('close', () => {
					resolve(picinfo);
				});
				stream.on('error', () => {
					reject(new DownloadError('Unknown picture stream reading error.', 'pic'));
				});
			});
		});
	}

	downloadYtInfo(urlOrId) {
		return new Promise(function(resolve, reject) {
			let infoProc = cp.spawn(opt.youtubeDlPath, ['--no-playlist', '--get-title', '--get-duration', urlOrId]);
			let rawData = '';
			let rawError = '';

			infoProc.stdout.on('data', function(chunk) {
				rawData += chunk;
			});
			infoProc.on('error', function(message) {
				rawError += message;
			});
			infoProc.on('close', function(code, signal) {
				debug.error('yt-dl info getting error message:', rawError);

				if (code === 0) {
					let dataArr = rawData.split('\n');
					resolve({
						title: Html5Entities.encode(dataArr[0]),
						duration: utils.ytTimeStrToSec(dataArr[1]),
					});
				} else {
					reject(rawError);
				}
			});
		});
	}

	end() {
		this.stop = true;
		this.killCurrent();
	}

	forget(itemData) { 
		if (itemData.music.ytId) delete this.ytIds[itemData.music.ytId]; 
		if (itemData.music.hash) delete this.musicHashes[itemData.music.hash]; 
		if (itemData.pic.hash) delete this.picHashes[itemData.pic.hash]; 
	}

	getBucketsForPublic() {
		let userId, bucketTitles;
		let userIds = this.playQueue.getUsersByPosteriority();
		let returnList = [];

		//map and filter
		for (let i=0; i < userIds.length; i++) {
			userId = userIds[i];
			bucketTitles = this.playQueue.getTitlesFromUserBucket(userId);

			if (bucketTitles.length !== 0) {
				returnList.push({
					bucket: bucketTitles,
					nickname: UserRecordServer.getNickname(userId),
					userId: userId,
				});
			}
		}

		return returnList;
	}

	getCurrentlyPlaying() {
		if (this.currentlyPlaying) return {
			nickname: UserRecordServer.getNickname(this.currentlyPlaying.userId),
			title: this.currentlyPlaying.music.title,
			userId: this.currentlyPlaying.userId,
		};

		else return null;
	}

	hashIsUnique(hash) {
		let t = this.musicHashes[hash];
		return !t || t + opt.uniqueCoolOff * 1000 < new Date().getTime();
	}

	isPlaying() {
		return this.currentlyPlaying !== null;
	}

	killCurrent() { 
		this.stopMusic(); 
		this.stopPic(); 
	} 

	logPlay(contentData) {
		const nickname = UserRecordServer.getNickname(contentData.userId);
		const currentTime = new Date().toGMTString();
		
		let picName;
		if (contentData.pic.exists) {
			picName = Html5Entities.decode(contentData.pic.title);
		} else {
			picName = 'no picture';
		}

		let nonEntityTile = Html5Entities.decode(contentData.music.title);

		//public log uses publicly facing info
		console.log(`"${nickname}" played "${nonEntityTile}" with "${picName}" at ${currentTime}.`);

		//private log uses private facing info
		let message = `UserId: "${contentData.userId}" played "${nonEntityTile}" with "${picName}" at ${currentTime}.\n`;
		fs.appendFile(consts.files.log, message, (err) => {
			if (err) throw err;
		});
	}

	nextMusicPath() {
		return consts.dirs.music + this.idFactory.new();
	}

	nextPicPath() {
		return consts.dirs.pic + this.idFactory.new();
	}

	penalise(id) {
		this.playQueue.penalise(id);
	}

	picHashIsUnique(hash) {
		let t = this.picHashes[hash];
		return !t || t + opt.uniqueCoolOff * 1000 < new Date().getTime();
	}

	playNext() {
		if (this.stop) return false;

		const contentData = this.playQueue.next();
		const that = this;

		if (contentData === null) {
			this.currentlyPlaying = null;
			this.emit('queue-empty');
			return false;
		}

		//double check the content is still unique, only checking music as it is the main feature
		if (!this.hashIsUnique(contentData.music.hash)) {
			this.deleteContent(contentData);
			return this.playNext();
		}

		//save hashes
		this.remember(contentData);

		//play content

		this.currentlyPlaying = contentData;

		let musicProc = this.startMusic(contentData.music.path, opt.timeout, contentData.startTime, contentData.endTime);
		
		musicProc.on('close', (code, signal) => {
			let secs = 1 + Math.ceil((Date.now() - contentData.timePlayedAt) / 1000); //seconds ran for, adds a little bit to prevent infinite <1 second content
			that.playQueue.boostPosteriority(contentData.userId, secs);
			that.stopPic();
			that.deleteContent(contentData);
			that.currentlyPlaying = null;
			that.emit('end');
		});

		if (contentData.pic.exists) {
			const showPicture = (buf) => {
				//we want to play the picture after the video has appeared, which takes a long time when doing it remotely
				//so we have to check the output of mpv, for signs it's not just started up, but also playing :/
				if (buf.includes('(+)') || buf.includes('Audio') || buf.includes('Video')) {
					that.startPic(contentData.pic.path, opt.timeout);
					that.removeListener('data', showPicture); //make sure we only check for this once, for efficiency
				}
			};

			musicProc.stdout.on('data', showPicture);
		}
		
		this.logPlay(contentData);

		contentData.timePlayedAt = Date.now();

		this.emit('queue-update');

		return true;
	}

	purgeUser(uid) {
		const itemList = this.playQueue.getUserBucket(uid);

		if (itemList) itemList.forEach(function(itemData) {
			this.forget(itemData);
		});

		this.playQueue.purge(uid);
		if (this.currentlyPlaying && this.currentlyPlaying.userId === uid) {
			this.killCurrent();
		}
	}
	
	remember(itemData) {
		if (itemData.music.ytId) this.addYtId(itemData.music.ytId);
		if (itemData.music.hash) this.addHash(itemData.music.hash);
		if (itemData.pic.exists) this.addPicHash(itemData.pic.hash);
	}

	remove(userId, contentId) {
		const itemData = this.playQueue.getContent(userId, contentId);

		if (itemData) {
			this.deleteContent(itemData);
			this.playQueue.remove(userId, itemData);
			this.forget(itemData);

			return true;
		}

		return false;
	}

	run() {
		this.emit('end'); //kick start the cycle of checking for things
	}

	startMusic(path, duration, startTime, endTime) {
		const args = [duration + 's', opt.mpvPath, ...opt.mpvArgs, '--quiet', path];

		if (startTime) {
			args.push('--start');
			args.push(startTime);
		}

		if (endTime) {
			args.push('--end');
			args.push(endTime);
		}

		if (opt.mute) {
			args.push('--mute=yes');
		}

		return this.runningMusicProc = cp.spawn('timeout', args); //settings match those by music.get
	}

	stopMusic() {
		if (this.runningMusicProc) this.runningMusicProc.kill();
	}

	startPic(path, duration) {
		this.runningPicProc = cp.spawn('timeout', [duration + 's', 'eog', path, '-f']);
	}

	stopPic() {
		if (this.runningPicProc) {
			this.runningPicProc.kill();
			this.runningPicProc = null;
		}
	}
	
	store() {
		let storeObj = {
			dlQueue: this.dlQueue,
			playQueue: this.playQueue, //luckily this is jsonable
			hashes: this.musicHashes,
			picHashes: this.picHashes,
			ytIds: this.ytIds,
		};

		fs.writeFileSync(consts.files.content, JSON.stringify(storeObj));
	}

	tryQueue(itemData) {
		Promise.all([this.tryPrepMusic(itemData), this.tryPrepPicture(itemData)])
		.then(() => {
			this.playQueue.add(itemData);

			this.emit('queued', itemData);
			
			debug.log(itemData);
		})
		.catch((err) => {
			if (err instanceof CancelError); //handle gracefully

			else if (err instanceof DownloadError) {
				debug.error('download error', err);
				this.emit('not-queued', itemData, 'dl', err.contentType);

			} else if (err instanceof UniqueError) {
				debug.error('uniqueness error', err);
				this.deleteContent(itemData);
				this.emit('not-queued', itemData, 'unique', err.contentType);

			} else {
				console.error('Unknown upload error.', err);
				this.emit('not-queued', itemData, 'unknown');
			}
		})
		//remove from progress queue regardless
		.then(() => {
			this.progressQueue.delete(itemData.userId, itemData.id);
		});
	}

	tryPrepMusic(itemData) {
		if (itemData.music.isUrl) {
			if (itemData.duration <= opt.streamYtOverDur) {
				let nmp = this.nextMusicPath();
					
				let st = new Date().getTime();
				
				const downloadedProm = this.ytDownloader.new(itemData.id, itemData.userId, itemData.music.title, itemData.music.path, nmp);

				//when download is completed, then...
				downloadedProm.then(() => {
					//count how long it took
					let et = new Date().getTime();
					let dlTime = utils.roundDps((et - st) / 1000, 2);
					let ratio = utils.roundDps(itemData.duration / dlTime, 2);

					itemData.music.path = nmp; //play from this path not url

					//log the duration
					console.log(`Yt vid (${itemData.music.ytId}) of length ${itemData.duration}s, took ${dlTime}s to download, ratio: ${ratio}`);

					//hash the music (async)
					return utils.fileHash(nmp);
				})
				.then((resultHash) => {
					//this exists to prevent a YouTube video from
					//being downloaded by user and played, then played again by url
					//or being downloaded twice in quick succession
					let musicHash = resultHash.toString();
					if (this.hashIsUnique(musicHash)) {
						itemData.music.hash = musicHash;
					} else {
						throw new UniqueError('music');
					}
				});

				return downloadedProm;
				
			} else { //just stream it because it's so big
				itemData.music.stream = true;
			}
		} else {
			return Promise.resolve()
			.then(() => utils.fileHash(itemData.music.path))
			.then((resultHash) => {
				//validate by music hash
				let musicHash = resultHash.toString();
				if (this.hashIsUnique(musicHash)) {
					itemData.music.hash = musicHash;
				} else {
					throw new UniqueError('music');
				}
			});
		}
	}

	tryPrepPicture(itemData) {
		if (!itemData.pic.exists) return true;

		//we may already have the picture downloaded, but we always need to check the uniqueness

		let promPic;

		if (itemData.pic.isUrl) {
			const npp = this.nextPicPath();
			promPic = this.downloadPic(itemData.pic.path, npp).then((picInfo) => {
				itemData.pic.path = npp;
				itemData.pic.title = picInfo.title;
			});

		} else {
			promPic = Promise.resolve();
		}

		return promPic
		.then(() => utils.fileHash(itemData.pic.path))
		.then((picHash) => {
			if (this.picHashIsUnique(picHash)) {
				itemData.pic.hash = picHash;
			} else {
				throw new UniqueError('pic');
			}
		});
	}

	ytIdIsUnique(id) {
		let t = this.ytIds[id];
		return !t || t + opt.uniqueCoolOff * 1000 < new Date().getTime();
	}
}

module.exports = ContentManager;
