module.exports = {
	password: null,
	timeout: 547,
	maxQueuedAtOnce: 4,
	storageDir: '/tmp/The-Music-o-Matic-2000/',
	websocketPort: 8080,
	imageSizeLimit: 5000000,
	musicSizeLimit: 20000000,
};

//password         = the admin password, null gives anyone access
//maxQueuedAtOnce  = the maximum number of tracks queued by each user
//timeout          = the maximum number of seconds a song can play for
//storageDir       = the location on disk where uploaded songs are stored, if a relative path is given, the directory will be relative to where the process was ran
//imageSizeLimit   = largest image that can be downloaded, locally or from the internet
//musicSizeLimit   = largest image that can be downloaded locally