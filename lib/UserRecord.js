class UserRecord {
	constructor() {
		this.idToUser = {}; //ip -> (nickname,soc)	
	}

	addUser(id, soc) {
		this.idToUser.set(id, {
			nickname: id,
			soc: soc,
		});
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
}

module.exports = UserRecord;
