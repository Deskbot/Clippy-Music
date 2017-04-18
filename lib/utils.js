function clone(o) {
	if (null == o || "object" != typeof o) return o;
    var copy = o.constructor();
    for (var attr in o) {
        if (o.hasOwnProperty(attr)) copy[attr] = o[attr];
    }
    return copy;
}

function fileHash(path) {
	const file = fs.readFileSync(path);
	return crc_32.buf(file);
}

function secToMinStr(s) {
	const mins = Math.floor(s/60);
	const secs = s % 60;
	return `${mins}m${secs}s`;
}

function extractYtVideoId(s) {
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
}

module.exports = {
	clone: clone,
	extractYtVideoId: extractYtVideoId,
	fileHash: fileHash,
	secToMinStr: secToMinStr,
};
