const fs = require('fs');
const crc_32 = require('crc-32');

module.exports = {
	arrShuffle: function arrShuffle(arr) {
		let tmpItem, randIndex;

		for (let i = 0; i < arr.length; i++) {
			randIndex = Math.floor(Math.random() * arr.length);
			
			tmpItem = arr[i];
			arr[i] = arr[randIndex];
			arr[randIndex] = tmpItem;
		}

		return arr;
	},

	clone: function clone(o) {
		if (null == o || "object" != typeof o) return o;
	    var copy = o.constructor();
	    for (var attr in o) {
	        if (o.hasOwnProperty(attr)) copy[attr] = o[attr];
	    }
	    return copy;
	},

	deleteFile: function deleteFile(path) {
		fs.unlink(path, (err) => {
			if (err) {
				console.err('Attempt to delete file failed: ' + path + ' Error message:');
				console.err(err.message);
			}
		});
	},

	extractYtVideoId: function extractYtVideoId(s) {
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

	fileHash: function fileHash(path) {
		const file = fs.readFileSync(path);
		return crc_32.buf(file);
	},
	
	secToMinStr: function secToMinStr(s) {
		const mins = Math.floor(s/60);
		const secs = s % 60;
		return `${mins}m${secs}s`;
	},

	secToTimeStr: function secToTimeStr(s) {
		const days = Math.floor(s / 86400);
		const secsInDay = s % 86400;
		const hours = Math.floor(secsInDay / 3600);

		let str = days > 0 ? days + 'd';
		str += hours > 0 ? ' ' + hours + 'h';
		str += ' ' + secToMinStr(secsInDay);
		return str.trim();
	},

	sizeToReadbleStr: function sizeToReadbleStr(s) {
		if (s > 1000000000) return '~' + Math.ceil(s / 1073741824) + 'GB';
		if (s > 1000000)    return '~' + Math.ceil(s / 1000000)    + 'MB';
		if (s > 1000)       return '~' + Math.ceil(s / 1000000)    + 'kB';
		return s + 'B';
	},	

	randIntBetween: function randIntBetween(x,y) { //can include x but not y. Integers only
		return x + Math.floor(Math.random() * (y-x));
	},

	ytTimeStrToSec: function ytTimeStrToSec(str) {
		let timeArr = str.split(':');
		if (timeArr.length === 2)      return timeArr[0] * 60 + parseInt(timeArr[1]);
		else if (timeArr.length === 3) return timeArr[0] * 3600 + timeArr[1] * 60 + parseInt(timeArr[2]);
		else throw `Unable to convert yt time, ${str}, to seconds.`;
	},
};
