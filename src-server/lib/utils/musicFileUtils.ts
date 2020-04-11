import * as cp from "child_process";
import * as opt from "../../options";
import { DurationFindingError } from "../errors";

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

/**
 * @returns The duration of the given file in seconds. At least 1.
 */
export async function getFileDuration(filePath: string) {
	const ffProbeData = await getFFProbeFormatDataContainingDuration(filePath);
	const durationLine = ffProbeData.split("\n")[1];

	if (durationLine === undefined) throw new DurationFindingError();

	const secondsStr = durationLine.split("=")[1];

	if (secondsStr === undefined) throw new DurationFindingError();

	const seconds = parseFloat(secondsStr);

	return seconds < 1 ? 1 : seconds;
}
