import * as express from 'express';
import * as formidable from 'formidable';
import * as q from 'q';

import { ContentManagerService as ContentService } from './ContentService.js';
import { IdFactoryService } from './IdFactoryService.js';
import { ProgressQueueService } from './ProgressQueueService.js';
import { PasswordService } from './PasswordService.js';
import { UserRecordService } from './UserRecordService.js';
import { WebSocketService } from './WebSocketService.js';

import * as consts from '../lib/consts.js';
import * as debug from '../lib/debug.js';
import * as time from '../lib/time.js';
import * as opt from '../../options.js';
import * as utils from '../lib/utils.js';

import { getFileDuration } from '../lib/music.js';
import { BannedError, FileUploadError, UniqueError, YTError } from '../lib/errors.js';
import { UploadData } from '../types/UploadData';

type RequestWithFormData = express.Request & {
	fields: formidable.Fields;
	files: formidable.Files;
};

function adminMiddleware(req, res, next) {
	if (!PasswordService.isSet()) {
		res.status(400).end('The admin controls can not be used because no admin password was set.\n');
	} else if (!PasswordService.get().verify(req.fields.password)) {
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
		ProgressQueueService.setTitle(req.ip, contentId, file.name);

		const updater = ProgressQueueService.createUpdater(req.ip, contentId);

		return (sofar, total) => {
			updater(sofar / total);
		};
	}

	//pass along results and errors unaffected by internal error handling
	return getFileForm(req, generateProgressHandler);
}

function handlePotentialBan(userId) {
	return new Promise((resolve, reject) => {
		if (UserRecordService.isBanned(userId)) {
			WebSocketService.sendBanned(UserRecordService.getSockets(userId));
			return reject(new BannedError());
		}

		resolve();
	});
}

function makeImageTooBigError(files) {
	return new FileUploadError(`The image file you gave was too large (exceeded the limit of ${consts.imageSizeLimStr}).`, files);
}

function makeMusicTooBigError(files) {
	return new FileUploadError(`The music file you gave was too large (exceeded the limit of ${consts.musicSizeLimStr}).`, files);
}

function noRedirect(req) {
	return req.fields.ajax || req.headers['user-agent'].includes('curl');
}

