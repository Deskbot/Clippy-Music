let on = false;

module.exports = {
	err: function(message) {
		if (on) console.error(message);
	},

	error: function(message) {
		if (on) console.error(message);
	},

	log: function(message) {
		if (on) console.log(message);
	},

	on: function() {
		on = true;
	},

	off: function() {
		on = false;
	}
};