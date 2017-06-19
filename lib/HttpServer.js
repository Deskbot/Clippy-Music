const bodyParser = require('body-parser')
const express = require('express');
const multer = require('multer');
const q = require('q');

const opt = require('../options.js');
const utils = require('./utils.js');

module.exports = {
	start: function(environmentData) {

		function recordUserMiddleware(req, res, next) {
			environmentData.userRecord.add(req.ip);
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

			/* Post variables
				* music-file
				* music-url
				* image-file
				* image-url
			 */
			const uploadMiddleware = upload.fields([{ name: 'music-file', maxCount: 1 }, { name: 'image-file', maxCount: 1 }]);

			app.post('/api/upload', recordUserMiddleware, (req, res) => {

				new Promise(function(resolve, reject) {
					uploadMiddleware(req, res, function(err) {
						if (err) {
							reject(err);
						} else {
							resolve();
						}
					});
				}).then(function() {
					const main = require('../main.js');
					if (environmentData.userRecord.isBanned(req.ip)) { //assumes ip is the userid
						main.sendBanned(req.ip);
						return;
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

					new Promise(function(resolve, reject) {
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

							uploadInfo.musicTitle = file_name;
							uploadInfo.musicPath = old_path;

							//picture
							if (imageFile != null) {
								old_path = imageFile.path;
								ext = imageFile.originalname.split('.').pop();
								index = old_path.lastIndexOf('/') + 1;
								file_name = imageFile.originalname;

								uploadInfo.picTitle = file_name;
								uploadInfo.picPath = old_path;
							}
						}

						resolve();

					}).then(() => {

						uploadInfo.deferred = q.defer(); //so that later we can get a callback for whether the upload was a success or fail

						uploadInfo.deferred.promise.then(
							() => {
								main.sendMessage(re.ip, 'I have queued your content successfully.');
							},
							(result) => {
								const probs = [];

								if (musicDlProblem) {
									probs.push('I was unable to download the music you requested.');
								}
								if (picDlProblem) {
									probs.push('I was unable to download the picture you requested.');
								}
								if (musicUniqueProblem) {
									probs.push('I was unable to play the music you requested because it has been played or queued recently.');
								}
								if (picUniqueProblem) {
									probs.push('I was unable to show the picture you requested it has been shown or queued recently.');
								}

								main.sendError(req.ip, 'upload', JSON.stringify(probs));
							}
						);

						return environmentData.contentManager.add(uploadInfo); 

					}).then(() => {
						res.redirect('/');

					}).catch((messages) => {
						console.error(messages);

						//do stuff about fails
						res.status(500).json({
							error: true,
							reasons: messages,
						}).end();
					});
				}).catch((err) => {
					console.error('Bad upload error: ', err);
					const musicSizeLimStr = utils.sizeToReadbleStr(opt.musicSizeLimit);
					const imageSizeLimStr = utils.sizeToReadbleStr(opt.imageSizeLimit);
					res.status(400).end(`Bad files given for upload. Files may be of incorrect type or over the size limit of ${musicSizeLimStr} for music and ${imageSizeLimStr} for images.`);
				});
			});

			app.post('/api/ban/add', (req, res) => {
				if (environmentData.adminPassword !== null && req.body.password === environmentData.adminPassword) {
					environmentData.userRecord.addBan(req.body.id);
				}

				res.status(200).end();
			});

			app.post('/api/ban/remove', (req, res) => {
				if (environmentData.adminPassword !== null && req.body.password === environmentData.adminPassword) {
					environmentData.userRecord.removeBan(req.body.id);
				}

				res.status(200).end();
			});

			app.post('/api/set-nickname', (req, res) => {
				if (!environmentData.userRecord.isUser(req.ip)) {
					environmentData.userRecord.add(req.ip);
				}

				environmentData.userRecord.setNickname(req.ip, req.body.nickname.substr(0, opt.nicknameSizeLimit));

				res.status(200).end();
			});

			app.listen(80, (err) => {
				if (err) return reject(err);

				console.log('Server started');
				resolve(app);
			});
		});
	}
};