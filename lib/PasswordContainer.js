/*
 * I'm generating the salt and hashing it myself because bcrypt has tons of dependencies,
 * the one password will only ever be in memory,
 * the password will only be generated once.
 */
const prompt = require('prompt');
const sha256 = require('sha256');

class PasswordContainer {
	constructor(inputPass) {
		this.salt = this.constructor.newSalt(32);
		this.password = sha256(inputPass + this.salt);
	}

	verify(inputPass) {
		return sha256(inputPass + this.salt) === this.password;
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

module.exports = PasswordContainer;