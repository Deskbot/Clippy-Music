import * as cp from "child_process";
import { Html5Entities } from "html-entities";
import * as debug from "./debug";
import * as opt from "../options";
import * as utils from "./utils/utils";
import { DurationFindingError } from "./errors";

export interface UrlMusicData {
	duration: number,
	id: string,
	hostname: string,
	title: string,
}

/**
 * Returns a promise that resolves with a string of this format:
 * [FORMAT]
 * duration=numberOfSeconds
 * [/FORMAT]
 */
function getFFProbeFormatDataContainingDuration(filePath: string): Promise<string> {
	return new Promise((resolve, reject) => {
		// -v error (high logging)
		// -show_entries format=duration (get the duration data)
		const proc = cp.spawn(opt.ffprobeCommand, ["-v", "error", "-show_entries", "format=duration", filePath]);

		let processOutput = "";
		let processErrorMessage = "";

		proc.stdout.on("data", (data) => {
			processOutput += data.toString();
		});

		proc.stderr.on("data", (data) => {
			processErrorMessage += data.toString();
		});

		proc.on("error", (err) => {
			reject(err);
		});

		proc.on("close", (code) => {
			if (code !== 0) {
				return reject(new DurationFindingError(processErrorMessage));
			} else {
				return resolve(processOutput);
			}
		});
	});
}


export function getFileDuration(filePath: string) {
	return getFFProbeFormatDataContainingDuration(filePath)
	.then((ffProbeData) => {
		const durationLine = ffProbeData.split("\n")[1];
		if (durationLine === undefined) throw new Error("");

		const secondsStr = durationLine.split("=")[1];
		if (secondsStr === undefined) throw new Error("");

		return parseFloat(secondsStr);
	});
}

export function getMusicInfoByUrl(url: string): Promise<UrlMusicData> {
	return new Promise(function (resolve, reject) {
		const infoProc = cp.spawn(opt.youtubeDlCommand, [
			"--no-playlist",
			"--get-title",
			"--get-id",
			"--get-duration",
			url
		]);
		let rawData = "";
		let rawError = "";

		infoProc.stdout.on("data", function (chunk) {
			rawData += chunk;
		});
		infoProc.on("error", function (message) {
			rawError += message;
		});
		infoProc.on("close", function (code, signal) {
			debug.error("yt-dl info getting error message:", rawError);

			const { hostname } = new URL(url);

			if (code === 0) {
				// the order of data array is independent of the argument order to youtube-dl
				const dataArr = rawData.split("\n");

				return resolve({
					duration: utils.ytDlTimeStrToSec(dataArr[2]),
					id: dataArr[1],
					hostname,
					title: new Html5Entities().encode(dataArr[0]),
				});
			}

			return reject(rawError);
		});
	});
}
