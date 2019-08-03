/*
 * I'm generating the salt and hashing it myself because bcrypt has tons of dependencies,
 * the one password will only ever be in memory,
 * the password will only be generated once.
 */
import * as crypto from "crypto";

export class PasswordContainer {
	private salt;
	private password;

	constructor(inputPass) {
		this.salt = PasswordContainer.newSalt(32);
		this.password = hash(inputPass + this.salt);
	}

	verify(inputPass) {
		return hash(inputPass + this.salt) === this.password;
	}

	//static

	static newSalt(len) {
		let str = "";

		//8 is the number of chars added to str each time
		for (let i = 0; i < len; i += 8) {
			//add a random string
			str += Math.random().toString(36).substr(2);
		}

		return str.substr(len);
	}
}

function hash(data: string): string {
	return crypto.createHash('sha256')
		.update(data)
		.digest()
		.toString();
}
