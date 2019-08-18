import * as config from "../options";
import * as default_config from "./default_options";

class OptionsValidator {
    private expectedArrays: string[];
    private validPrimitives: { [key: string]: string; };

    constructor(
        validPrimitives: {
            [key: string]: string
        },
        expectedArrays: string[]
    ) {
        this.expectedArrays = expectedArrays;
        this.validPrimitives = validPrimitives;
    }

    public validate(optionsToTest: any): boolean {
        let valid = this.validatePrimitives(optionsToTest);

        return this.validateArrays(optionsToTest) && valid;
    }

    private validatePrimitives(optionsToTest: any): boolean {
        let valid = true;

        for (const key in this.validPrimitives) {
            if (typeof optionsToTest[key] !== this.validPrimitives[key]) {
                valid = false;
                console.error(`Error: "${key}" setting in options.js is not a "${this.validPrimitives[key]}".`);
            }
        }

        return valid;
    }

    private validateArrays(optionsToTest: any): boolean {
        let valid = true;

        for (const key of this.expectedArrays)  {
            if (!Array.isArray(optionsToTest[key])) {
                valid = false;
                console.error(`Error: "${key}" setting in options.js is not an array of string.`);
            }
        }

        return valid;
    }
}

const combinedOptions = {
    ...default_config,
    ...config,
};

const validator = new OptionsValidator(
    {
        httpPort: "number",
        webSocketPort: "number",
        imageUniqueCoolOff: "number",
        musicUniqueCoolOff: "number",
        streamYtOverDur: "number",
        timeout: "number",
        storageDir: "string",
        ffprobePath: "string",
        mpvPath: "string",
        youtubeDlPath: "string",
        dlPercentUpdateFreq: "number",
        imageSizeLimit: "number",
        musicSizeLimit: "number",
        nicknameSizeLimit: "number",
        fileNameSizeLimit: "number",
    },
    ["mpvArgs"]
);

if (!validator.validate(combinedOptions)) {
    process.exit(1);
}

export const dlPercentUpdateFreq: number = combinedOptions.dlPercentUpdateFreq;
export const fileNameSizeLimit: number = combinedOptions.fileNameSizeLimit;
export const ffprobePath: string = combinedOptions.ffprobePath;
export const httpPort: number = combinedOptions.httpPort;
export const imageSizeLimit: number = combinedOptions.imageSizeLimit;
export const imageUniqueCoolOff: number = combinedOptions.imageUniqueCoolOff;
export const mpvPath: string = combinedOptions.mpvPath;
export const mpvArgs: string[] = combinedOptions.mpvArgs;
export const musicSizeLimit: number = combinedOptions.musicSizeLimit;
export const musicUniqueCoolOff: number = combinedOptions.musicUniqueCoolOff;
export const nicknameSizeLimit: number = combinedOptions.nicknameSizeLimit;
export const timeout: number = combinedOptions.timeout;
export const storageDir: string = combinedOptions.storageDir;
export const streamYtOverDur: number = combinedOptions.streamYtOverDur;
export const webSocketPort: number = combinedOptions.webSocketPort;
export const youtubeDlPath: string = combinedOptions.youtubeDlPath;
