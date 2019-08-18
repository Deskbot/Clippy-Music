import { options } from "./user-options";

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

export const dlPercentUpdateFreq: number = options.dlPercentUpdateFreq;
export const fileNameSizeLimit: number = options.fileNameSizeLimit;
export const ffprobePath: string = options.ffprobePath;
export const httpPort: number = options.httpPort;
export const imageSizeLimit: number = options.imageSizeLimit;
export const imageUniqueCoolOff: number = options.imageUniqueCoolOff;
export const mpvPath: string = options.mpvPath;
export const mpvArgs: string[] = options.mpvArgs;
export const musicSizeLimit: number = options.musicSizeLimit;
export const musicUniqueCoolOff: number = options.musicUniqueCoolOff;
export const nicknameSizeLimit: number = options.nicknameSizeLimit;
export const timeout: number = options.timeout;
export const storageDir: string = options.storageDir;
export const streamYtOverDur: number = options.streamYtOverDur;
export const webSocketPort: number = options.webSocketPort;
export const youtubeDlPath: string = options.youtubeDlPath;

export const mute: Wrapper<boolean> = new Wrapper(false);

