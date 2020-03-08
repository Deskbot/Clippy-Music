import * as cp from "child_process";
import { EventEmitter } from "events";
import { Html5Entities } from "html-entities";
import * as fs from "fs";

import * as consts from "../consts";
import * as utils from "./utils/utils";
import * as opt from "../options";
import * as time from "./time";

import { ContentType } from "../types/ContentType";
import { getMusicInfoByUrl, getFileDuration, UrlMusicData } from "./music";
import { CancelError, UniqueError, YTError } from "./errors";
import { UploadDataWithId, UploadDataWithIdTitleDuration, NoPic, FilePic, UrlPic, MusicWithMetadata } from "../types/UploadData";
import { IdFactory } from "./IdFactory";
import { ItemData, CompleteMusic, CompletePicture } from "../types/ItemData";
import { YtDlDownloader } from "./YtDownloader";
import { UserRecord } from "./UserRecord";
import { ProgressQueue } from "./ProgressQueue";
import { BarringerQueue, isSuspendedBarringerQueue } from "./queue/BarringerQueue";
import { PublicItemData } from "../types/PublicItemData";
import { downloadPic } from "./download";

export interface SuspendedContentManager {
	playQueue: any;
	hashes: any;
	picHashes: any;
	ytIds: any;
}

export function isSuspendedContentManager(obj: any): obj is SuspendedContentManager {
	return "playQueue" in obj
		&& isSuspendedBarringerQueue(obj.playQueue)
		&& "hashes" in obj
		&& "picHashes" in obj
		&& "ytIds" in obj;
}

export class ContentManager extends EventEmitter {
	//data stores
	private playQueue: BarringerQueue;
	private musicHashes: {
		[hash: string]: number
	} = {};
	private picHashes: {
		[hash: string]: number
	} = {};
	private musicUrlRecord: {
		[uniqueId: string]: number
	} = {};

	//injected objects
	private idFactory: IdFactory;
	private progressQueue: ProgressQueue;
	private userRecord: UserRecord;
	private ytDownloader: YtDlDownloader;

	//processes
	private runningMusicProc: cp.ChildProcess | null = null;
	private runningPicProc: cp.ChildProcess | null = null;
	private currentlyPlaying: ItemData | null = null;

	private stop?: boolean;

	constructor(
		maxTimePerBucket: number,
		startState: SuspendedContentManager | null,
		idFactory: IdFactory,
		progressQueue: ProgressQueue,
		userRecord: UserRecord,
		ytDownloader: YtDlDownloader
	) {
		super();

		this.idFactory = idFactory;
		this.progressQueue = progressQueue;
		this.userRecord = userRecord;
		this.ytDownloader = ytDownloader;

		if (startState) {
			console.log("Using suspended content manager");

			this.playQueue = new BarringerQueue(maxTimePerBucket, startState.playQueue);
			this.musicHashes = startState.hashes;
			this.picHashes = startState.picHashes;
			this.musicUrlRecord = startState.ytIds;
		} else {
			this.playQueue = new BarringerQueue(maxTimePerBucket);
		}
	}

	async add(uplData: UploadDataWithId) {
		try {
			// awaits everything that needs to happen before http response
			const dataToQueue = await this.getDataToQueue(uplData);
			this.tryQueue(dataToQueue);
			return dataToQueue;
		} catch (err) {
			// errors here are sent by websocket
			throw err;
		}
	}

	addHash(hash: number) {
		this.musicHashes[hash] = new Date().getTime();
	}

	addPicHash(hash: number) {
		this.picHashes[hash] = new Date().getTime();
	}

	addUrlId(id: string) {
		this.musicUrlRecord[id] = new Date().getTime();
	}

	private calcPlayableDuration(
		actualFileDuration: number,
		startTime: number | null | undefined,
		endTime: number | null | undefined
	): number {
		const durationBasedOnStartAndFinish = time.clipTimeByStartAndEnd(
			Math.floor(actualFileDuration),
			startTime,
			endTime
		);

		if (durationBasedOnStartAndFinish > opt.timeout) {
			return opt.timeout;
		}

		return durationBasedOnStartAndFinish;
	}

	deleteContent(contentObj: ItemData) {
		if (!contentObj.music.stream) utils.deleteFile(contentObj.music.path);
		if (contentObj.pic.exists) utils.deleteFile(contentObj.pic.path); //empty picture files can be uploaded and will persist
	}

	end() {
		this.stop = true;
		this.killCurrent();
	}

	getBucketsForPublic(): PublicItemData[][] {
		const tooMuchDataInBuckets = this.playQueue.getBuckets();
		const publicBuckets = [] as PublicItemData[][];

		for (const bucket of tooMuchDataInBuckets) {
			const publicBucket = bucket.map(item => this.publicify(item));
			publicBuckets.push(publicBucket);
		}

		return publicBuckets;
	}

