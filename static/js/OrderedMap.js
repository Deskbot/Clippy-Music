var OrderedMap = (function() {
	function OrderedMap() {
		this.list = [];
		this.map = {};
	}

	OrderedMap.prototype.insert = function(key, val) {
		this.list.push(key);
		this.map[key] = val;
	};

	OrderedMap.prototype.readKeys = function() {
		return this.list;
	};

	OrderedMap.prototype.remove = function(key) {
		this.list.splice(this.list.indexOf(key), 1);
		delete this.map[key];
	};

	OrderedMap.prototype.update = function(key, val) {
		this.map[key] = val;
	};

	return OrderedMap;
})();