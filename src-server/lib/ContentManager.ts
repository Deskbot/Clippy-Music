import * as cp from "child_process";
import { EventEmitter } from "events";
import { Html5Entities } from "html-entities";
import * as fs from "fs";

import * as consts from "../consts";
import * as debug from "../lib/utils/debug";
import * as utils from "./utils/utils";
import * as opt from "../options";
import * as time from "./time";

import { ContentPart } from "../types/ContentPart";
import { getMusicInfoByUrl, getFileDuration, UrlMusicData } from "./musicData";
import { CancelError, UniqueError, YTError, BadUrlError } from "./errors";
import { UploadDataWithId, UploadDataWithIdTitleDuration, MusicWithMetadata, OverlayMedium, UrlOverlay, FileOverlay, NoOverlay } from "../types/UploadData";
import { IdFactory } from "./IdFactory";
import { ItemData, CompleteMusic, CompleteOverlay, CompleteFileOverlay, CompleteUrlOverlay } from "../types/ItemData";
import { YtDlDownloader } from "./YtDlDownloader";
import { UserRecord } from "./UserRecord";
import { ProgressQueue, ProgressTracker } from "./ProgressQueue";
import { BarringerQueue, isSuspendedBarringerQueue } from "./queue/BarringerQueue";
import { PublicItemData } from "../types/PublicItemData";
import { canDownloadOverlayFromRawUrl, downloadOverlayFromRawUrl } from "./download";
import { startVideoOverlay, startImageOverlay, startMusic, doWhenMusicPlays as doWhenMusicStarts } from "./playMedia";

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
	private userRecord: UserRecord;
	private ytDlDownloader: YtDlDownloader;

	//processes
	private runningMusicProc: cp.ChildProcessWithoutNullStreams | null = null;
	private runningOverlayProc: cp.ChildProcessWithoutNullStreams | null = null;
	private currentlyPlaying: ItemData | null = null;

	private stop?: boolean;

	public emit(eventName: "end"): boolean;
	public emit(eventName: "queue-empty"): boolean;
	public emit(eventName: "queue-update"): boolean;
	public emit(eventName: string, ...args: any[]): boolean {
		return super.emit(eventName, ...args);
	}

	public on(eventName: "end", handler: () => void): this;
	public on(eventName: "queue-empty", handler: () => void): this;
	public on(eventName: "queue-update", handler: () => void): this;
	public on(eventName: string, handler: () => void): this {
		return super.on(eventName, handler);
	}

	constructor(
		maxTimePerBucket: number,
		startState: SuspendedContentManager | null,
		idFactory: IdFactory,
		userRecord: UserRecord,
		ytDlDownloader: YtDlDownloader
	) {
		super();

		this.idFactory = idFactory;
		this.userRecord = userRecord;
		this.ytDlDownloader = ytDlDownloader;

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

	async add(uplData: UploadDataWithId, progressTracker: ProgressTracker): Promise<UploadDataWithIdTitleDuration> {
		// awaits everything that needs to happen before http response
		const dataToQueue = await this.getDataToQueue(uplData);
		// don't wait for the actual queueing to finish
		this.tryQueue(dataToQueue, progressTracker).catch(utils.reportError);
		return dataToQueue;
	}

	private addMusicHash(hash: number) {
		this.musicHashes[hash] = new Date().getTime();
	}

	private addOverlayHash(hash: number) {
		this.overlayHashes[hash] = new Date().getTime();
	}

	private addUrlId(id: string) {
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

	private deleteContent(contentObj: ItemData) {
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
			throw new UniqueError(ContentPart.Music);
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

	private logPlay(contentData: ItemData) {
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

	private musicHashIsUnique(hash: number): boolean {
		let lastPlayed = this.musicHashes[hash];
		return !lastPlayed || lastPlayed + opt.musicUniqueCoolOff * 1000 <= new Date().getTime(); // can be so quick adjacent songs are recorded and played at the same time
	}

	private musicUrlIsUnique(uniqueUrlId: string): boolean {
		const lastPlayed = this.musicUrlRecord[uniqueUrlId];

		// never played
		// or the current time is after the cooloff period
		return !lastPlayed || lastPlayed + opt.musicUniqueCoolOff * 1000 < new Date().getTime();
	}

	private nextMusicPath(): string {
		return consts.dirs.music + this.idFactory.next();
	}

	private nextOverlayPath(): string {
		return consts.dirs.overlay + this.idFactory.next();
	}

	private overlayHashIsUnique(hash: number): boolean {
		let lastPlayed = this.overlayHashes[hash];
		return !lastPlayed || lastPlayed + opt.overlayUniqueCoolOff * 1000 <= new Date().getTime(); // can be so quick adjacent songs are recorded and played at the same time
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

		this.runningMusicProc = startMusic(musicLocation, opt.timeout, contentData.startTime, contentData.endTime);

		this.runningMusicProc.on("close", (code, signal) => { // runs before next call to playNext
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
				this.showImageOverlayWhenMusicPlays(path, this.runningMusicProc);
			} else if (contentData.overlay.medium === OverlayMedium.Video) {
				this.showVideoOverlayWhenMusicPlays(path, this.runningMusicProc);
			}
		}

		this.logPlay(contentData);
		this.emit("queue-update");

		return true;
	}

	private async prepFileOverlay(overlay: FileOverlay): Promise<CompleteFileOverlay> {
		return {
			...overlay,
			hash: await utils.fileHash(overlay.path),
		};
	}

	private prepNoOverlay(overlay: NoOverlay): CompleteOverlay {
		return {
			...overlay,
			hash: undefined,
		};
	}

	private async prepUrlOverlay(overlay: UrlOverlay, contentId: number, userId: string, progressTracker: ProgressTracker): Promise<CompleteUrlOverlay> {
		const pathOnDisk = this.nextOverlayPath();

		let title: string;
		let medium: OverlayMedium;

		try {
			[title, medium] = await canDownloadOverlayFromRawUrl(overlay.url);
			await downloadOverlayFromRawUrl(overlay.url, pathOnDisk);
		} catch (err) {
			if (err instanceof BadUrlError) { // can't get the resource from the file directly, so try youtube-dl
				try {
					title = (await getMusicInfoByUrl(overlay.url)).title;
				} catch (err) { // can't get the info needed to try youtube-dl, so give up
					throw new BadUrlError(ContentPart.Overlay, overlay.url);
				}

				const [downloadedPromise, cancel] = this.ytDlDownloader.new(contentId, userId, overlay.url, pathOnDisk);

				progressTracker.addCancelFunc(cancel);
				await downloadedPromise;
				progressTracker.removeCancelFunc(cancel);

				medium = OverlayMedium.Video;
			} else {
				throw err;
			}
		}

		const hash = await utils.fileHash(pathOnDisk);

		return {
			...overlay,
			hash,
			medium,
			path: pathOnDisk,
			title,
		};
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

	private remember(itemData: ItemData) {
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

	private showImageOverlayWhenMusicPlays(path: string, musicProc: cp.ChildProcessWithoutNullStreams) {
		doWhenMusicStarts(musicProc, () => {
			this.runningOverlayProc = startImageOverlay(path, opt.timeout);
		});
	}

	private showVideoOverlayWhenMusicPlays(path: string, musicProc: cp.ChildProcessWithoutNullStreams) {
		doWhenMusicStarts(musicProc, () => {
			this.runningOverlayProc = startVideoOverlay(path, opt.timeout);
		});
	}

	private stopMusic() {
		if (this.runningMusicProc) {
			this.runningMusicProc.kill();
		}
	}

	private stopOverlay() {
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

	private async tryQueue(someItemData: UploadDataWithIdTitleDuration, progressTracker: ProgressTracker) {
		try {
			const musicPrepProm = this.tryPrepMusic(
				someItemData.music,
				someItemData.id,
				someItemData.userId,
				progressTracker,
			);

			// if the overlay fails, make sure any yt download is stopped
			const overlayPrepProm = this.tryPrepOverlay(someItemData.overlay, someItemData.id, someItemData.userId, progressTracker);

			const [ music, overlay ] = await Promise.all([musicPrepProm, overlayPrepProm]);

			const itemData = {
				...someItemData,
				music,
				overlay,
			};

			this.playQueue.add(itemData);
			progressTracker.finished();
			this.emit("queue-update");

		} catch (err) {
			const notCancelled = !(err instanceof CancelError);
			if (notCancelled) {
				progressTracker.finishedWithError(err);
				debug.log(`Cancelling ${someItemData.id} due to a failure while trying to queue the media.`);
				progressTracker.cancel();
			}
		}
	}

	private async tryPrepMusic(music: MusicWithMetadata, contentId: number, userId: string, progressTracker: ProgressTracker): Promise<CompleteMusic> {
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
				const [downloadPromise, cancel] = this.ytDlDownloader.new(contentId, userId, music.url, nmp);

				progressTracker.addCancelFunc(cancel);
				await downloadPromise;
				progressTracker.removeCancelFunc(cancel);

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
						...music,
						path: nmp,
						hash: musicHash,
						stream: false,
					};
				} else {
					throw new UniqueError(ContentPart.Music);
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
				throw new UniqueError(ContentPart.Music);
			}
		}
	}

	private async tryPrepOverlay(overlay: UrlOverlay | FileOverlay | NoOverlay, contentId: number, userId: string, progressTracker: ProgressTracker): Promise<CompleteOverlay> {
		if (!overlay.exists) {
			return this.prepNoOverlay(overlay);
		}

		// we may already have the image downloaded, but we always need to check the uniqueness
		let completeOveraly: CompleteFileOverlay | CompleteUrlOverlay;
		if (overlay.isUrl) {
			completeOveraly = await this.prepUrlOverlay(overlay, contentId, userId, progressTracker);
		} else {
			completeOveraly = await this.prepFileOverlay(overlay);
		}

		if (this.overlayHashIsUnique(completeOveraly.hash)) {
			return completeOveraly;
		} else {
			throw new UniqueError(ContentPart.Overlay);
		}
	}
}
