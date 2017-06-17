const fs = require('fs');

const opt = require('../options.js');

const recordFilePath = opt.storageDir + 'suspendedUserRecord.json';

class UserRecord {
	constructor(startState) {
		this.idToUser = {}; //ip -> (nickname,soc)
		this.banlist = [];

		if (startState) {
			this.idToUser = startState.idToUser;
			this.banlist = startState.banlist;
		}
	}

	static recover() {
		//retreive suspended queue
		let obj, recordContent;
		let success = true;

		//I'm trying some weird control flow because I don't like try catch. Usually there's only 1 line you want to try and you don't want to assume something has been caught for the wrong reasons.
		try {
			success = true && success;
			recordContent = fs.readFileSync(recordFilePath);
			
		} catch (e) {
			success = false && success;
			console.log('No suspended user record found. This is ok.');
		}

		if (success) {
			console.log('Reading suspended user record');

			try {
				success = true && success;
				obj = JSON.parse(recordContent);
				
			} catch (e) {
				success = false && success;
				if (e instanceof SyntaxError) {
					console.error('Syntax error in suspendedUserRecord.json file.');
					console.error(e);
					console.error('Ignoring suspended content manager');
				} else {
					throw e;
				}
			}
		}

		return success ? obj : null;
	}

	static get suspendedFilePath() {
		return recordFilePath;
	}

	addUser(id, soc) {
		this.idToUser.set(id, {
			nickname: id,
			soc: soc,
		});
	}

	addBan(id) {
		this.banlist.push(id);
	}

	isBanned(id) {
		return this.banlist.includes(id);
	}

	getNickname(id) {
		const user = this.idToUser[id];
		return user ? user.nickname : null;
	}

	setNickname(id, nickname) {
		this.idToUser[id].nickname = nickname;
	}

	getSocket(id) {
		return this.idToUser[id].soc;
	}

	store() {
		fs.writeFileSync(recordFilePath, JSON.stringify(this));
	}
}

module.exports = UserRecord;
