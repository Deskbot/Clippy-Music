const express = require('express');
const formidable = require('formidable');
const Html5Entities = require('html-entities').Html5Entities;
const q = require('q');

const ContentServer = require('./ContentServer.js');
const PasswordServer = require('./PasswordServer.js');
const UserRecordServer = require('./UserRecordServer.js');
const WebSocketServer = require('./WebSocketServer.js');

const consts = require('../lib/consts.js');
const debug = require('../lib/debug.js');
const opts = require('../options.js');
const utils = require('../lib/utils.js');

function getFileForm(req) {
	return new Promise((resolve, reject) => {
		const form = new formidable.IncomingForm();
		form.multiples = true;
		form.uploadDir = opts.storageDir + consts.initialUploadDirName;

		form.parse(req, (err, fields, files) => {
			if (err) reject(err);
			resolve([form, fields, files]);
		});
	});
}

function getFormMiddleware(req, res, next) {
	const form = new formidable.IncomingForm();

	form.parse(req, (err, fields, files) => {
		if (err) {
			console.error('Unknown data submission error: ', err);
			res.status(500).end(err);
			
		} else {
			req.fields = fields;
			req.files = files;

			next();
		}
	});
}

function recordUserMiddleware(req, res, next) {
	if (!UserRecordServer.isUser(req.ip)) UserRecordServer.add(req.ip);

	const expiryDate = new Date();
	expiryDate.setYear(expiryDate.getYear() + 1901);

	//store user id in cookie
	res.cookie('id', req.ip, {
		encode: a => a,
		expires: expiryDate,
	});

	next();
}

const app = express();

app.use('/', express.static(__dirname + '/../static/'));

/* Post variables:
	* music-file (file)
	* music-url
	* image-file (file)
	* image-url
	* start-time
	* end-time
 */
app.post('/api/content/upload', recordUserMiddleware, (req, res) => {
	Promise.resolve()
	.then(handlePotentialBan)
	.then(() => getFileForm(req))
	.then(utils.spread((form, fields, files) => { //nesting in order to get the scoping right
		return parseForm(form, fields, files)
		.then(ContentServer.add)
		.then(() => {
			if (fields.ajax) res.status(200).end();
			else            res.redirect('/');
		})
	}))
	.catch((err) => {
		if (err instanceof FileUploadError) {
			debug.error(err);
			res.status(400).end(err);
		}
		else if (err instanceof BannedError) {
			res.status(400).end('You can not upload content because you are banned.');
		}
		else {
			console.error('Unknown upload error: ', err);
			res.status(500).end(err);
		}
	});

	//where clause
	function handlePotentialBan() {
		return new Promise((resolve, reject) => {
			if (UserRecordServer.isBanned(req.ip)) { //assumes ip is the userid
				WebSocketServer.sendBanned(UserRecordServer.getSockets(req.ip));
				reject(new BannedError());
			} else {
				resolve();
			}
		});
	}

	function parseForm(form, fields, files) {
		return new Promise((resolve, reject) => {
			const uploadInfo = {
				userId: req.ip,
				music: {
					isUrl: null,
					title: null,
					path: null,
				},
				pic: {
					exists: null,
					isUrl: null,
					title: null,
					path: null,
				},
				startTime: null,
				endTime: null,
			};

			const musicFileArr = files['music-file'];
			const picFileArr = files['image-file'];

			if (form.type != 'multipart') {
				throw new FileUploadError('Multipart form type required. Received "' + form.type + '" instead.', musicFileArr, picFileArr);
			}

			//music & video
			if (fields['music-url']) {
				uploadInfo.music.isUrl = true;
				uploadInfo.music.path = fields['music-url'];

			} else if (musicFileArr.length > 0) {
				const musicFile = utils.arrFirst(musicFileArr); //a problem was had with a previous form parser where it seems the 1 file wasn't always in index 0

				if (!musicFile) {
					const err = new FileUploadError('Music file expected but not found.', musicFileArr, picFileArr);
					console.error(err, musicFileArr);
					throw err;
				}

				//no file
				if (musicFile.size === 0) {
					throw new FileUploadError('No music file or URL given.', musicFileArr, picFileArr);
				}

				//file too big
				if (musicFile.size > opts.musicSizeLimit) {
					throw new FileUploadError(`Music file given was too big. It exceeded the limit of: "${consts.musicSizeLimStr}".`, musicFileArr, picFileArr);
				}

				//file wrong type
				const lhs = musicFile.type.split('/')[0];
				if (!(lhs === 'audio' || lhs === 'video')) {
					throw new FileUploadError(`Music file given was of the wrong type. Audio or video was expected; "${musicFile.type}" was received instead.`, musicFileArr, picFileArr);
				}

				//success
				uploadInfo.music.isUrl = false;
				uploadInfo.music.path = musicFile.path;
				uploadInfo.music.title = Html5Entities.encode(musicFile.name);
			}

			//pic
			if (fields['image-url']) {
				uploadInfo.pic.exists = true;
				uploadInfo.pic.isUrl = true;
				uploadInfo.pic.path = fields['image-url'];

			} else if (picFileArr.length > 0) {
				const picFile = utils.arrFirst(picFileArr); //a problem was had with a previous form parser where it seems the 1 file wasn't always in index 0

				if (!picFile) {
					const err = new FileUploadError('Image file expected but not found.', musicFileArr, picFileArr);
					console.error(err, picFileArr);
					throw err;
				}

				//no file
				if (picFile.size === 0) {
					throw new FileUploadError('No image file or URL given.', musicFileArr, picFileArr);
				}

				//file too big
				if (picFile.size > opts.imageSizeLimit) {
					throw new FileUploadError(`Image file given was too big. It exceeded the limit of: "${consts.imageSizeLimStr}".`, musicFileArr, picFileArr);
				}

				//file wrong type
				const lhs = picFile.type.split('/')[0];
				if (lhs === 'image') {
					throw new FileUploadError(`Image file given was of the wrong type. Image was expected; "${picFile.type}" was received instead.`, musicFileArr, picFileArr);
				}

				//success
				uploadInfo.pic.exists = true;
				uploadInfo.pic.isUrl = false;
				uploadInfo.pic.path = picFile.path;
				uploadInfo.pic.title = Html5Entities.encode(picFile.name);

			} else {
				uploadInfo.pic.exists = false;
			}

			let time;

			if (time = fields['start-time']) uploadInfo.startTime = time;
			if (time = fields['end-time'])   uploadInfo.endTime   = time;

			resolve(uploadInfo);
		})
		.catch((err) => {
			if (err instanceof FileUploadError) {
				for (let name in err.filesObj) {
					err.filesObj[name].forEach((file) => { utils.deleteFile(file.path) });
				}
			}
			throw err;
		});
	}
});

