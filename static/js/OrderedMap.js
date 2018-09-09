var OrderedMap = (function() {
	function OrderedMap() {
		this.list = [];
		this.map = {};
	}

	OrderedMap.prototype.get = function(key) {
		return this.map[key];
	};

	OrderedMap.prototype.getValues = function() {
		var result = [];

		for (var i = 0; i < this.list.length; i++) {
			var key = this.list[i];
			result.push(this.map[key]);
		}

		return result;
	};

	OrderedMap.prototype.has = function(key) {
		return this.map.hasOwnProperty(key);
	};

	OrderedMap.prototype.insert = function(key, val) {
		this.list.push(key);
		this.map[key] = val;
	};

	OrderedMap.prototype.remove = function(key) {
		this.list.splice(this.list.indexOf(key), 1);
		delete this.map[key];
	};

	OrderedMap.prototype.size = function() {
		return this.list.length;
	};

	return OrderedMap;
})();