function parseUploadForm(form, fields, files): Promise<UploadData> {
	return new Promise((resolve, reject) => {
		const uploadInfo: UploadData = {
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
			duration: null,
			startTime: null,
			endTime: null,
		};

		if (form.type != 'multipart') {
			throw new FileUploadError('Multipart form type required. Received "' + form.type + '" instead.', []);
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
				throw new FileUploadError('The server thinks you gave a music file but could not find it.', [musicFile, picFile]);
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
			uploadInfo.music.title = utils.sanitiseFilename(musicFile.name);
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
				uploadInfo.pic.title = utils.sanitiseFilename(picFile.name);

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
	if (!UserRecordService.isUser(req.ip)) UserRecordService.add(req.ip);

	const expiryDate = new Date();
	expiryDate.setFullYear(expiryDate.getFullYear() + 1);

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
	const contentId = IdFactoryService.new();

	handlePotentialBan(req.ip) //assumes ip address is userId
	.then(() => ProgressQueueService.add(req.ip, contentId))
	.then(() => handleFileUpload(req, contentId))
	.then(utils.spread((form, fields, files) => { //nesting in order to get the scoping right
		return parseUploadForm(form, fields, files)
		.then((uplData) => {
			uplData.id = contentId;
			uplData.userId = req.ip;

			if (uplData.music.isUrl) {
				ProgressQueueService.setTitle(req.ip, contentId, uplData.music.path, true);

				// the title and duration are set later by `ContentService.add(uplData)`

				return uplData;

			} else {
				// read the music file to determine its duration
				return getFileDuration(uplData.music.path)
					.then((duration) => {
						uplData.duration = time.clipTimeByStartAndEnd(Math.floor(duration), uplData.startTime, uplData.endTime);
						return uplData;
					})
					.catch((err) => {
						console.error("Error reading discerning the duration of a music file.", err, uplData.music.path);
						throw new FileUploadError(
							`I could not discern the duration of the music file you uploaded (${uplData.music.title}).`,
							Object.values(files)
						);
					});
			}
		})
		.then((uplData) => {
			return ContentService.add(uplData);
		})
		.then((uplData) => {
			if (uplData.music.isUrl) {
				ProgressQueueService.setTitle(req.ip, contentId, uplData.music.title);
			}

			debug.log("successful upload: ", uplData);

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
					if (file) utils.deleteFileIfExists(file.path); // might already have been deleted if url upload
				}

				delete err.files; // so they aren't sent to the user
			}

			res.status(400);
			ProgressQueueService.finishedWithError(req.ip, contentId, err);

		} else if (err instanceof BannedError) {
			res.status(400);

		} else if (err instanceof UniqueError) {
			res.status(400);
			ProgressQueueService.finishedWithError(req.ip, contentId, err);

		} else if (err instanceof YTError) {
			res.status(400);
			ProgressQueueService.finishedWithError(req.ip, contentId, err);

		} else {
			console.error('Unknown upload error: ', err);
			res.status(500);
			ProgressQueueService.finishedWithError(req.ip, contentId, err);
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
app.post('/api/queue/remove', (req: RequestWithFormData, res) => {
	if (ContentService.remove(req.ip, parseInt(req.fields['content-id'] as string))) {
		if (noRedirect(req)) res.status(200).end('Success\n');
		else                 res.redirect('/');
	} else {
		res.status(400).end('OwnershipError');
	}
});

//POST variable: content-id
app.post('/api/download/cancel', (req: RequestWithFormData, res) => {
	if (ProgressQueueService.cancel(req.ip, parseInt(req.fields['content-id'] as string))) {
		if (noRedirect(req)) res.status(200).end('Success\n');
		else                 res.redirect('/');
	} else {
		res.status(400).end('The download item specified was not recognised.\n');
	}
});

//POST variable: nickname
app.post('/api/nickname/set', recordUserMiddleware, (req: RequestWithFormData, res) => {
	const nickname = utils.sanitiseNickname(req.fields.nickname);

	if (nickname.length === 0) {
		res.status(400).end('Empty nicknames are not allowed.');
		return;
	}

	// check sanitised version because that's what admins will see
	if (utils.looksLikeIpAddress(nickname)) {
		res.status(400).end('Your nickname can not look like an IP address.');
		return;
	}

	UserRecordService.setNickname(req.ip, nickname);
	WebSocketService.sendNicknameToUser(req.ip, nickname);

	if (noRedirect(req)) res.status(200).end('Success\n');
	else                 res.redirect('/');
});

app.use(adminMiddleware);

//POST variable: password, id, nickname
app.post('/api/ban/add', (req: RequestWithFormData, res) => {
	if (req.fields.id) {
		if (!UserRecordService.isUser(req.fields.id)) {
			res.status(400).end('That user doesn\'t exist.\n');
			return;

		} else {
			UserRecordService.addBan(req.fields.id);
			ContentService.purgeUser(req.fields.id);
			if (noRedirect(req)) res.status(200).end('Success\n');
			else                 res.redirect('/');
		}

	} else if (req.fields.nickname) {
		const uids = UserRecordService.whoHasNickname(utils.sanitiseNickname(req.fields.nickname));

		if (uids.length === 0) {
			res.status(400).end('That user doesn\'t exist.\n');
			return;

		} else {
			uids.forEach((id) => {
				UserRecordService.addBan(id);
				ContentService.purgeUser(id);
			});

			if (noRedirect(req)) res.status(200).end('Success\n');
			else                 res.redirect('/');
		}

	} else {
		res.status(400).end('User not specified.\n');
	}
});

//POST variable: password, id
app.post('/api/ban/remove', (req: RequestWithFormData, res) => {
	if (req.fields.id) {
		if (!UserRecordService.isUser(req.fields.id)) {
			res.status(400).end('That user doesn\'t exist.\n');
			return;

		} else {
			UserRecordService.removeBan(req.fields.id);
			if (noRedirect(req)) res.status(200).end('Success\n');
			else                 res.redirect('/');
		}

	} else if (req.fields.nickname) {
		const uids = UserRecordService.whoHasNickname(utils.sanitiseNickname(req.fields.nickname));
		if (uids.length === 0) {
			res.status(400).end('That user doesn\'t exist.\n');
			return;

		} else {
			uids.forEach((id) => {
				UserRecordService.removeBan(id);
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
	ContentService.killCurrent();
	res.status(200).end('Success\n');
});

//POST variable: password
app.post('/api/skipAndPenalise', (req, res) => {
	if (ContentService.currentlyPlaying) {
		ContentService.penalise(ContentService.currentlyPlaying.userId);
	}

	ContentService.killCurrent();

	res.status(200).end('Success\n');
});

//POST variable: password
app.post('/api/skipAndBan', (req, res) => {
	if (ContentService.currentlyPlaying) {
		const id = ContentService.currentlyPlaying.userId;
		UserRecordService.addBan(id);
		ContentService.purgeUser(id);
	}

	ContentService.killCurrent();

	res.status(200).end('Success\n');
});

app.listen(opt.httpPort, (err) => {
	if (err) throw err;

	console.log('Web server started');
});