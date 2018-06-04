const PasswordContainer = require('../lib/PasswordContainer.js');

class Api {
	constructor() {
		this.container = null;
	}

	get() {
		return this.container;
	}

	isSet() {
		return this.container !== null;
	}

	set(pw) {
		this.container = new PasswordContainer(pw);
	}
};

module.exports = new Api();