	getContent(contentId: number): ItemData | undefined {
		return this.playQueue.get(contentId);
	}

	getCurrentlyPlaying(): ItemData | null {
		return this.currentlyPlaying;
	}

	private async getDataToQueue(uplData: UploadDataWithId): Promise<UploadDataWithIdTitleDuration> {
		if (!uplData.music.isUrl) {
			// read the music file to determine its duration
			const fileDuration = await getFileDuration(uplData.music.path);
			const uplDataWithDuration = {
				...uplData,
				music: {
					...uplData.music,
				},
				pic: {
					...uplData.pic,
				},
				duration: this.calcPlayableDuration(fileDuration, uplData.startTime, uplData.endTime),
			};

			return uplDataWithDuration;
		}

		let info: UrlMusicData;

		try {
			info = await getMusicInfoByUrl(uplData.music.url);
		} catch (err) {
			throw new YTError(`I was unable to download (${uplData.music.title ? uplData.music.title : uplData.music.url}). Is the URL correct? The video might not be compatible.`);
		}

		if (this.musicUrlIsUnique(info.uniqueUrlId)) {
			const musicData = {
				...uplData.music,
				totalFileDuration: info.duration,
				title: info.title,
				uniqueId: info.uniqueUrlId,
			};

			return {
				...uplData,
				music: musicData,
				duration: this.calcPlayableDuration(info.duration, uplData.startTime, uplData.endTime),
			};

		} else {
			throw new UniqueError(ContentType.Music);
		}
	}

	getPublicCurrentlyPlaying(): PublicItemData | undefined {
		if (this.currentlyPlaying) {
			return this.publicify(this.currentlyPlaying);
		}

		return undefined;
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
		const currentTime = new Date().toISOString();

		let picName;
		if (contentData.pic.exists) {
			picName = new Html5Entities().decode(contentData.pic.title);
		} else {
			picName = "no picture";
		}

		const noHtmlEntityTitle = new Html5Entities().decode(contentData.music.title);

		//public log uses publicly facing info
		console.log(currentTime);
		console.log(`user   "${nickname}"`);
		console.log(`played "${noHtmlEntityTitle}"`);
		console.log(`with   "${picName}"`);

		//private log uses private facing info
		const message = currentTime + "\n" +
			`user   "${contentData.userId}\n"` +
			`played "${noHtmlEntityTitle}\n"` +
			`with   "${picName}\n"`;

		fs.appendFile(consts.files.log, message, (err) => {
			if (err) throw err;
		});
	}

	private musicIsUnique(music: CompleteMusic): boolean {
		if (music.hash !== undefined && !this.musicHashIsUnique(music.hash)) {
			return false;
		}

		if (music.isUrl && music.uniqueId !== undefined && !this.musicUrlIsUnique(music.uniqueId)) {
			return false;
		}

		return true;
	}

	musicHashIsUnique(hash: number): boolean {
		let lastPlayed = this.musicHashes[hash];
		return !lastPlayed || lastPlayed + opt.musicUniqueCoolOff * 1000 <= new Date().getTime(); // can be so quick adjacent songs are recorded and played at the same time
	}

	nextMusicPath(): string {
		return consts.dirs.music + this.idFactory.next();
	}

	nextPicPath(): string {
		return consts.dirs.pic + this.idFactory.next();
	}

	picHashIsUnique(hash: number): boolean {
		let lastPlayed = this.picHashes[hash];
		return !lastPlayed || lastPlayed + opt.imageUniqueCoolOff * 1000 <= new Date().getTime(); // can be so quick adjacent songs are recorded and played at the same time
	}

	playNext(): boolean {
		if (this.stop) return false;

		const contentData = this.playQueue.next();

		if (!contentData) {
			this.currentlyPlaying = null;
			this.emit("queue-empty");
			return false;
		}

		//double check the content is still unique, only checking music as it is the main feature
		if (!this.musicIsUnique(contentData.music)) {
			this.deleteContent(contentData);
			return this.playNext();
		}

		//play content

		this.currentlyPlaying = contentData;

		const timePlayedAt = Date.now();

		const musicLocation = contentData.music.stream ? contentData.music.url : contentData.music.path;
		const musicProc = this.startMusic(musicLocation, opt.timeout, contentData.startTime, contentData.endTime);

		musicProc.on("close", (code, signal) => { // runs before next call to playNext
			const secs = 1 + Math.ceil((Date.now() - timePlayedAt) / 1000); //seconds ran for, adds a little bit to prevent infinite <1 second content

			this.stopPic();
			this.deleteContent(contentData);
			this.currentlyPlaying = null;

			// save hashes if the music played for long enough
			if (secs > opt.tooShortToCauseCoolOff) this.remember(contentData);

			this.emit("end");
		});

		if (contentData.pic.exists) {
			const picPath = contentData.pic.path;
			const showPicture = (buf: any) => {
				//we want to play the picture after the video has appeared, which takes a long time when doing it remotely
				//so we have to check the output of mpv, for signs it's not just started up, but also playing :/
				if (buf.includes("AO") || buf.includes("VO")) {
					this.startPic(picPath, opt.timeout);
					musicProc.stdout.removeListener("data", showPicture); //make sure we only check for this once, for efficiency
				}
			};

			musicProc.stdout.on("data", showPicture);
		}

		this.logPlay(contentData);
		this.emit("queue-update");

		return true;
	}

