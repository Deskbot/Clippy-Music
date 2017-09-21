let on = false;

module.exports = {
	err: function(...args) {
		if (on) console.error('debug', ...args);
	},

	error: function(...args) {
		if (on) console.error('debug', ...args);
	},

	log: function(...args) {
		if (on) console.log('debug', ...args);
	},

	trace: function() {
		if (on) console.trace();
	},

	on: function() {
		on = true;
	},

	off: function() {
		on = false;
	}
};