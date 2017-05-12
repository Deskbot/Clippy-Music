class UserRecord {
	constructor() {
		this.idToUser = new Map(); //ip -> (nickname,soc)	
	}

	addUser(id, soc) {
		this.idToUser.set(id, {
			nickname: id,
			soc: soc,
		});
	}

	getNickname(id) {
		const user = this.idToUser.get(id);
		return user ? user.nickname : null;
	}

	setNickname(id, nickname) {
		this.idToUser.get(id).nickname = nickname;
	}

	getSocket(id) {
		return this.idToUser.get(id).soc;
	}
}

module.exports = UserRecord;