	private publicify(item: ItemData): PublicItemData {
		const data: PublicItemData = {
			musicDownloadUrl: item.music.isUrl ? item.music.url : undefined,
			duration: item.duration,
			id: item.id,
			nickname: this.userRecord.getNickname(item.userId),
			title: item.music.title,
			userId: item.userId,
		};

		if (item.pic.exists) {
			data.image = {
				title: item.pic.title,
				url: item.pic.isUrl ? item.pic.url : undefined,
			};
		}

		return data;
	}

	purgeUser(uid: string) {
		this.playQueue.purge(uid);

		if (this.currentlyPlaying && this.currentlyPlaying.userId === uid) {
			this.killCurrent();
		}
	}

	remember(itemData: ItemData) {
		if (itemData.music.isUrl) {
			this.addUrlId(itemData.music.uniqueId);
		}

		if (itemData.music.hash) {
			this.addHash(itemData.music.hash);
		}

		if (itemData.pic.exists) {
			this.addPicHash(itemData.pic.hash);
		}
	}

	remove(contentId: number) {
		const itemData = this.playQueue.get(contentId);

		if (itemData) {
			this.deleteContent(itemData);
			this.playQueue.remove(contentId);
			this.emit("queue-update");

			return true;
		}

		return false;
	}

	startMusic(path: string, duration: number, startTime: number | null | undefined, endTime: number | null | undefined) {
		const args = [duration + "s", opt.mpvCommand, ...opt.mpvArgs, "--quiet", path];

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
		this.runningPicProc = cp.spawn("timeout", [duration + "s", opt.showImageCommand, path, ...opt.showImageArgs]);
	}

	stopPic() {
		if (this.runningPicProc) {
			this.runningPicProc.kill();
			this.runningPicProc = null;
		}
	}

	toJSON() {
		return JSON.stringify({
			playQueue: this.playQueue, //luckily this is jsonable
			hashes: this.musicHashes,
			picHashes: this.picHashes,
			ytIds: this.musicUrlRecord,
		});
	}

	private async tryQueue(someItemData: UploadDataWithIdTitleDuration) {
		try {
			const musicPrepProm = this.tryPrepMusic(
				someItemData.music,
				someItemData.id,
				someItemData.userId,
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
			if (!(err instanceof CancelError)) {
				this.progressQueue.finishedWithError(someItemData.userId, someItemData.id, err);
			}
		}
	}

	private async tryPrepMusic(music: MusicWithMetadata, cid: number, uid: string): Promise<CompleteMusic> {
		if (music.isUrl) {
			// Is it so big it should just be streamed?
			if (music.totalFileDuration > opt.streamOverDuration) {
				return {
					...music,
					hash: undefined,
					stream: true,
				};

			} else {
				const nmp = this.nextMusicPath();
				const st = new Date().getTime();

				await this.ytDownloader.new(cid, uid, music.title, music.url, nmp);

				// when download is completed, then
				// count how long it took
				const et = new Date().getTime();
				const dlTime = utils.roundDps((et - st) / 1000, 2);
				const ratio = utils.roundDps(music.totalFileDuration / dlTime, 2);

				//log the time taken to download
				console.log(`yt-dl vid (${music.uniqueId}) of length ${music.totalFileDuration}s took ${dlTime}s to download, ratio: ${ratio}`);

				//hash the music (async)
				const musicHash = await utils.fileHash(nmp);

				//this exists to prevent a YouTube video from
				//being downloaded by user and played, then played again by url
				//or being downloaded twice in quick succession
				if (this.musicHashIsUnique(musicHash)) {
					return {
						...{
							...music,
							path: nmp,
						},
						hash: musicHash,
						stream: false,
					};
				} else {
					throw new UniqueError(ContentType.Music);
				}
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
			pathOnDisk = this.nextPicPath();
			title = await downloadPic(pic.url, pathOnDisk);

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

	private musicUrlIsUnique(uniqueUrlId: string): boolean {
		const lastPlayed = this.musicUrlRecord[uniqueUrlId];

		// never played
		// or the current time is after the cooloff period
		return !lastPlayed || lastPlayed + opt.musicUniqueCoolOff * 1000 < new Date().getTime();
	}
}
