import * as fs from "fs";
import * as arrayUtils from "../lib/utils/arrayUtils";
import * as consts from "../consts";
import { newContainer, PasswordContainer } from "../lib/PasswordContainer";

interface SuspendedPasswordContainer {
	hashedPassword: number[],
	salt: number[],
}

function isPasswordContainer(val: any): val is SuspendedPasswordContainer {
	return "hashedPassword" in val
		&& arrayUtils.isNumberArray(val.hashedPassword)
		&& "salt" in val
		&& arrayUtils.isNumberArray(val.salt);
}

class Api {
	private container: PasswordContainer | null = null;

	getContainer(): PasswordContainer | null {
		return this.container;
	}

	recover(): boolean {
		console.log("Reading suspended password container");

		try {
			var file = fs.readFileSync(consts.files.password).toString();

		} catch (e) {
			console.log("No suspended password container found. This is ok.");
			return false;
		}

		try {
			var recoveredObj = JSON.parse(file);
		} catch (e) {
			if (e instanceof SyntaxError) {
				console.error("Syntax error in suspendedPasswordContainer.json file.");
				console.error(e);
				console.log("Ignoring suspended password container");
				return false;
			}

			throw e;
		}

		if (isPasswordContainer(recoveredObj)) {
			this.container = {
				hashedPassword: Buffer.from(recoveredObj.hashedPassword),
				salt: Buffer.from(recoveredObj.salt),
			};
			return true;
		}

		return false;
	}

	setNew(pw: string) {
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
