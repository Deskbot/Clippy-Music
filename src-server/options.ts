import { config } from "./user-config";
import { TypedEmitter } from "./lib/utils/TypedEmitter";
import { EventEmitter } from "events";

interface ChangeableConfig<T> {
	get(): T;
	set(value: T): void;
}

class Wrapper<T> implements ChangeableConfig<T> {

	constructor(
		private value: T
	) {}

	get(): T {
		return this.value;
	}

	set(value: T) {
		this.value = value;
	}
}


/**
 * The timeout of an individual item must not be longer than a bucket length.
 * Otherwise an item longer than a bucket can not be trimmed to fit in a bucket.
 */
class TimeoutWrapper implements ChangeableConfig<number> {

	constructor(
		private timeout: number,
		private bucketTime: BucketTimeWrapper
	) {}

	get(): number {
		return Math.min(this.timeout, this.bucketTime.get());
	}

	set(newTimeout: number) {
		this.timeout = Math.min(newTimeout, this.bucketTime.get());
	}
}

interface TimeoutWrapperEvents {
	change: (timeout: number) => void;
}

class BucketTimeWrapper extends (EventEmitter as TypedEmitter<TimeoutWrapperEvents>) implements ChangeableConfig<number> {

	constructor(
		private value: number
	) {
		super();
	}

	get(): number {
		return this.value;
	}

	set(value: number) {
		this.value = value;
		this.emit("change", this.value);
	}
}

// const types are given explicitly because the values in config are inferred from user input
export const dlPercentUpdateFreq: number = config.dlPercentUpdateFreq;
export const fileNameSizeLimit: number = config.fileNameSizeLimit;
export const ffprobeCommand: string = config.ffprobeCommand;
export const httpPort: number = config.httpPort;
export const showImageArgs: string[] = config.showImageArgs;
export const showImageCommand: string = config.showImageCommand;
export const mpvCommand: string = config.mpvCommand;
export const mpvArgs: string[] = config.mpvArgs;
export const fileSizeLimit: number = config.fileSizeLimit;
export const nicknameSizeLimit: number = config.nicknameSizeLimit;
export const storageDir: string = config.storageDir;
export const streamOverDuration: number = config.streamOverDuration;
export const tooShortToCauseCoolOff: number = config.tooShortToCauseCoolOff;
export const webSocketPort: number = config.webSocketPort;
export const youtubeDlCommand: string = config.youtubeDlCommand;

// changeable at runtime
export const bucketTime: BucketTimeWrapper = new BucketTimeWrapper(config.bucketTime);
export const musicUniqueCoolOff: Wrapper<number> = new Wrapper(config.musicUniqueCoolOff);
export const overlayUniqueCoolOff: Wrapper<number> = new Wrapper(config.overlayUniqueCoolOff);
export const timeout: TimeoutWrapper = new TimeoutWrapper(config.timeout, bucketTime);

// non user-config
// changeable at runtime
export const mute: Wrapper<boolean> = new Wrapper(false);
