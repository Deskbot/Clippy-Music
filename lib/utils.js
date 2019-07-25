const crc_32 = require('crc-32');
const fs = require('fs');
const Html5Entities = require('html-entities').Html5Entities;
const Url = require('url-parse');

const opt = require('../options.js');

const utils = {

	arrFirstMatch: (arr, f) => {
		for (let e of arr) {
			if (f(e)) return e;
		}
	},

	arrRemoveMany: (arr, l) => {
		l.sort().reverse();

		l.forEach((arrI) => {
			arr.splice(arrI, 1);
		});

		return arr;
	},

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

	arrSum: (a) => {
		return a.reduce((n, p) => n + p);
	},

	asciiOnly: (str) => {
		return str.replace(/[^\x00-\x7F]/g, '');
	},

	clone: (o) => {
		if (null == o || "object" != typeof o) return o;
		let copy = o.constructor();
		for (let attr in o) {
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
				const curPath = path + '/' + file;

				if (fs.lstatSync(curPath).isDirectory()) { //recurse
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

	deleteFileIfExists: (dir) => {
		fs.unlink(dir, utils.doNothing);
	},

	deleteFileIfExistsSync: (dir) => {
		try { fs.unlinkSync(dir); } catch(e) {}
	},

	doNothing: () => {},

	extractYtVideoId: (s) => {
		const urlObj = new Url(s, true);

		if (urlObj.hostname.includes('youtu.be')) { // shortened YouTube url
			const pathParts = urlObj.pathname.split('/');
			return utils.arrFirstMatch(pathParts, (part) => part.length !== 0);
		} else {
			return urlObj.query.v;
		}
	},

	fileHash: (path) => {
		return new Promise((resolve, reject) => {
			fs.readFile(path, (err, data) => {
				if (err) return reject(err);
				return resolve(crc_32.buf(data));
			});
		});
	},

	keyList: (obj) => {
		const l = [];
		for (let key in obj) l.push(key);
		return l;
	},

	looksLikeIpAddress: (str) => {
		// ipv6 matches 3 or more 0-4 digit hexadecimal numbers separated by colons,
		// potentially followed by an IPV4 address
		// ipv4 matches 3 or more 1-3 digit numbers separated by dots
		const ipv6 = /^(\s)*[0-9a-fA-F]{0,4}(:[0-9a-fA-F]{0,4}){2,}([0-9]{1,3}(.[0-9]{1,3}){2,})?(\s)*$/g;
		const ipv4 = /^(\s)*[0-9]{1,3}(.[0-9]{1,3}){2,}(\s)*$/g;
		return str.match(ipv6) !== null || str.match(ipv4) !== null; // there is a match
	},

	mkdirSafelySync: (path, mode) => {
		try { fs.mkdirSync(path, mode); } catch(e) {}
	},

	randIntBetween: (x,y) => { //can include x but not y. Integers only
		return x + Math.floor(Math.random() * (y-x));
	},

	randUpTo: (n) => {
		return Math.floor(Math.random() * n);
	},

	reportError: (err) => {
		console.error(err);
	},

	roundDps: (num, places) => {
		const offset = Math.pow(2, places);
		return Math.round(num * offset) / offset;
	},

	sanitiseFilename: (name) => {
		const trimmed = name.substr(0, opt.fileNameSizeLimit).trim(); // trim after because the string could be long
		const noUnicode = utils.asciiOnly(trimmed);
		return Html5Entities.encode(noUnicode);
	},

	sanitiseNickname: (nn) => {
		const trimmed = nn.trim().substr(0, opt.nicknameSizeLimit); // trim first to have as many chars as possible
		const noUnicode = utils.asciiOnly(trimmed);
		return Html5Entities.encode(noUnicode);
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

	zip: (a1, a2) => {
		const a = [];
		for (let i = 0; i < Math.max(a1.length, a2.length); i++) {
			a[i] = [a1[i], a2[i]];
		}
		return a;
	}
};

module.exports = utils;