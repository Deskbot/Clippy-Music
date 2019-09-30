// execute `npm run build` after altering this file

export const config = {
	httpPort: 8080,

	// inbound and outbound
	webSocketPort: 3000,

	// how long before the same image can be shown again, in seconds
	// Infinity = nothing can be played twice
	// 0 = never check for uniqueness
	imageUniqueCoolOff: 3600,

	// how long before the same music can be shown again, in seconds
	// Infinity = nothing can be played twice
	// 0 = never check for uniqueness
	musicUniqueCoolOff: 3600,

	// videos longer than this in seconds will be streamed from YouTube and not downloaded first
	// (Long videos can take a while to download, regardless of what duration is played.)
	// (Streaming a video causes a small delay before playback begins.)
	streamYtOverDur: 1200,

	// the maximum duration of a single queue item, in seconds
	timeout: 644,

	// the location on disk where uploaded content is stored
	// A relative path will be relative to the working directory the server is ran from.
	storageDir: "/tmp/Clippy-Music-Tmp",

	imageProgramPath: "eog",
	imageProgramArgs: ["-f"],
	ffprobePath: "ffprobe",
	mpvPath: "mpv",
	mpvArgs: ["-fs", "--af=dynaudnorm"],
	youtubeDlPath: "youtube-dl",

	// how frequently the download bar progress is updated
	dlPercentUpdateFreq: 250,

	// maximum image file size, in bytes
	imageSizeLimit: 500000000,

	// maximum music file size, in bytes
	musicSizeLimit: 500000000,

	// maximum character length of nicknames
	nicknameSizeLimit: 67,

	// number of file name characters shown on front end
	fileNameSizeLimit: 57,

	// if a video is under this duration, identical content can be played within the cool-off period
	// used for debugging purposes
	tooShortToCauseCoolOff: 0,
};
