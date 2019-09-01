import * as cp from "child_process";
import { EventEmitter } from "events";
import { Html5Entities } from "html-entities";
import * as request from "request";
import * as fs from "fs";

import * as consts from "./consts";
import * as debug from "./debug";
import * as utils from "./utils";
import * as opt from "../options";
import * as time from "./time";

import { ClippyQueue } from "./ClippyQueue";
import { ContentType } from "../types/ContentType";
import { downloadYtInfo, getFileDuration, YtData } from "./music";
import { BadUrlError, CancelError, DownloadTooLargeError, DownloadWrongTypeError, UniqueError, UnknownDownloadError, YTError } from "./errors";
import { UploadDataWithId, UploadDataWithIdTitleDuration, NoPic, FilePic, UrlPic, TitledMusic } from "../types/UploadData";
import { IdFactory } from "./IdFactory";
import { ItemData, CompleteMusic, CompletePicture } from "../types/ItemData";
import { YtDownloader } from "./YtDownloader";
import { UserRecord } from "./UserRecord";
import { ProgressQueue } from "./ProgressQueue";

interface BucketForPublic {
	bucket: {
		title: string,
		id: number,
	}[];
	nickname: string;
	userId: string;
}

interface SuspendedContentManager {
	playQueue: any;
	hashes: any;
	picHashes: any;
	ytIds: any;
}

export class ContentManager extends EventEmitter {
	//data stores
	private playQueue: ClippyQueue;
	private musicHashes: {
		[hash: string]: number
	} = {};
	private picHashes: {
		[hash: string]: number
	} = {};
	private ytIds: {
		[hash: string]: number
	} = {};

	//injected objects
	private idFactory: IdFactory;
	private progressQueue: ProgressQueue;
	private userRecord: UserRecord;
	private ytDownloader: YtDownloader;

	//processes
	private runningMusicProc: cp.ChildProcess | null = null;
	private runningPicProc: cp.ChildProcess | null = null;
	public currentlyPlaying: ItemData | null = null;

	private stop?: boolean;

	constructor(
		startState: SuspendedContentManager | null,
		idFactory: IdFactory,
		progressQueue: ProgressQueue,
		userRecord: UserRecord,
		ytDownloader: YtDownloader
	) {
		super();

		//injected objects
		this.idFactory = idFactory;
		this.progressQueue = progressQueue;
		this.userRecord = userRecord;
		this.ytDownloader = ytDownloader;

		if (startState) {
			console.log("Using suspended content manager");

			this.playQueue = new ClippyQueue(startState.playQueue);
			this.musicHashes = startState.hashes;
			this.picHashes = startState.picHashes;
			this.ytIds = startState.ytIds;
		} else {
			this.playQueue = new ClippyQueue();
		}
	}

	// retreive suspended ContentManger
	static recover(): SuspendedContentManager | null {
		let obj;
		let pqContent: Buffer;
		let success = true;

		try {
			pqContent = fs.readFileSync(consts.files.content);

		} catch (e) {
			console.log("No suspended content manager found. This is ok.");
			return null;
		}

		console.log("Reading suspended content manager");

		try {
			success = true;
			obj = JSON.parse(pqContent.toString());

		} catch (e) {
			success = false;
			if (e instanceof SyntaxError) {
				console.error("Syntax error in suspendedContentManager.json file.");
				console.error(e);
				console.log("Ignoring suspended content manager");
			} else {
				throw e;
			}
		}

		return success ? obj : null;
	}

	async add(uplData: UploadDataWithId) {
		try {
			// awaits everything that needs to happen before http response
			const dataToQueue = await this.getDataToQueue(uplData);
			this.tryQueue(dataToQueue);
			return dataToQueue;
		} catch (err) {
			// errors here are sent by websocket
			debug.error(err);
			throw err;
		}
	}

	addHash(hash: number) {
		this.musicHashes[hash] = new Date().getTime();
	}

	addPicHash(hash: number) {
		this.picHashes[hash] = new Date().getTime();
	}

	addYtId(id: string) {
		this.ytIds[id] = new Date().getTime();
	}

	deleteContent(contentObj: ItemData) {
		if (!contentObj.music.stream) utils.deleteFile(contentObj.music.path);
		if (contentObj.pic.exists) utils.deleteFile(contentObj.pic.path); //empty picture files can be uploaded and will persist
	}

