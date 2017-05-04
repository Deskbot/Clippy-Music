const bodyParser = require('body-parser')
const express = require('express');
const multer = require('multer');
const q = require('q');

const opt = require('../options.js');

const app = express();

const upload = multer({
	dest: opt.storageDir + '/uploadInitialLocation',
	fileFilter: (req, file, cb) => {
		const lhs = file.mimetype.split('/')[0];
		console.log(file.mimetype, lhs);
		if (lhs === 'audio' || lhs === 'video' || lhs === 'image') {
			cb(null, true);
		} else {
			cb(new Error(''), false);
		}
	},
	limit: opt.imageSizeLimit > opt.musicSizeLimit ? opt.imageSizeLimit : opt.musicSizeLimit,
});

app.use((req,res,next) => {console.log('something received');next()});
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
app.post('/api/upload', (req, res) => {

	new Promise(function(resolve, reject) {
		uploadMiddleware(req, res, function(err) {
			console.log('doing upload middleware');
			if (err) {
				console.log(err);
				reject(err.message);
			} else {
				resolve();
			}
		});
	}).then(function() {
		console.log("req body: ");
		console.log(req.body);

		const main = require('../main.js');
		if (main.banlist.contains(req.ip)) {
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
		};

		let url;

		if (url = req.body['music-url']) {
			uploadInfo.musicIsLocal = false;
			uploadInfo.musicUrl = url;
		} else {
			uploadInfo.musicIsLocal = true;
		}

		if (req.body['image-url'] || req.files['image-file']) {
			uploadInfo.hasAPic = true;

			if (url = req.body['image-url']) {
				uploadInfo.picIsLocal = false;
				uploadInfo.picUrl = url;
			} else {
				uploadInfo.picIsLocal = true;
			}

		} else {
			uploadInfo.hasAPic = false;
		}
		
		new Promise(function(resolve, reject) {
			if (uploadInfo.musicIsLocal || uploadInfo.picIsLocal) {
				console.log("files: ", (req.files));
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
				if (imageFile !== null) {
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

			main.contentManager.add(uploadInfo);
			res.status(202).end();

		}).catch((messages) => {
			console.error(messages);

			//do stuff about fails
			res.status(500).json({
				error: true,
				reasons: messages,
			});
		});
	}).catch((s) => {
		res.status(400).end(s);
		console.log("middleware error: " + s);
	});
});

app.post('/api/ban', (req, res) => {
	const main = require('../main.js');

	if (!opt.password || req.body.password === opt.password) {
		main.banlist.add(req.body.id);
	}

	res.status(200).end();
});

app.listen(80);

/*
/api/upload
	=> music-file
	=> music-url
	=> image-file
	=> image-url

	check user not at queue limit
		shove data in content manager upload queue (add)
		ws send problem if fail
		if success, broadcast queue update
	else
		ws.sendAtQLimit(uid)

//download music name if it's not known
//finish both downloads separately. Merge promises to add combined thing to the queue.
get music name

if validate input by at least 1 music /
	if validate by uniqueness /
		contentId = send to content manager
		get time /
		add to queue
		add to uniqueness tracker
	else
		return why fail
else
	return why fail
*/
