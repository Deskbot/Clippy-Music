import { PasswordContainer } from '../lib/PasswordContainer';

class Api {
	private container: PasswordContainer | null = null;

	get(): PasswordContainer | null {
		return this.container;
	}

	isSet() {
		return this.container !== null;
	}

	set(pw) {
		this.container = new PasswordContainer(pw);
	}
}

export const PasswordService = new Api();