	downloadPic(url: string, destination: string): Promise<{ title: string }> {
		return new Promise((resolve, reject) => {
			request.head(url, (err, res, body) => {
				if (err) {
					err.contentType = ContentType.Picture;
					if (err.code === "ENOTFOUND" || err.code === "ETIMEDOUT") {
						return reject(new BadUrlError(ContentType.Picture));
					}
					return reject(err);
				}

				if (!res) {
					return reject(new UnknownDownloadError("Could not get a response for the request.", ContentType.Picture));
				}

				const typeFound = res.headers["content-type"] as string;

				if (typeFound.split("/")[0] !== "image") {
					return reject(new DownloadWrongTypeError(ContentType.Picture, "image", typeFound));
				}
				if (parseInt(res.headers["content-length"] as string) > opt.imageSizeLimit) {
					return reject(new DownloadTooLargeError(ContentType.Picture));
				}

				let picName: string | null = url.split("/").pop() as string;
				picName = picName.length <= 1 ? null : picName.split(".").shift() as string;

				if (picName == null) {
					picName = "";
				}

				const picinfo = {
					title: new Html5Entities().encode(picName),
				};

				const stream = request(url).pipe(fs.createWriteStream(destination));

				stream.on("close", () => {
					return resolve(picinfo);
				});
				stream.on("error", (err) => {
					err.contentType = ContentType.Picture;
					return reject(err);
				});
			});
		});
	}

	end() {
		this.stop = true;
		this.killCurrent();
	}

	forget(itemData: ItemData) {
		if (itemData.music.ytId) delete this.ytIds[itemData.music.ytId];
		if (itemData.music.hash) delete this.musicHashes[itemData.music.hash];
		if (itemData.pic.hash) delete this.picHashes[itemData.pic.hash];
	}

	getBucketsForPublic(): BucketForPublic[] {
		let userId, bucketTitles;
		let userIds = this.playQueue.getUsersByPosteriority();
		let returnList: BucketForPublic[] = [];

		//map and filter
		for (let i=0; i < userIds.length; i++) {
			userId = userIds[i];
			bucketTitles = this.playQueue.getTitlesFromUserBucket(userId);

			if (bucketTitles.length !== 0) {
				returnList.push({
					bucket: bucketTitles,
					nickname: this.userRecord.getNickname(userId),
					userId: userId,
				});
			}
		}

		return returnList;
	}

	getCurrentlyPlaying() {
		if (this.currentlyPlaying) {
			return {
				nickname: this.userRecord.getNickname(this.currentlyPlaying.userId),
				title: this.currentlyPlaying.music.title,
				userId: this.currentlyPlaying.userId,
			};
		}

		return null;
	}

	private async getDataToQueue(uplData: UploadDataWithId): Promise<UploadDataWithIdTitleDuration> {
		if (!uplData.music.isUrl) {
			// read the music file to determine its duration
			const duration = await getFileDuration(uplData.music.path);
			const uplDataWithDuration = {
				...uplData,
				music: {
					...uplData.music,
				},
				pic: {
					...uplData.pic,
				},
				duration: time.clipTimeByStartAndEnd(Math.floor(duration), uplData.startTime, uplData.endTime),
			};

			return uplDataWithDuration;
		}

		const ytId = uplData.music.ytId = utils.extractYtVideoId(uplData.music.path);

		if (ytId === undefined) throw new Error("youtube id is undefined");

		if (this.ytIdIsUnique(ytId)) {
			let info: YtData;

			try {
				info = await downloadYtInfo(uplData.music.path);
			} catch (err) {
				debug.error(err);
				throw new YTError(`I could not find the YouTube video requested (${ytId}). Is the URL correct?`);
			}

			const musicData = {
				...uplData.music,
				title: info.title,
			};

			return {
				...uplData,
				music: musicData,
				duration: time.clipTimeByStartAndEnd(Math.floor(info.duration), uplData.startTime, uplData.endTime),
			};

		} else {
			throw new UniqueError(ContentType.Music);
		}
	}

	isPlaying() {
		return this.currentlyPlaying !== null;
	}

	killCurrent() {
		this.stopMusic();
		this.stopPic();
	}

	logPlay(contentData: ItemData) {
		const nickname = this.userRecord.getNickname(contentData.userId);
		const currentTime = new Date().toString();

		let picName;
		if (contentData.pic.exists) {
			picName = new Html5Entities().decode(contentData.pic.title);
		} else {
			picName = "no picture";
		}

		let nonEntityTile = new Html5Entities().decode(contentData.music.title);

		//public log uses publicly facing info
		console.log(`"${nickname}" played "${nonEntityTile}" with "${picName}" at ${currentTime}.`);

		//private log uses private facing info
		let message = `UserId: "${contentData.userId}" played "${nonEntityTile}" with "${picName}" at ${currentTime}.\n`;
		fs.appendFile(consts.files.log, message, (err) => {
			if (err) throw err;
		});
	}

