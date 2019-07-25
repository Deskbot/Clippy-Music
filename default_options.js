module.exports = {
	httpPort: 8080,
	webSocketPort: 3000,

	imageUniqueCoolOff: 3600,
	musicUniqueCoolOff: 3600,
	streamYtOverDur: 1200,
	timeout: 644,

	storageDir: '/tmp/Clippy-Music-Tmp',

	ffprobePath: 'ffprobe',
	mpvPath: 'mpv',
	mpvArgs: ['-fs', '--af=dynaudnorm'],
	youtubeDlPath: 'youtube-dl',

	dlPercentUpdateFreq: 2000,
	imageSizeLimit: 100000000,
	musicSizeLimit: 400000000,
	nicknameSizeLimit: 67,
	fileNameSizeLimit: 57,
};

//imageUniqueCoolOff  = how many seconds before it's ok to play the same music again. Can use Infinity for nothing to ever be played twice, or 0 to never check for uniqueness
//musicUniqueCoolOff  = how many seconds before it's ok to show the same picture again. Can use Infinity for nothing to ever be played twice, or 0 to never check for uniqueness
//streamYtOverDur     = videos longer than this in seconds will be streamed from YouTube not downloaded first. (Long videos can take a while to download, even though a small fragment of them may be played; streaming a video causes a small delay between content.)
//timeout             = the maximum number of seconds content can play for
//storageDir          = the location on disk where uploaded content is stored, if a relative path is given, the directory will be relative to where the process was ran
//dlPercentUpdateFreq = how many milliseconds between updating the download percentage for videos on the front end
//imageSizeLimit      = largest image file that can be downloaded, in bytes
//musicSizeLimit      = largest music file that can be downloaded, in bytes
//nicknameSizeLimit   = maximum nickname length
//fileNameSizeLimit   = number of file name characters shown on front end