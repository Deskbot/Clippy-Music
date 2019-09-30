import { config } from "./user-config";

class Wrapper<T> {
	private value: T;

	constructor(value: T) {
		this.value = value;
	}

	get(): T {
		return this.value;
	}

	set(value: T) {
		this.value = value;
	}
}

export const dlPercentUpdateFreq: number = config.dlPercentUpdateFreq;
export const fileNameSizeLimit: number = config.fileNameSizeLimit;
export const ffprobeCommand: string = config.ffprobeCommand;
export const httpPort: number = config.httpPort;
export const showImageArgs: string[] = config.showImageArgs;
export const showImageCommand: string = config.showImageCommand;
export const imageSizeLimit: number = config.imageSizeLimit;
export const imageUniqueCoolOff: number = config.imageUniqueCoolOff;
export const mpvCommand: string = config.mpvCommand;
export const mpvArgs: string[] = config.mpvArgs;
export const musicSizeLimit: number = config.musicSizeLimit;
export const musicUniqueCoolOff: number = config.musicUniqueCoolOff;
export const nicknameSizeLimit: number = config.nicknameSizeLimit;
export const timeout: number = config.timeout;
export const storageDir: string = config.storageDir;
export const streamOverDuration: number = config.streamOverDuration;
export const tooShortToCauseCoolOff: number = config.tooShortToCauseCoolOff;
export const webSocketPort: number = config.webSocketPort;
export const youtubeDlCommand: string = config.youtubeDlCommand;

export const mute: Wrapper<boolean> = new Wrapper(false);
