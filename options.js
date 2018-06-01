module.exports = {
	httpPort: 8080,
	webSocketPort: 3000,
	timeout: 644,
	storageDir: '/tmp/Clippy-Music-Tmp',
	imageSizeLimit: 100000000,
	musicSizeLimit: 400000000,
	nicknameSizeLimit: 40,
	uniqueCoolOff: Infinity,
	streamYtOverDur: 1200, //20 minutes
};

//password          = the admin password, null gives anyone access
//timeout           = the maximum number of seconds content can play for
//storageDir        = the location on disk where uploaded content is stored, if a relative path is given, the directory will be relative to where the process was ran
//imageSizeLimit    = largest image that can be downloaded locally or from the internet, in bytes
//musicSizeLimit    = largest image that can be downloaded locally, in bytes
//nicknameSizeLimit = maximum nickname length
//uniquenessCoolOff = how many seconds before it's ok to play the same music or show the same picture again. Can use Infinity for nothing to ever be played twice, or 0 to never check for uniqueness
//streamYtOverDur   = videos longer than this in seconds will be streamed from YouTube not downloaded first. (Long videos can take a while to download, even though a small fragment of them may be played; streaming a video causes a small delay between content.)
