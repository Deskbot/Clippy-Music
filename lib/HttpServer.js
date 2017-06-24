const bodyParser = require('body-parser')
const express = require('express');
const Html5Entities = require('html-entities').Html5Entities;
const multer = require('multer');
const q = require('q');

const opt = require('../options.js');
const utils = require('./utils.js');

module.exports = {
	start: function(environ) {

		function recordUserMiddleware(req, res, next) {
			if (!environ.userRecord.isUser(req.ip)) environ.userRecord.add(req.ip);

			const expiryDate = new Date();
			expiryDate.setYear(expiryDate.getYear() + 1901);

			//store user id in cookie
			res.cookie('id', req.ip, {
				encode: a => a,
				expires: expiryDate,
			});

			next();
		};

		return new Promise((resolve, reject) => {
			const app = express();

			const upload = multer({
				dest: opt.storageDir + '/uploadInitialLocation',
				fileFilter: (req, file, cb) => {
					const lhs = file.mimetype.split('/')[0];

					if (lhs === 'audio' || lhs === 'video' || lhs === 'image') {
						cb(null, true);
					} else {
						cb(new Error(''), false);
					}
				},
				limit: opt.imageSizeLimit > opt.musicSizeLimit ? opt.imageSizeLimit : opt.musicSizeLimit,
			});

			app.use('/', express.static(__dirname + '/../static/'));
			app.use('/api/*', bodyParser.json());       // to support JSON-encoded bodies
			app.use('/api/*', bodyParser.urlencoded({   // to support URL-encoded bodies
				extended: true
			}));

			/* Post variables:
				* music-file
				* music-url
				* image-file
				* image-url
			 */
			const uploadMiddleware = upload.fields([{ name: 'music-file', maxCount: 1 }, { name: 'image-file', maxCount: 1 }]);

			//this is a bit messy but promises don't work quite how I'd like them to.
			app.post('/api/content/upload', recordUserMiddleware, (req, res) => {

				new Promise(function(resolve, reject) {
					uploadMiddleware(req, res, function(err) {
						if (err) {
							reject(new FileUploadError(err));
						} else {
							resolve();
						}
					});
				}).then(function() {
					const main = require('../main.js');
					if (environ.userRecord.isBanned(req.ip)) { //assumes ip is the userid
						main.sendBanned(req.ip);
						
						throw new BannedError();
					}

					const uploadInfo = {
						userId: req.ip,
						musicIsLocal: null,
						musicTitle: null,
						musicPath: null,
						musicUrl: null,
						picIsLocal: null,
						picTitle: null,
						picPath: null,
						picUrl: null,
						hasPic: null,
						startTime: null,
						endTime: null,
					};

					let url;

					if (url = req.body['music-url']) {
						uploadInfo.musicIsLocal = false;
						uploadInfo.musicUrl = url;
					} else {
						uploadInfo.musicIsLocal = true;
					}

					if (req.body['image-url'] || req.files['image-file']) {

						uploadInfo.hasPic = true;

						if (url = req.body['image-url']) {
							uploadInfo.picIsLocal = false;
							uploadInfo.picUrl = url;
						} else {
							uploadInfo.picIsLocal = true;
						}

					} else {
						uploadInfo.hasPic = false;
					}

					let startTime, endTime;

					if (startTime = req.body['start-time']) {
						uploadInfo.startTime = startTime;
					}

					if (endTime = req.body['end-time']) {
						uploadInfo.endTime = endTime;
					}

					return new Promise(function(resolve, reject) {
						if (uploadInfo.musicIsLocal || uploadInfo.picIsLocal) {
							const musicFile = req.files['music-file'] ? req.files['music-file'][0] : null;
							const imageFile = req.files['image-file'] ? req.files['image-file'][0] : null;

							//music
							if (musicFile != null) {
								var old_path = musicFile.path,
									ext = musicFile.originalname.split('.').pop(),
									index = old_path.lastIndexOf('/') + 1,
									file_name = musicFile.originalname;
							} else {
								reject('Video file was expected but not found. This shouldn\'t happen.');
							}

							uploadInfo.musicTitle = Html5Entities.encode(file_name);
							uploadInfo.musicPath = old_path;

							//picture
							if (imageFile != null) {
								old_path = imageFile.path;
								ext = imageFile.originalname.split('.').pop();
								index = old_path.lastIndexOf('/') + 1;
								file_name = imageFile.originalname;

								uploadInfo.picTitle = Html5Entities.encode(file_name);
								uploadInfo.picPath = old_path;
							}
						}

						resolve();

					}).then(() => {

						uploadInfo.deferred = q.defer(); //so that later we can get a callback for whether the upload was a success or fail

						uploadInfo.deferred.promise.then(() => {
							main.sendMessage(req.ip, 'upload', 'I have queued your content successfully.');
							if (main.wsServer) main.wsServer.sendQueue(main.userRecord.getSockets(req.ip));
						
						}).catch((result) => {
							main.sendError(req.ip, 'upload', {
								problems: result,
								uniquenessCooloff: utils.secToTimeStr(opt.uniquenessCoolOff),
							});
						
						}).catch((e) => {
							console.error(e);
						});

						return environ.contentManager.add(uploadInfo); 

					//this section regards the result of trying to add the data to the play queue
					}).then(() => {
						if (req.body.ajax) res.status(200).end();
						else               res.redirect('/');

					}).catch((messages) => {
						console.error(messages);

						//do stuff about fails
						res.status(400).end(messages);
					});
					
				}).catch((err) => {
					if (err instanceof FileUploadError) {
						const musicSizeLimStr = utils.sizeToReadbleStr(opt.musicSizeLimit);
						const imageSizeLimStr = utils.sizeToReadbleStr(opt.imageSizeLimit);
						res.status(400).end(`Bad file(s) given for upload. They may be of incorrect type or over the size limit of ${musicSizeLimStr} for music and ${imageSizeLimStr} for images.\n`);	
					}
					else if (err instanceof BannedError) {
						res.status(400).end('You can not upload content because you are banned.');
					}
					else {
						console.error('Unknown upload error: ', err);
						res.status(500).end(err);
					}
				});
			});

			app.post('/api/content/remove', (req, res) => {
				if (!environ.contentManager.remove(req.ip, req.body['content-id'])) {
					res.status(400).end('The queue item you tried to remove was not chosen by you.');
				} else {
					res.status(200).end();
				}
			});
	
			//POST vairable: password, id
			app.post('/api/ban/add', (req, res) => {
				if (environ.adminPassword !== null && req.body.password === environ.adminPassword) {
					if (environ.userRecord.isUser(req.body.id)) {
						environ.userRecord.addBan(req.body.id);
						environ.contentManager.purgeUser(req.body.id);
						res.status(200).end('Success\n');
					} else {
						res.status(400).end('That user doesn\'t exist.\n');
					}
					
				} else {
					res.status(400).end('Admin password incorrect.\n');
				}
			});

			//POST variable: password, id
			app.post('/api/ban/remove', (req, res) => {
				if (environ.adminPassword !== null && req.body.password === environ.adminPassword) {
					if (environ.userRecord.isBanned(req.body.id)) {
						environ.userRecord.removeBan(req.body.id);
						res.status(200).end('Success\n');
					} else {
						res.status(400).end('That user is not banned.\n');
					}
				} else {
					res.status(400).end('Admin password incorrect.\n');
				}
			});

			//POST variable: nickname
			app.post('/api/nickname/set', recordUserMiddleware, (req, res) => {
				if (!environ.userRecord.isUser(req.ip)) {
					environ.userRecord.add(req.ip);
				}

				environ.userRecord.setNickname(req.ip, Html5Entities.encode(req.body.nickname.substr(0, opt.nicknameSizeLimit)));

				if (req.body.ajax) res.status(200).end();
				else               res.redirect('/');
			});

			app.listen(80, (err) => {
				if (err) return reject(err);

				console.log('Server started');
				resolve(app);
			});
		});
	}
};

class BannedError extends Error {}
class FileUploadError extends Error {}