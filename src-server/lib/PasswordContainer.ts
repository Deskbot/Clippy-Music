import * as crypto from "crypto";

export class PasswordContainer {
	private salt: Buffer;
	private hashedPassword: Buffer;

	constructor(inputPass: string) {
		this.salt = newSalt();
		this.hashedPassword = hash(inputPass, this.salt);
	}

	verify(inputPass: string) {
		return hash(inputPass, this.salt) === this.hashedPassword;
	}
}

function hash(password: string, salt: Buffer): Buffer {
	return crypto.scryptSync(password, salt, 64);
}

function newSalt(): Buffer {
	return crypto.randomBytes(64);
}
