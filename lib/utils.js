const fs = require('fs');
const crc_32 = require('crc-32');
const opt = require('../options.js');

const Html5Entities = require('html-entities').Html5Entities;

const utils = {

	arrShuffle: (arr) => {
		let tmpItem, randIndex;

		for (let i = 0; i < arr.length; i++) {
			randIndex = Math.floor(Math.random() * arr.length);
			
			tmpItem = arr[i];
			arr[i] = arr[randIndex];
			arr[randIndex] = tmpItem;
		}

		return arr;
	},

	clone: (o) => {
		if (null == o || "object" != typeof o) return o;
		var copy = o.constructor();
		for (var attr in o) {
			if (o.hasOwnProperty(attr)) copy[attr] = o[attr];
		}
		return copy;
	},

	cloneWithout: (o, badAttrs) => {
		if (!Array.isArray(badAttrs)) badAttrs = [badAttrs];

		if (null == o || "object" != typeof o) return o;
		let copy = o.constructor();
		for (let attr in o) {
			if (!(badAttrs.includes(attr)) && o.hasOwnProperty(attr)) copy[attr] = o[attr];
		}
		return copy;
	},

	//based on alex030293's solution https://stackoverflow.com/questions/38485622/delete-folder-containing-files-node-js
	deleteDirRecursiveSync: (path) => {
		if(fs.existsSync(path)) {
			fs.readdirSync(path).forEach((file,index) => {
				var curPath = path + '/' + file;

				if(fs.lstatSync(curPath).isDirectory()) { //recurse
					utils.deleteDirRecursiveSync(curPath);
				} else { //delete file
					utils.deleteFileIfExistsSync(curPath);
				}
			});
		}
	},

	deleteFile: (path) => {
		fs.unlink(path, (err) => {
			if (err) {
				console.error('Attempt to delete file failed: ' + path + ' Error message:');
				console.error(err.message);
			}
		});
	},

	deleteFileIfExistsSync: (dir) => {
		try { fs.unlinkSync(dir); } catch(e) {}
	},

	extractYtVideoId: (s) => {
		let i = s.indexOf('?');
		s = s.substr(i);
		i = s.indexOf('?v=');
		if (i === -1) {
			i = s.indexOf('&v=');
			if (i === -1) return null;
		}
		s = s.substr(i + 3);
		i = s.indexOf('&');
		return s.substring(0, i === -1 ? s.length : i);
	},

	fileHash: (path) => {
		return new Promise((resolve, reject) => {
			fs.readFile(path, (err, data) => {
				if (err) reject(err);
				resolve(crc_32.buf(data));
			});
		});
	},

	keyList: (obj) => {
		const l = [];
		for (let key in obj) l.push(key);
		return l;
	},

	mkdirSafelySync: (path, mode) => {
		try { fs.mkdirSync(path, mode); } catch(e) {}
	},

	randIntBetween: (x,y) => { //can include x but not y. Integers only
		return x + Math.floor(Math.random() * (y-x));
	},

	reportError: (err) => {
		console.error(err);
	},

	roundDps: (num, places) => {
		const offset = Math.pow(2, places);
		return Math.round(num * offset) / offset;
	},

	sanitiseNickname: (nn) => {
		const nnDownToSize = nn.trim().substr(0, opt.nicknameSizeLimit);
		return Html5Entities.encode(nnDownToSize);
	},
	
	secToMinStr: (s) => {
		const mins = Math.floor(s/60);
		const secs = s % 60;
		return `${mins}m${secs}s`;
	},

	secToTimeStr: (s) => {
		const hours = Math.floor(s / 3600);
		const secsInHour = s % 3600;
		const mins = Math.floor(secsInHour / 60);
		const secs = s % 60;

		let str;
		str  = hours > 0 ? ' ' + hours + 'h' : '';
		str += mins  > 0 ? ' ' + mins  + 'm' : '';
		str += secs  > 0 ? ' ' + secs  + 's' : '';

		return str.trim();
	},

	//based on Hristo's solution that he got from somewhere else https://stackoverflow.com/questions/10420352/converting-file-size-in-bytes-to-human-readable
	sizeToReadbleStr: (s) => {
		if (s > 1000000000) return '~' + Math.ceil(s / 1000000000) + 'GB';
		if (s > 1000000)    return '~' + Math.ceil(s / 1000000)    + 'MB';
		if (s > 1000)       return '~' + Math.ceil(s / 1000000)    + 'kB';
		return s + 'B';
	},

	spread: (func) => {
		return (args) => {
			return func(...args);
		};
	},

	//altered version of: https://stackoverflow.com/a/18177235
	throttle: (interval, func) => {
		let lastCall = 0;
	    return () => {
	        let now = Date.now();
	        if (lastCall + interval < now) {
	            lastCall = now;
	            return func.apply(this, arguments);
	        }
	    };
	},

	//assume at most 2 colons
	timeCodeToNum: (s) => {
		const a = s.split(':');
		let t = 0;

		for (let i = 0; i < a.length; i++) {
			t += a[i] * Math.pow(60, a.length - 1 - i);
		}

		return t;
	},

	//altered version of https://stackoverflow.com/questions/10420352/converting-file-size-in-bytes-to-human-readable
	toShortSizeString: (fileSizeInBytes) => {
		var i = -1;
		var byteUnits = ['k', 'm', ' g', ' t', 'p', 'e', 'z', 'y'];
		do {
			fileSizeInBytes = fileSizeInBytes / 1024;
			i++;
		} while (fileSizeInBytes > 1024);

		return (Math.max(fileSizeInBytes, 0.1).toFixed(1) + byteUnits[i]);
	},

	valList: (obj) => {
		const l = [];
		for (let key in obj) l.push(obj[key]);
		return l;
	},

	ytTimeStrToSec: (str) => {
		let timeArr = str.split(':');
		if (timeArr.length === 1)      return parseInt(str);
		else if (timeArr.length === 2) return timeArr[0] * 60 + parseInt(timeArr[1]);
		else if (timeArr.length === 3) return timeArr[0] * 3600 + timeArr[1] * 60 + parseInt(timeArr[2]);
		else throw `Unable to convert yt time, ${str}, to seconds.`;
	},
};

module.exports = utils;