	private musicIsUnique(music: CompleteMusic): boolean {
		if (music.hash !== undefined && !this.musicHashIsUnique(music.hash)) {
			return false;
		}

		if (music.ytId !== undefined && !this.ytIdIsUnique(music.ytId)) {
			return false;
		}

		return true;
	}

	musicHashIsUnique(hash: number): boolean {
		let lastPlayed = this.musicHashes[hash];
		return !lastPlayed || lastPlayed + opt.musicUniqueCoolOff * 1000 <= new Date().getTime(); // can be so quick adjacent songs are recorded and played at the same time
	}

	nextMusicPath(): string {
		return consts.dirs.music + this.idFactory.new();
	}

	nextPicPath(): string {
		return consts.dirs.pic + this.idFactory.new();
	}

	penalise(id: string) {
		this.playQueue.penalise(id);
	}

	picHashIsUnique(hash: number): boolean {
		let lastPlayed = this.picHashes[hash];
		return !lastPlayed || lastPlayed + opt.imageUniqueCoolOff * 1000 <= new Date().getTime(); // can be so quick adjacent songs are recorded and played at the same time
	}

	playNext(): boolean {
		if (this.stop) return false;

		const contentData = this.playQueue.next();
		const that = this;

		if (contentData === null) {
			this.currentlyPlaying = null;
			this.emit("queue-empty");
			return false;
		}

		//double check the content is still unique, only checking music as it is the main feature
		if (!this.musicIsUnique(contentData.music)) {
			console.log("music not unique");
			this.deleteContent(contentData);
			return this.playNext();
		}

		//play content

		this.currentlyPlaying = contentData;

		const timePlayedAt = Date.now();
		const musicProc = this.startMusic(contentData.music.path, opt.timeout, contentData.startTime, contentData.endTime);

		musicProc.on("close", (code, signal) => { // runs before next call to playNext
			const secs = 1 + Math.ceil((Date.now() - timePlayedAt) / 1000); //seconds ran for, adds a little bit to prevent infinite <1 second content

			that.playQueue.boostPosteriority(contentData.userId, secs);

			that.stopPic();
			that.deleteContent(contentData);
			that.currentlyPlaying = null;

			// save hashes if the music played for long enough
			if (secs >= consts.minPlayTimeToPreventReplay) this.remember(contentData);

			that.emit("end");
		});

		if (contentData.pic.exists) {
			const picPath = contentData.pic.path;
			musicProc.stdout.on("data", function showPicture(buf) {
				//we want to play the picture after the video has appeared, which takes a long time when doing it remotely
				//so we have to check the output of mpv, for signs it's not just started up, but also playing :/
				if (buf.includes("(+)") || buf.includes("Audio") || buf.includes("Video")) {
					that.startPic(picPath, opt.timeout);
					musicProc.stdout.removeListener("data", showPicture); //make sure we only check for this once, for efficiency
				}
			});
		}

		this.logPlay(contentData);

		this.emit("queue-update");

		return true;
	}

	purgeUser(uid: string) {
		const itemList = this.playQueue.getUserBucket(uid);

		if (itemList) itemList.forEach((itemData) => {
			this.forget(itemData);
		});

		this.playQueue.purge(uid);
		if (this.currentlyPlaying && this.currentlyPlaying.userId === uid) {
			this.killCurrent();
		}
	}

	remember(itemData: ItemData) {
		if (itemData.music.ytId) this.addYtId(itemData.music.ytId);
		if (itemData.music.hash) this.addHash(itemData.music.hash);

		if (itemData.pic.exists) {
			this.addPicHash(itemData.pic.hash);
		}
	}

	remove(userId: string, contentId: number) {
		const itemData = this.playQueue.getContent(userId, contentId);

		if (itemData) {
			this.deleteContent(itemData);
			this.playQueue.remove(userId, itemData);
			this.forget(itemData);
			this.emit("queue-update");

			return true;
		}

		return false;
	}

	startMusic(path: string, duration: number, startTime: number | null | undefined, endTime: number | null | undefined) {
		const args = [duration + "s", opt.mpvPath, ...opt.mpvArgs, "--quiet", path];

		if (startTime) {
			args.push("--start");
			args.push(startTime.toString());
		}

		if (endTime) {
			args.push("--end");
			args.push(endTime.toString());
		}

		if (opt.mute.get()) {
			args.push("--mute=yes");
		}

		return this.runningMusicProc = cp.spawn("timeout", args);
	}

