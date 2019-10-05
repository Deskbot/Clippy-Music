import * as crypto from "crypto";

export interface PasswordContainer {
	hashedPassword: Buffer;
	salt: Buffer;
}

function hash(password: string, salt: Buffer): Buffer {
	return crypto.scryptSync(password, salt, 64);
}

export function newContainer(inputPass: string): PasswordContainer {
	const salt = makeSalt();
	return {
		salt,
		hashedPassword: hash(inputPass, salt),
	};
}

function makeSalt(): Buffer {
	return crypto.randomBytes(64);
}

export function verifyPassword(inputPass: string, passwordContainer: PasswordContainer): boolean {
	return hash(inputPass, passwordContainer.salt) === passwordContainer.hashedPassword;
}
