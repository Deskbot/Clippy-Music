module.exports = {
	timeout: 547,
	maxQueuedAtOnce: 4,
	storageDir: '/tmp/Clippy-Music-Tmp/',
	websocketPort: 8080,
	imageSizeLimit: 5000000,
	musicSizeLimit: 20000000,
	nicknameSizeLimit: 40,
	uniquenessCoolOff: 86400,
};

//password          = the admin password, null gives anyone access
//maxQueuedAtOnce   = the maximum number of tracks queued by each user
//timeout           = the maximum number of seconds a song can play for
//storageDir        = the location on disk where uploaded songs are stored, if a relative path is given, the directory will be relative to where the process was ran
//imageSizeLimit    = largest image that can be downloaded, locally or from the internet in bytes
//musicSizeLimit    = largest image that can be downloaded locally in bytes
//nicknameSizeLimit = maximum nickname length
//uniquenessCoolOff = how many seconds before it's ok to play the same music or show the same picture again. Can use Infinity for the duration to never expire, or -Infinity to never check for uniqueness