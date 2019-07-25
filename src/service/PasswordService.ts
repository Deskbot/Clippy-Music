import { PasswordContainer } from '../lib/PasswordContainer.js';

class Api {
	private container = null;

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

export const PasswordService = new Api();