app.use(getFormMiddleware);

//POST variable: content-id
app.post('/api/content/remove', (req, res) => {
	if (!ContentServer.remove(req.ip, parseInt(req.fields['content-id']))) {
		res.status(400).end('The queue item you tried to remove was not chosen by you.');
	} else {
		if (req.fields.ajax) res.status(200).end();
		else               res.redirect('/');
	}
});

//POST variable: password, id
app.post('/api/ban/add', (req, res) => {
	if (AdminPassword.verify(req.fields.password)) {
		if (UserRecordServer.isUser(req.fields.id)) {
			UserRecordServer.addBan(req.fields.id);
			ContentServer.purgeUser(req.fields.id);
			if (req.fields.ajax) res.status(200).end('Success\n');
			else               res.redirect('/');

		} else {
			res.status(400).end('That user doesn\'t exist.\n');
		}
		
	} else {
		res.status(400).end('Admin password incorrect.\n');
	}
});

//POST variable: password, id
app.post('/api/ban/remove', (req, res) => {
	if (AdminPassword.verify(req.fields.password)) {
		if (UserRecordServer.isBanned(req.fields.id)) {
			UserRecordServer.removeBan(req.fields.id);
			if (req.fields.ajax) res.status(200).end('Success\n');
			else               res.redirect('/');

		} else {
			res.status(400).end('That user is not banned.\n');
		}
	} else {
		res.status(400).end('Admin password incorrect.\n');
	}
});

//POST variable: password
app.post('/api/content/kill', (req, res) => {
	if (AdminPassword.verify(req.fields.password)) {
		ContentServer.killCurrent();
		res.status(200).end('Success\n');
	} else {
		res.status(400).end('Admin password incorrect.\n');
	}
});

//POST variable: nickname
app.post('/api/nickname/set', recordUserMiddleware, (req, res) => {
	if (!UserRecordServer.isUser(req.ip)) {
		UserRecordServer.add(req.ip);
	}

	UserRecordServer.setNickname(req.ip, Html5Entities.encode(req.fields.nickname.substr(0, opts.nicknameSizeLimit)));

	if (req.fields.ajax) res.status(200).end();
	else                 res.redirect('/');
});

app.listen(opts.httpPort, (err) => {
	if (err) throw err;

	console.log('Web server started');
});

class BannedError extends Error {}

class FileUploadError extends Error {
	constructor(message, ...filesObj) {
		super(message);

		this.filesObj = filesObj;
	}
}