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
export const ffprobePath: string = config.ffprobePath;
export const httpPort: number = config.httpPort;
export const imageProgramArgs: string[] = config.imageProgramArgs;
export const imageProgramPath: string = config.imageProgramPath;
export const imageSizeLimit: number = config.imageSizeLimit;
export const imageUniqueCoolOff: number = config.imageUniqueCoolOff;
export const mpvPath: string = config.mpvPath;
export const mpvArgs: string[] = config.mpvArgs;
export const musicSizeLimit: number = config.musicSizeLimit;
export const musicUniqueCoolOff: number = config.musicUniqueCoolOff;
export const nicknameSizeLimit: number = config.nicknameSizeLimit;
export const timeout: number = config.timeout;
export const storageDir: string = config.storageDir;
export const streamYtOverDur: number = config.streamYtOverDur;
export const webSocketPort: number = config.webSocketPort;
export const youtubeDlPath: string = config.youtubeDlPath;

export const mute: Wrapper<boolean> = new Wrapper(false);

