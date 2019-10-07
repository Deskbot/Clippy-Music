import * as crypto from "crypto";
import { promisify } from "util";

export interface PasswordContainer {
	hashedPassword: Buffer;
	salt: Buffer;
}

const hash = promisify<string, Buffer, Buffer>((password, salt, callback) => {
	crypto.scrypt(password, salt, 64, callback);
});

export async function newContainer(inputPass: string): Promise<PasswordContainer> {
	const salt = makeSalt();
	return {
		salt,
		hashedPassword: await hash(inputPass, salt),
	};
}

function makeSalt(): Buffer {
	return crypto.randomBytes(64);
}

export async function verifyPassword(input: string, container: PasswordContainer): Promise<boolean> {
	return await hash(input, container.salt) === container.hashedPassword;
}
