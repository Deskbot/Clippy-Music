class UserRecord {
	constructor() {
		this.idToUser = new Map(); //ip -> (nickname,soc)	
	}

	addUser(id, soc) {
		this.idToUser.set(id, {
			nickname: null,
			soc: soc,
		});
	}

	setNickname(id, nickname) {
		this.idToUser.get(id).nickname = nickname;
	}

	getSocket(id) {
		return this.idToUser.get(id).soc;
	}
}

module.exports = UserRecord;
