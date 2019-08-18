import * as config from "../options";
import * as default_config from "./default_options";

class OptionsValidator {
    private expectedArrays: string[];
    private optionsToTest: any;
    private valid: boolean;
    private validPrimitives: { [key: string]: string; };

    constructor(
        optionsToTest: any,
        validPrimitives: {
            [key: string]: string
        },
        expectedArrays: string[]
    ) {
        this.expectedArrays = expectedArrays;
        this.optionsToTest = optionsToTest;
        this.valid = true;
        this.validPrimitives = validPrimitives;
    }

    public validate() {
        this.validatePrimitives();
        this.validateArrays();

        if (!this.valid) {
            process.exit(1);
        }
    }

    private validatePrimitives() {
        for (const key in this.validPrimitives) {
            if (typeof this.optionsToTest[key] !== this.validPrimitives[key]) {
                this.valid = false;
                console.error(`Error: "${key}" setting in options.js is not a "${this.validPrimitives[key]}".`);
            }
        }
    }

    private validateArrays() {
        for (const key of this.expectedArrays)  {
            if (!Array.isArray(this.optionsToTest[key])) {
                this.valid = false;
                console.error("Error: \"mpvArgs\" setting in options.js is not an array of string.");
            }
        }
    }
}

const combinedOptions = {
    ...default_config,
    ...config,
};

const validator = new OptionsValidator(
    combinedOptions,
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

validator.validate();

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
