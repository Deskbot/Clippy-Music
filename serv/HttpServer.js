const express = require('express');
const formidable = require('formidable');
const Html5Entities = require('html-entities').Html5Entities;
const q = require('q');

const ContentServer = require('./ContentServer.js');
const IdFactoryServer = require('./IdFactoryServer.js');
const ProgressQueueServer = require('./ProgressQueueServer.js');
const PasswordServer = require('./PasswordServer.js');
const UserRecordServer = require('./UserRecordServer.js');
const WebSocketServer = require('./WebSocketServer.js');

const consts = require('../lib/consts.js');
const debug = require('../lib/debug.js');
const opt = require('../options.js');
const utils = require('../lib/utils.js');

const { BannedError, FileUploadError, UniqueError, YTError } = require('../lib/errors.js');

function adminMiddleware(req, res, next) {
	if (!PasswordServer.isSet()) {
		res.status(400).end('The admin controls can not be used because no admin password was set.\n');
	} else if (!PasswordServer.get().verify(req.fields.password)) {
		res.status(400).end('Admin password incorrect.\n');
	} else {
		next();
	}
}

function getFileForm(req, generateProgressHandler) {
	const defer = q.defer();

	const form = new formidable.IncomingForm();
	form.maxFileSize = consts.biggestFileSizeLimit;
	form.uploadDir = consts.dirs.httpUpload;

	let lastFileField;
	let files = [];

	form.on('fileBegin', (fieldName) => {
		lastFileField = fieldName;
	});

	form.on('file', (fieldName, file) => {
		files.push(file);
	});

	form.on('error', (err) => {
		let fileError;

		if (lastFileField === 'music-file') {
			fileError = makeMusicTooBigError(files);
		}
		else if (lastFileField === 'image-file') {
			fileError = makeImageTooBigError(files);
		}
		else {
			fileError = err;
		}
		
		defer.reject(fileError);
	});

	form.parse(req, (err, fields, files) => {
		if (err) defer.reject(err);
		defer.resolve([form, fields, files]);
	});

	form.on('fileBegin', (fieldName, file) => {
		if (fieldName === 'music-file' && file && file.name) {
			const onProgress = generateProgressHandler(defer.promise, file);
			form.on('progress', onProgress);
		}
	});

	return defer.promise;
}

function getFormMiddleware(req, res, next) {
	const form = new formidable.IncomingForm();

	form.parse(req, (err, fields, files) => {
		if (err) {
			console.error('Unknown data submission error: ', err);
			res.status(500).end(err.message);
			
		} else {
			req.fields = fields;
			req.files = files;

			debug.log('fields', fields);

			next();
		}
	});
}

function handleFileUpload(req, contentId) {
	const generateProgressHandler = (promise, file) => {
		ProgressQueueServer.setTitle(req.ip, contentId, file.name);

		const updater = ProgressQueueServer.createUpdater(req.ip, contentId);

		return (sofar, total) => {
			updater(sofar / total);
		};
	}

	//pass along results and errors unaffected by internal error handling
	return getFileForm(req, generateProgressHandler);
}

function handlePotentialBan(userId) {
	return new Promise((resolve, reject) => {
		if (UserRecordServer.isBanned(userId)) {
			WebSocketServer.sendBanned(UserRecordServer.getSockets(userId));
			return reject(new BannedError());
		}

		resolve();
	});
}

function makeImageTooBigError(files) {
	return new FileUploadError(`The image file you gave was too big. It exceeded the limit of: "${consts.imageSizeLimStr}".`, files);
}

function makeMusicTooBigError(files) {
	return new FileUploadError(`The music file you gave was too big. It exceeded the limit of: "${consts.musicSizeLimStr}".`, files);
}

function noRedirect(req) {
	return req.fields.ajax || req.headers['user-agent'].includes('curl');
}

