const opt = require('../options.js');
const fs = require('fs');

const banlistPath = opt.storageDir + 'banlist.json';

class Banlist {
	constructor() {
		this.list = [];
		
		if (fs.existsSync(banlistPath)) {
			try {
				const banlistJson = fs.readFileSync(banlistPath, {encoding: 'utf-8'});
				const banlist = JSON.parse(banlistJson);
				if (Array.isArray(banlist)) {
					this.list = banlist;
				}
			} catch (e) {
				if (e instanceof SyntaxError) {
					console.err.log('Syntax error found in banlist.json file.');
					console.err.log(e.message);
				} else {
					throw e;
				}
			}
		} else {
			console.log('No banlist file found. This is ok.');
		}
	}

	add(id) {
		this.list.push(id);
		this.store();
	}

	remove(id) {
		this.list.splice(this.list.indexOf(id), 1);//removes the first element that matches that id
		this.store();
	}

	contains(id) {
		return this.list.indexOf(id) !== -1;
	}

	store() {
		fs.writeFile(banlistPath, JSON.stringify(this.list));
	}
}

module.exports = Banlist;
