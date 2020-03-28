/**
 * This file provides logging functions like those on `console`,
 * however these functions prepend the given message with "debug"
 */

/**
 * Is the debugger on?
 */
let isOnVar = false;

export function err(...args: any[]) {
	if (isOnVar) console.error("debug", ...args);
}

export function isOn() {
	return isOnVar;
}

export function error(...args: any[]) {
	if (isOnVar) console.error("debug", ...args);
}

export function log(...args: any[]) {
	if (isOnVar) console.log("debug", ...args);
}

export function trace() {
	if (isOnVar) console.trace("debug");
}

export function on() {
	isOnVar = true;
}

export function off() {
	isOnVar = false;
}
