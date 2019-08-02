let isOn = false;

export function err(...args) {
	if (isOn) console.error('debug', ...args);
}

export function error(...args) {
	if (isOn) console.error('debug', ...args);
}

export function log(...args) {
	if (isOn) console.log('debug', ...args);
}

export function trace() {
	if (isOn) console.trace();
}

export function on() {
	isOn = true;
}

export function off() {
	isOn = false;
}
