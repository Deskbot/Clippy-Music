import * as fs from "fs";
import * as consts from "../lib/consts";
import { newContainer, PasswordContainer } from "../lib/PasswordContainer";

class Api {
	private container: PasswordContainer | null = null;

	getContainer(): PasswordContainer | null {
		return this.container;
	}

	set(pw: string) {
		this.container = newContainer(pw);
	}

	store() {
		if (!this.container) {
			return;
		}

		const fileData = JSON.stringify({
			hashedPassword: [...this.container.hashedPassword.values()],
			salt: [...this.container.salt.values()],
		});

		console.log("Storing password container...");
		fs.writeFileSync(consts.files.password, fileData);
	}
}

export const PasswordService = new Api();
