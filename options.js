module.exports = {
	httpPort: 8080,
	webSocketPort: 3000,

	dlPercentUpdateFreq: 2000,
	streamYtOverDur: 1200,
	timeout: 644,
	uniqueCoolOff: 86400,

	storageDir: '/tmp/Clippy-Music-Tmp',
	youtubeDlPath: 'youtube-dl',
	
	imageSizeLimit: 100000000,
	musicSizeLimit: 400000000,
	nicknameSizeLimit: 33,
	
};

//dlPercentUpdateFreq = how many milliseconds between updating the download percentage for videos on the front end
//imageSizeLimit      = largest image that can be downloaded locally or from the internet, in bytes
//musicSizeLimit      = largest image that can be downloaded locally, in bytes
//nicknameSizeLimit   = maximum nickname length
//storageDir          = the location on disk where uploaded content is stored, if a relative path is given, the directory will be relative to where the process was ran
//streamYtOverDur     = videos longer than this in seconds will be streamed from YouTube not downloaded first. (Long videos can take a while to download, even though a small fragment of them may be played; streaming a video causes a small delay between content.)
//timeout             = the maximum number of seconds content can play for
//uniquenessCoolOff   = how many seconds before it's ok to play the same music or show the same picture again. Can use Infinity for nothing to ever be played twice, or 0 to never check for uniqueness
