const fs = require('fs');

const consts = require('./consts.js');
const utils = require('./utils.js');

const recordFilePath = consts.files.users;

class UserRecord {
	constructor(startState) {
		this.idToUser = {}; //ip -> (nickname,socs)
		this.banlist = [];

		if (startState) {
			this.idToUser = startState.idToUser;
			
			let key;
			for (key in this.idToUser) {
				if (this.idToUser.hasOwnProperty(key)) {
					this.idToUser[key].socs = [];
				}
			}

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

	add(id, soc) {
		if (!this.isUser(id)) {
			this.idToUser[id] = {
				nickname: id,
				socs: soc ? [soc] : [],
			};
		}
	}

	get(id) {
		return this.idToUser[id];
	}

	isUser(id) {
		return this.idToUser.hasOwnProperty(id);
	}

	setWS(id, soc) {
		this.idToUser[id].socs.push(soc);
	}

	unsetWS(id, soc) {
		const socs = this.idToUser[id].socs;
		socs.splice(socs.indexOf(soc), 1);
	}

	addBan(id) {
		if (!this.isBanned(id)) this.banlist.push(id); //no duplicates in list
	}

	removeBan(id) {
		this.banlist.splice(this.banlist.indexOf(id), 1);
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

	getSockets(id) {
		return this.idToUser[id].socs;
	}

	store() {
		const thisObj = {
			idToUser: (() => {
				const obj = {};

				for (let key in this.idToUser) {
					if (this.idToUser.hasOwnProperty(key)) {
						obj[key] = {
							nickname: this.idToUser[key].nickname,
						};
					}
				}

				return obj;
			})(),

			banlist: this.banlist,
		};

		fs.writeFileSync(recordFilePath, JSON.stringify(thisObj));
	}
}

module.exports = UserRecord;
