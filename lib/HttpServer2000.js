const main = require('../main.js');

const bodyParser = require('body-parser')
const express = require('express');
const formidable = requrie('formidable');
const q = require('q');

const app = express();

app.use('/', express.static('../static')); //default index is index.html
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
	extended: true
}));

/* Post variables
	* music-file
	* music-url
	* image-file
	* image-url
 */
app.post('/api/upload', formidable, (req, res) => {
	const uploadInfo = {
		userId: req.ip,
	};

	if (let url = req.body['music-url']) {
		uploadInfo.musicIsLocal = false;
		uploadInfo.musicUrl = url;
	} else {
		uploadInfo.musicIsLocal = true;
	}

	if (req.body['hasAPic']) {
		uploadInfo.hasAPic = true;

		if (let url = req.body['image-url']) {
			uploadInfo.picIsLocal = false;
			uploadInfo.picUrl = url;

		} else if () {
			uploadInfo.picIsLocal = true;
		}

	} else {
		uploadInfo.hasAPic = true;
	}

	new Promise(function(resolve, reject) {
		if (uploadInfo.musicIsLocal || uploadInfo.picIsLocal) {
			let form = new formidable.IncomingForm();
			form.parse(req, function(err, fields, files) {
				
				//music
				var old_path = files.music.path,
				ext = files.music.name.split('.').pop(),
				index = old_path.lastIndexOf('/') + 1,
				file_name = old_path.substr(index);

				uploadInfo.musicTitle = file_name;
				uploadInfo.musicPath = old_path;

				//picture
				old_path = files.music.path;
				ext = files.music.name.split('.').pop();
				index = old_path.lastIndexOf('/') + 1;
				file_name = old_path.substr(index);

				uploadInfo.picTitle = file_name;
				uploadInfo.picPath = old_path;

				resolve();
			});
		}
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

		res.status(200);
	}).catch(() => {
		//do stuff about fails
		res.status(500);
	});
	
});

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

/api/ban
	=> id

	add to banlist