function parseUploadForm(form, fields, files) {
	return new Promise((resolve, reject) => {
		const uploadInfo = {
			music: {
				isUrl: null,
				title: null,
				path: null,
				stream: false,
			},
			pic: {
				exists: false,
				isUrl: null,
				title: null,
				path: null,
			},
			startTime: null,
			endTime: null,
		};

		if (form.type != 'multipart') {
			throw new FileUploadError('Multipart form type required. Received "' + form.type + '" instead.', [musicFile, picFile]);
		}

		const musicFile = files['music-file'];
		const picFile = files['image-file'];

		//music & video
		if (fields['music-url']) {
			uploadInfo.music.isUrl = true;
			uploadInfo.music.path = fields['music-url'];
			if (musicFile) utils.deleteFile(musicFile.path);

		} else {
			if (!musicFile) {
				const err = new FileUploadError('The server thinks you gave a music file but could not find it.', [musicFile, picFile]);
				throw err;
			}

			//no file
			if (musicFile.size === 0) {
				utils.deleteFile(musicFile.path); //empty file will still persist otherwise, due to the way multipart form uploads work / are handled
				throw new FileUploadError('No music file or URL given.', [musicFile, picFile]);
			}

			//file too big
			if (musicFile.size > opt.musicSizeLimit) {
				throw makeMusicTooBigError([musicFile, picFile]);
			}

			//file wrong type
			const mimetype = musicFile.type;
			const lhs = mimetype.split('/')[0];
			if (!(lhs === 'audio' || lhs === 'video' || mimetype === 'application/octet-stream')) { //audio, video, or default (un-typed) file
				throw new FileUploadError(`The audio or video file you gave was of the wrong type; "${musicFile.type}" was received instead.`, [musicFile, picFile]);
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

			if (picFile) utils.deleteFile(picFile.path);

		} else if (picFile) {
			if (picFile.size !== 0) { //file exists
				//file too big
				if (picFile.size > opt.imageSizeLimit) {
					throw makeImageTooBigError([musicFile, picFile]);
				}

				//file wrong type
				const lhs = picFile.type.split('/')[0];
				if (lhs !== 'image') {
					throw new FileUploadError(`The image file you gave was of the wrong type; "${picFile.type}" was received instead.`, [musicFile, picFile]);
				}

				//success
				uploadInfo.pic.exists = true;
				uploadInfo.pic.isUrl = false;
				uploadInfo.pic.path = picFile.path;
				uploadInfo.pic.title = Html5Entities.encode(picFile.name);
			
			} else { //empty picture given, as is typical with multipart forms where no picture is chosen
				utils.deleteFile(picFile.path);
			}
		} else { //no file or url
			uploadInfo.pic.exists = false;
		}

		let time;

		if (time = fields['start-time']) uploadInfo.startTime = time;
		if (time = fields['end-time'])   uploadInfo.endTime   = time;

		return resolve(uploadInfo);
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

//creation of express instance and attaching handlers

const app = express();

app.use('/', express.static(__dirname + '/../static/'));

app.use('/admin', express.static(__dirname + '/../static/index.html'));

app.use('/', (req, res, next) => {
	res.type('text/plain');
	next();
});

app.get('/api/wsport', (req, res) => {
	res.status(200).end(opt.webSocketPort.toString());
});

/* Post variables:
	* music-file (file)
	* music-url
	* image-file (file)
	* image-url
	* start-time
	* end-time
 */
app.post('/api/queue/add', recordUserMiddleware, (req, res) => {
	const contentId = IdFactoryServer.new();

	handlePotentialBan(req.ip) //assumes ip address is userId
	.then(() => ProgressQueueServer.add(req.ip, contentId))
	.then(() => handleFileUpload(req, contentId))
	.then(utils.spread((form, fields, files) => { //nesting in order to get the scoping right
		return parseUploadForm(form, fields, files)
		.then((uplData) => {
			if (uplData.music.isUrl) {
				ProgressQueueServer.setTitle(req.ip, contentId, uplData.music.path, true);
			}

			uplData.id = contentId;
			uplData.userId = req.ip;
			return ContentServer.add(uplData);
		})
		.then((uplData) => {
			if (uplData.music.isUrl) {
				ProgressQueueServer.setTitle(req.ip, contentId, uplData.music.title);
			}

			if (fields.ajax || req.headers['user-agent'].includes('curl')) {
				res.status(200).end('Success\n');
			} else {
				res.redirect('/');
			}
		});
	}))
	.catch((err) => {
		if (err instanceof FileUploadError) {
			debug.log("deleting these bad uploads: ", err.files);
			
			if (err.files) {
				for (let file of err.files) {
					if (file) return utils.deleteFile(file.path);
				}
			}

			res.status(400);
			ProgressQueueServer.finishedWithError(req.ip, contentId, err);

		} else if (err instanceof BannedError) {
			res.status(400);

		} else if (err instanceof UniqueError) {
			res.status(400);
			ProgressQueueServer.finishedWithError(req.ip, contentId, err);

		} else if (err instanceof YTError) {
			res.status(400);
			ProgressQueueServer.finishedWithError(req.ip, contentId, err);

		} else {
			console.error('Unknown upload error: ', err);
			res.status(500);
			ProgressQueueServer.finishedWithError(req.ip, contentId, err);
		}

		res.end(JSON.stringify({
			contentId,
			errorType: err.constructor.name,
			message: err.message,
		}));
	});
});

app.use(getFormMiddleware);

//POST variable: content-id
app.post('/api/queue/remove', (req, res) => {
	if (ContentServer.remove(req.ip, parseInt(req.fields['content-id']))) {
		if (noRedirect(req)) res.status(200).end('Success\n');
		else                 res.redirect('/');
	} else {
		res.status(400).end('OwnershipError');
	}
});

//POST variable: dl-index
app.post('/api/download/cancel', (req, res) => {
	if (ContentServer.cancelDownload(req.ip, parseInt(req.fields['dl-index']))) {
		if (noRedirect(req)) res.status(200).end('Success\n');
		else                 res.redirect('/');
	} else {
		res.status(400).end('The download item specified was not recognised.\n');
	}
});

//POST variable: nickname
app.post('/api/nickname/set', recordUserMiddleware, (req, res) => {
	const nickname = utils.sanitiseNickname(req.fields.nickname);

	if (nickname.length === 0) {
		res.status(400).end('Empty nicknames are not allowed.');
		return;
	}

	UserRecordServer.setNickname(req.ip, nickname);
	WebSocketServer.sendNicknameToUser(req.ip, nickname);
	
	if (noRedirect(req)) res.status(200).end('Success\n');
	else                 res.redirect('/');
});

app.use(adminMiddleware);

//POST variable: password, id, nickname
app.post('/api/ban/add', (req, res) => {
	if (req.fields.id) {
		if (!UserRecordServer.isUser(req.fields.id)) {
			res.status(400).end('That user doesn\'t exist.\n');
			return;

		} else {
			UserRecordServer.addBan(req.fields.id);
			ContentServer.purgeUser(req.fields.id);
			if (noRedirect(req)) res.status(200).end('Success\n');
			else                 res.redirect('/');
		}

	} else if (req.fields.nickname) {
		const uids = UserRecordServer.whoHasNickname(utils.sanitiseNickname(req.fields.nickname));
		
		if (uids.length === 0) {
			res.status(400).end('That user doesn\'t exist.\n');
			return;

		} else {
			uids.forEach((id) => {
				UserRecordServer.addBan(id);
				ContentServer.purgeUser(id);
			});
			
			if (noRedirect(req)) res.status(200).end('Success\n');
			else                 res.redirect('/');
		}

	} else {
		res.status(400).end('User not specified.\n');
	}
});

//POST variable: password, id
app.post('/api/ban/remove', (req, res) => {
	if (req.fields.id) {
		if (!UserRecordServer.isUser(req.fields.id)) {
			res.status(400).end('That user doesn\'t exist.\n');
			return;

		} else {
			UserRecordServer.removeBan(req.fields.id);
			if (noRedirect(req)) res.status(200).end('Success\n');
			else                 res.redirect('/');
		}

	} else if (req.fields.nickname) {
		const uids = UserRecordServer.whoHasNickname(utils.sanitiseNickname(req.fields.nickname));
		if (uids.length === 0) {
			res.status(400).end('That user doesn\'t exist.\n');
			return;

		} else {
			uids.forEach((id) => {
				UserRecordServer.removeBan(id);
			});
			
			if (noRedirect(req)) res.status(200).end('Success\n');
			else                 res.redirect('/');
		}

	} else {
		res.status(400).end('User not specified.\n');
	}
});

//POST variable: password
app.post('/api/skip', (req, res) => {
	ContentServer.killCurrent();
	res.status(200).end('Success\n');
});

//POST variable: password
app.post('/api/skipAndPenalise', (req, res) => {
	if (!PasswordServer.verify(req.fields.password)) {
		res.status(400).end('Admin password incorrect.\n');
		return;
	}

	if (ContentServer.currentlyPlaying) {
		ContentServer.penalise(ContentServer.currentlyPlaying.userId);
	}

	ContentServer.killCurrent();
	
	res.status(200).end('Success\n');
});

//POST variable: password
app.post('/api/skipAndBan', (req, res) => {
	if (!PasswordServer.verify(req.fields.password)) {
		res.status(400).end('Admin password incorrect.\n');
		return;
	}

	if (ContentServer.currentlyPlaying) {
		const id = ContentServer.currentlyPlaying.userId;
		UserRecordServer.addBan(id);
		ContentServer.purgeUser(id);
	}

	ContentServer.killCurrent();

	res.status(200).end('Success\n');
});

app.listen(opt.httpPort, (err) => {
	if (err) throw err;

	console.log('Web server started');
});