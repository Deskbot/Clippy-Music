import * as fs from 'fs';
import ws = require("ws");

import * as consts from './consts';

const recordFilePath = consts.files.users;

interface User {
	nickname: string,
	socs: ws[],
}

export class UserRecord {
	private idToUser: {
		[id: string]: User
	};
	private banlist: string[];

	constructor(startState?: {
		banlist: string[],
		idToUser: {
			[id: string]: User
		},
	}) {
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

		try {
			recordContent = fs.readFileSync(recordFilePath).toString();

		} catch (e) {
			console.log('No suspended user record found. This is ok.');
			return null
		}

		console.log('Reading suspended user record');

		try {
			success = true && success;
			obj = JSON.parse(recordContent);

		} catch (e) {
			success = false;
			if (e instanceof SyntaxError) {
				console.error('Syntax error in suspendedUserRecord.json file.');
				console.error(e);
				console.error('Ignoring suspended content manager');
			} else {
				throw e;
			}
		}

		return success ? obj : null;
	}

	static get suspendedFilePath(): string {
		return recordFilePath;
	}

	//object methods

	add(id: string, soc?: ws) {
		if (!this.isUser(id)) {
			this.idToUser[id] = {
				nickname: id,
				socs: soc ? [soc] : [],
			};
		}
	}

	addBan(id: string) {
		if (!this.isBanned(id)) this.banlist.push(id); //no duplicates in list
	}

	get(id: string) {
		return this.idToUser[id];
	}

	getNickname(id: string): string {
		const user = this.idToUser[id];
		return user.nickname;
	}

	getSockets(id: string): ws[] {
		return this.idToUser[id].socs;
	}

	isBanned(id: string): boolean {
		return this.banlist.includes(id);
	}

	isUser(id: string): boolean {
		return this.idToUser.hasOwnProperty(id);
	}

	removeBan(id: string) {
		this.banlist.splice(this.banlist.indexOf(id), 1);
	}

	setNickname(id: string, nickname: string) {
		this.idToUser[id].nickname = nickname;
	}

	setWS(id: string, soc: ws) {
		this.idToUser[id].socs.push(soc);
	}

	store() {
		console.log("Storing user record...");

		const idToUser: {
			[id: string]: User
		} = {};

		for (let key in this.idToUser) {
			if (this.idToUser.hasOwnProperty(key)) {
				idToUser[key] = {
					nickname: this.idToUser[key].nickname,
					socs: []
				};
			}
		}

		const thisObj = {
			banlist: this.banlist,
			idToUser,
		};

		fs.writeFileSync(recordFilePath, JSON.stringify(thisObj));
	}

	unsetWS(id: string, soc: ws) {
		const socs = this.idToUser[id].socs;
		socs.splice(socs.indexOf(soc), 1);
	}

	whoHasNickname(nn: string): string[] {
		const ids: string[] = [];

		for (let uid in this.idToUser) {
			let user = this.idToUser[uid];
			if (user.nickname == nn) ids.push(uid);
		}

		return ids;
	}
}
