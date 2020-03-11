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
import { UploadDataWithId, UploadDataWithIdTitleDuration, NoOverlay, FileOverlay, UrlOverlay, MusicWithMetadata, OverlayMedium } from "../types/UploadData";
import { IdFactory } from "./IdFactory";
import { ItemData, CompleteMusic, CompleteOverlay } from "../types/ItemData";
import { YtDlDownloader } from "./YtDownloader";
import { UserRecord } from "./UserRecord";
import { ProgressQueue } from "./ProgressQueue";
import { BarringerQueue, isSuspendedBarringerQueue } from "./queue/BarringerQueue";
import { PublicItemData } from "../types/PublicItemData";
import { downloadImage } from "./download";

export interface SuspendedContentManager {
	playQueue: any;
	hashes: any;
	overlayHashes: any;
	ytIds: any;
}

export function isSuspendedContentManager(obj: any): obj is SuspendedContentManager {
	return "playQueue" in obj
		&& isSuspendedBarringerQueue(obj.playQueue)
		&& "hashes" in obj
		&& "overlayHashes" in obj
		&& "ytIds" in obj;
}

export class ContentManager extends EventEmitter {
	//data stores
	private playQueue: BarringerQueue;
	private musicHashes: {
		[hash: string]: number
	} = {};
	private overlayHashes: {
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
	private runningOverlayProc: cp.ChildProcess | null = null;
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
			this.overlayHashes = startState.overlayHashes;
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

	addMusicHash(hash: number) {
		this.musicHashes[hash] = new Date().getTime();
	}

	addOverlayHash(hash: number) {
		this.overlayHashes[hash] = new Date().getTime();
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
		if (contentObj.overlay.exists) utils.deleteFile(contentObj.overlay.path); //empty overlay files can be uploaded and will persist
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
			const uplDataWithDuration: UploadDataWithIdTitleDuration = {
				...uplData,
				music: {
					...uplData.music,
				},
				overlay: {
					...uplData.overlay,
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
		this.stopOverlay();
	}

	logPlay(contentData: ItemData) {
		const nickname = this.userRecord.getNickname(contentData.userId);
		const currentTime = new Date().toISOString();

		let overlayName;
		if (contentData.overlay.exists) {
			overlayName = new Html5Entities().decode(contentData.overlay.title);
		} else {
			overlayName = "no overlay";
		}

		const noHtmlEntityTitle = new Html5Entities().decode(contentData.music.title);

		//public log uses publicly facing info
		console.log(currentTime);
		console.log(`user   "${nickname}"`);
		console.log(`played "${noHtmlEntityTitle}"`);
		console.log(`with   "${overlayName}"`);

		//private log uses private facing info
		const message = currentTime + "\n" +
			`user   "${contentData.userId}\n"` +
			`played "${noHtmlEntityTitle}\n"` +
			`with   "${overlayName}\n"`;

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

	nextOverlayPath(): string {
		return consts.dirs.overlay + this.idFactory.next();
	}

	overlayHashIsUnique(hash: number): boolean {
		let lastPlayed = this.overlayHashes[hash];
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
		this.runningMusicProc = musicProc;

		musicProc.on("close", (code, signal) => { // runs before next call to playNext
			const secs = 1 + Math.ceil((Date.now() - timePlayedAt) / 1000); //seconds ran for, adds a little bit to prevent infinite <1 second content

			this.stopOverlay();
			this.deleteContent(contentData);
			this.currentlyPlaying = null;

			// save hashes if the music played for long enough
			if (secs > opt.tooShortToCauseCoolOff) {
				this.remember(contentData);
			}

			this.emit("end");
		});

		if (contentData.overlay.exists) {
			const path = contentData.overlay.path;

			if (contentData.overlay.medium === OverlayMedium.Image) {
				this.showImageWhileMusicIsPlaying(path, musicProc);
			}
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

		if (item.overlay.exists) {
			data.image = {
				title: item.overlay.title,
				url: item.overlay.isUrl ? item.overlay.url : undefined,
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
			this.addMusicHash(itemData.music.hash);
		}

		if (itemData.overlay.exists) {
			this.addOverlayHash(itemData.overlay.hash);
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

	private showImageWhileMusicIsPlaying(path: string, musicProc: cp.ChildProcessWithoutNullStreams) {
		const showOverlay = (buf: any) => {
			// we want to play the image after the video has appeared, which takes a long time when the video is remote
			// so we have to check the output of the mpv process for when it creates a window

			// Example mpv output. The lines beginning with square brackets only appear with `--msg-level=all=v`, which Clippy is not using.
			// ...
			// (+) Video --vid=1 (*) (h264 1920x1080 60.000fps)
			// (+) Audio --aid=1 --alang=eng (*) (opus 2ch 48000Hz)
			// [vo/gpu] Probing for best GPU context.
			// [vo/gpu/opengl] Initializing GPU context 'wayland'
			// [vo/gpu/opengl] Initializing GPU context 'x11egl'
			// [vo/gpu/x11] X11 opening display: :0
			// [vo/gpu/x11] X11 running at 2560x1440 (":0" => local display)
			// ...
			// AO: [pulse] 48000Hz stereo 2ch float
			// ...
			// VO: [gpu] 1920x1080 yuv420p
			// ...
			if (buf.includes("AO") || buf.includes("VO")) {
				this.startImage(path, opt.timeout);
				musicProc.stdout.removeListener("data", showOverlay); //make sure we only check for this once, for efficiency
			}
		};
		musicProc.stdout.on("data", showOverlay);
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

		return cp.spawn("timeout", args);
	}

	stopMusic() {
		if (this.runningMusicProc) this.runningMusicProc.kill();
	}

	startImage(path: string, duration: number) {
		this.runningOverlayProc = cp.spawn("timeout", [duration + "s", opt.showImageCommand, path, ...opt.showImageArgs]);
	}

	stopOverlay() {
		if (this.runningOverlayProc) {
			this.runningOverlayProc.kill();
			this.runningOverlayProc = null;
		}
	}

	toJSON() {
		const data: SuspendedContentManager = {
			hashes: this.musicHashes,
			overlayHashes: this.overlayHashes,
			playQueue: this.playQueue, //luckily this is jsonable
			ytIds: this.musicUrlRecord,
		};
		return JSON.stringify(data);
	}

	private async tryQueue(someItemData: UploadDataWithIdTitleDuration) {
		try {
			const musicPrepProm = this.tryPrepMusic(
				someItemData.music,
				someItemData.id,
				someItemData.userId,
			);

			// if the overlay fails, make sure any yt download is stopped
			const overlayPrepProm = this.tryPrepOverlay(someItemData.overlay).catch(err => {
				this.ytDownloader.tryCancel(someItemData.userId, someItemData.id);
				throw err;
			});

			const [ music, overlay ] = await Promise.all([musicPrepProm, overlayPrepProm]);

			const itemData = {
				...someItemData,
				overlay,
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

	private async tryPrepOverlay(overlay: NoOverlay | FileOverlay | UrlOverlay): Promise<CompleteOverlay> {
		if (!overlay.exists) {
			return {
				...overlay,
				hash: undefined,
			};
		}

		// we may already have the image downloaded, but we always need to check the uniqueness

		let pathOnDisk: string;
		let title: string;

		if (overlay.isUrl) {
			pathOnDisk = this.nextOverlayPath();
			title = await downloadImage(overlay.url, pathOnDisk);

		} else {
			pathOnDisk = overlay.path;
			title = overlay.title;
		}

		const overlayHash = await utils.fileHash(pathOnDisk);

		if (this.overlayHashIsUnique(overlayHash)) {
			return {
				...overlay,
				path: pathOnDisk,
				title,
				hash: overlayHash,
			};

		} else {
			throw new UniqueError(ContentType.Image);
		}
	}

	private musicUrlIsUnique(uniqueUrlId: string): boolean {
		const lastPlayed = this.musicUrlRecord[uniqueUrlId];

		// never played
		// or the current time is after the cooloff period
		return !lastPlayed || lastPlayed + opt.musicUniqueCoolOff * 1000 < new Date().getTime();
	}
}
