const co = require('co');
const cp = require('child_process');
const request = require('request');
const fs = require('fs');
const q = require('q');

const opt = require('../options.js');
const utils = require('./utils.js');
const Queue = require('./Queue2000.js');

const playQueueFilePath = opt.storageDir + '/playQueue.json';
const dlMusicPath = opt.storageDir + '/music/';
const dlPicturesPath = opt.storageDir + '/pictures/';

class ContentManager2000 {
	constructor() {
		this.contentData = new Map();
		this.contentId = 0;
		this.musicId = 0;
		this.pictureId = 0;

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
				const contentId = this.playQueue.next();
				const contentData = this.data.get(contentId);

				this.startVid(contentData.vidPath);
				
				let picname;
				if (contentData.picPath) {
					picName = 'no picture'
					this.startPic(contentData.picPath);
				} else {
					picName = contentData.picName;
				}

				const currentTime = new Date().toGMTString();
				const timeString = utils.secToMinStr(currentTime);
				console.log(`${contentData.nickname} played ${contentData.vidName} with ${picName} at ${currentTime} lasting ${timeString}.`);
				
				let defer = q.defer();

				setTimeout(function() {
					defer.resolve();
				}, duration);

				yield defer.promise;

				this.killCurrent();

				yield; //hopefully if the dl queue is empty this will prevent a block in the event loop
			}
		});
		
		//download items in the download queue
		co(function*() {
			while (true) {
				const itemQueueInfo = this.playQueue.nextToDownload();
				const itemData = this.contentData.get(itemQueueInfo.itemId);

				const result = {
					didMusicDownload: false,
					didPicDownload: false,
				};

				//download picture if one is specified
				if (itemData.picUrl !== null) {
					try {
						yield this.downloadPic(itemData.picUrl, storageLocation(itemData.contentId, false));
						result.didPicDownload = true;
					}
					catch (e) {
						itemData.hasPicture = false;
					}
				}

				if (itemData.musicUrl !== null) {
					try {
						yield this.downloadMusic(itemData.musicUrl, storageLocation(itemData.contentId, true));
						result.didMusicDownload = true;
					}
					catch (e) {
						this.playQueue.remove(itemData.itemId);
						errors.push('Could not download music.');
					}
				}

				//state whether the downloads have been successful
				if (errors.length !== 0) {
					itemData.deferred.reject(result);
				} else {
					itemData.deferred.resolve(result);
				}

				yield; //hopefully if the dl queue is empty this will prevent a block in the event loop
			}
		});
	}

	addYouTubeMusic(musicUrl) {
		return new Promise(function(resolve, reject) {

			let data = {};

			//add music
			this.downloadYtInfo(musicUrl).then(
				function(d) { //data = {title, name}
					if (!this.ytUrlIsUnique(musicUrl)) {
						reject(`This music has been played before (${d.title}).`);
					}

					data.title = d.title; //sorry about this mess
					data.duration = d.duration;

				}, function() {
					reject("There was an error downloading your song from YouTube.");

				}

			).then(function() {
				data.musicPath = this.nextMusicPath();
				return downloadYtVid(musicUrl, data.musicPath);

			}).then(
				function() {
					resolve(data);
				},
				function() {
					reject();
				}
			);
		});
	}

	addLocalMusic(filePath) {
		return new Promise(function(resolve, reject) {
			let newLocation = this.nextMusicPath();
			let mvProc = cp.spawn('mv', [filePath, newLocation]);
			mvProc.on('exit', function(code, signal) {
				if (code == null) {
					reject();
				} else {
					resolve();
				}
			});

			return {
				filePath: newLocation,
			};
		});
	}

	nextMusicPath() {
		return dlMusicPath + this.musicId++;
	}

	nextPicturePath() {
		return dlPicturesPath + this.pictureId++;
	}

	start vid(path)

	stop vid()

	shart pic

	stop pic

	kill current
		kill item
		kill pic
		log end of play, includes id (ip/username) and timestamp with timezone

	is unique
		see if youtube video code or file hash is in the uniqueness tracker

	itemChosenByUser (queueidm, userid)
		boolean

	remove item (vidId)
		not sure how

	downloadPic url
		//using http(s) request or curl with an event for on done

	downloadYtInfo(url) {
		return new Promise(function(resolve, reject) {
			cp.spawn('../bin/youtube-dl', ['--no-playlist', '--get-title', '--get-duration', url]);
		});
	}

	downloadYtVid(url, destination) {
		return new Promise(function(resolve, reject) {
			const dlProc = cp.spawn('../bin/youtube-dl', ['--no-playlist', url, '-o', destination]); //
			dlProc.on('exit', function(code, signal) {
				if (code == null) {
					reject();
				} else {
					resolve();
				}
			});
		});
	}

	getQueue
		returns [
			[
				{
					name
					nickname / ip, if nickname is null
				}
			],
			.
			.
			.
		]

	musicIsRepeated 

	picIsRepeated
}

function storageLocation(contentId, isMusic) {
	return opt.storageDir + '/' + isMusic ? 'music' : 'pictures' + '/' + contentId;
}

module.exports = ContentManager2000;
