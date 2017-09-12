/*
 * This module gets an admin password from the terminal.
 * I'm generating the salt and hashing it myself because bcrypt has tons of dependencies,
 * the one password will only ever be in memory,
 * the password will only be generated once.
 */
const prompt = require('prompt');
const sha256 = require('sha256');

prompt.colors = false;
prompt.message = '';
prompt.delimiter = '';
const promptOpts = {
	noHandleSIGINT: true,
}

function makeSalt() {
	return Math.random().toString(36).substr(2);
}

//namespace for internal api methods
class Api {
	//methods

	static choose() {
		return new Promise((resolve, reject) => {
			prompt.start(promptOpts);

			prompt.get([{
				name: 'password1',
				message: 'Set Admin Password (hidden) (1/2): ',
				hidden: true,
				required: true,
			},{
				name: 'password2',
				message: 'Verify Admin Password (hidden) (2/2): ',
				hidden: true,
				required: true,
			
			}], function(err, result) {
				if (err) return reject(err);

				if (result.password1 === result.password2) {
					resolve(result.password1);
					
				} else {
					console.log('Passwords did not match. Try again.');
					resolve(Api.choose());
				}
			});
		});
	}

	static set(inputPass) {
		this.salt = makeSalt() + makeSalt() + makeSalt();
		this.password = sha256(inputPass + this.salt);
	}

	static verify(inputPass) {
		return sha256(inputPass + this.salt) === this.password;
	}
};

module.exports = Api;
