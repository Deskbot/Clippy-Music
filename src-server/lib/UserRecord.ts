import * as fs from 'fs';

import * as consts from './consts';

const recordFilePath = consts.files.users;

export class UserRecord {
	private idToUser;
	private banlist;

	constructor(startState) {
		this.idToUser = {}; //ip -> (nickname,socs)
		this.banlist = [];

		if (startState) {
			console.log('Using suspended user record');

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

	//static

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

	//object methods

	add(id, soc?) {
		if (!this.isUser(id)) {
			this.idToUser[id] = {
				nickname: id,
				socs: soc ? [soc] : [],
			};
		}
	}

	addBan(id) {
		if (!this.isBanned(id)) this.banlist.push(id); //no duplicates in list
	}

	get(id) {
		return this.idToUser[id];
	}

	getNickname(id) {
		const user = this.idToUser[id];
		return user ? user.nickname : null;
	}

	getSockets(id) {
		return this.idToUser[id].socs;
	}

	isBanned(id) {
		return this.banlist.includes(id);
	}

	isUser(id) {
		return this.idToUser.hasOwnProperty(id);
	}

	removeBan(id) {
		this.banlist.splice(this.banlist.indexOf(id), 1);
	}

	setNickname(id, nickname) {
		this.idToUser[id].nickname = nickname;
	}

	setWS(id, soc) {
		this.idToUser[id].socs.push(soc);
	}

	store() {
		console.log("Storing user record...");

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

	unsetWS(id, soc) {
		const socs = this.idToUser[id].socs;
		socs.splice(socs.indexOf(soc), 1);
	}

	whoHasNickname(nn): string[] {
		const ids: string[] = [];

		for (let uid in this.idToUser) {
			let user = this.idToUser[uid];
			if (user.nickname == nn) ids.push(uid);
		}

		return ids;
	}
}
