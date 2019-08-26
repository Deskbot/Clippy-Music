import { PasswordContainer } from '../lib/PasswordContainer';

class Api {
	private container: PasswordContainer | null = null;

	get(): PasswordContainer | null {
		return this.container;
	}

	set(pw: string) {
		this.container = new PasswordContainer(pw);
	}
}

export const PasswordService = new Api();