	stopMusic() {
		if (this.runningMusicProc) this.runningMusicProc.kill();
	}

	startPic(path: string, duration: number) {
		this.runningPicProc = cp.spawn("timeout", [duration + "s", "eog", path, "-f"]);
	}

	stopPic() {
		if (this.runningPicProc) {
			this.runningPicProc.kill();
			this.runningPicProc = null;
		}
	}

	store() {
		console.log("Storing content manager...");

		let storeObj = {
			playQueue: this.playQueue, //luckily this is jsonable
			hashes: this.musicHashes,
			picHashes: this.picHashes,
			ytIds: this.ytIds,
		};

		fs.writeFileSync(consts.files.content, JSON.stringify(storeObj));
	}

	private async tryQueue(someItemData: UploadDataWithIdTitleDuration) {
		try {
			const musicPrepProm = this.tryPrepMusic(
				someItemData.music,
				someItemData.id,
				someItemData.userId,
				someItemData.duration,
			);

			// if the picture fails, make sure any yt download is stopped
			const picPrepProm = this.tryPrepPicture(someItemData.pic).catch(err => {
				this.ytDownloader.tryCancel(someItemData.userId, someItemData.id);
				throw err;
			});

			const [ music, pic ] = await Promise.all([musicPrepProm, picPrepProm]);

			const itemData = {
				...someItemData,
				pic,
				music,
			};

			this.playQueue.add(itemData);
			this.progressQueue.finished(itemData.userId, itemData.id);
			this.emit("queue-update");

		} catch (err) {
			if (err instanceof CancelError) {
				console.error(err);
			} else {
				this.progressQueue.finishedWithError(someItemData.userId, someItemData.id, err);
			}
		}
	}

	private async tryPrepMusic(music: TitledMusic, cid: number, uid: string, duration: number): Promise<CompleteMusic> {
		if (music.isUrl) {
			if (duration <= opt.streamYtOverDur) {
				let nmp = this.nextMusicPath();

				let st = new Date().getTime();

				await this.ytDownloader.new(cid, uid, music.title, music.path, nmp);

				// when download is completed, then
				// count how long it took
				let et = new Date().getTime();
				let dlTime = utils.roundDps((et - st) / 1000, 2);
				let ratio = utils.roundDps(duration / dlTime, 2);

				music.path = nmp; //play from this path not url

				//log the duration
				console.log(`Yt vid (${music.ytId}) of length ${duration}s took ${dlTime}s to download, ratio: ${ratio}`);

				//hash the music (async)
				const musicHash = await utils.fileHash(nmp);

				//this exists to prevent a YouTube video from
				//being downloaded by user and played, then played again by url
				//or being downloaded twice in quick succession
				if (this.musicHashIsUnique(musicHash)) {
					return {
						...music,
						hash: musicHash,
						stream: false,
					};
				} else {
					throw new UniqueError(ContentType.Music);
				}

			} else { //just stream it because it's so big
				return {
					...music,
					hash: undefined,
					stream: true,
				};
			}
		} else {
			//validate by music hash
			const musicHash = await utils.fileHash(music.path);
			if (this.musicHashIsUnique(musicHash)) {
				return {
					...music,
					hash: musicHash,
					stream: false,
				};
			} else {
				throw new UniqueError(ContentType.Music);
			}
		}
	}

	private async tryPrepPicture(pic: NoPic | FilePic | UrlPic): Promise<CompletePicture> {
		if (!pic.exists) {
			return {
				...pic,
				hash: undefined,
			};
		}

		//we may already have the picture downloaded, but we always need to check the uniqueness

		let pathOnDisk: string;
		let title: string;

		if (pic.isUrl) {
			const npp = this.nextPicPath();
			const picInfo = await this.downloadPic(pic.path, npp);

			pathOnDisk = npp;
			title = picInfo.title;
		} else {
			pathOnDisk = pic.path;
			title = pic.title;
		}

		const picHash = await utils.fileHash(pathOnDisk);

		if (this.picHashIsUnique(picHash)) {
			return {
				...pic,
				path: pathOnDisk,
				title,
				hash: picHash,
			};

		} else {
			throw new UniqueError(ContentType.Picture);
		}
	}

	ytIdIsUnique(id: string): boolean {
		let lastPlayed = this.ytIds[id];
		return !lastPlayed || lastPlayed + opt.musicUniqueCoolOff * 1000 < new Date().getTime(); // can be so quick adjacent songs are recorded and played at the same time
	}
}
