// execute `npm run build` after altering this file
// so that it can be used when the server is next started
// this also validates your configuration

export const config = {
	httpPort: 8080,

	// inbound and outbound
	webSocketPort: 8081,

	// the maximum duration of a single queue item, in seconds
	// and also the maximum amount of time a user can play for in a single bucket
	timeout: 597,

	// how long before the same music can be shown again, in seconds
	// Infinity = nothing can be played twice
	// 0 = never check for uniqueness
	musicUniqueCoolOff: 3600,

	// how long before the same overlay can be shown again, in seconds
	// Infinity = nothing can be played twice
	// 0 = never check for uniqueness
	overlayUniqueCoolOff: 3600,

	// videos longer than this in seconds will be streamed from YouTube and not downloaded first
	// (Long videos can take a while to download, regardless of what duration is played.)
	// (Streaming a video causes a small delay before playback begins.)
	streamOverDuration: 1200,

	// how frequently the download bar progress is updated
	dlPercentUpdateFreq: 250,

	// the location on disk where uploaded content is stored
	// A relative path will be relative to the working directory the server is ran from.
	storageDir: "/tmp/Clippy-Music-Tmp",

	ffprobeCommand: "ffprobe",
	mpvCommand: "mpv",
	mpvArgs: ["-fs", "--af=dynaudnorm"],
	showImageCommand: "eog",
	showImageArgs: ["-f"],
	youtubeDlCommand: "youtube-dl",

	// maximum uploadable file size, in bytes
	fileSizeLimit: 500000000,

	// maximum character length of nicknames
	nicknameSizeLimit: 67,

	// number of file name characters shown on front end
	fileNameSizeLimit: 57,

	// if a video is under this duration, identical content can be played within the cool-off period
	// used for debugging purposes
	tooShortToCauseCoolOff: 0,
};
