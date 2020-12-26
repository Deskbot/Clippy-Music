import { EventEmitter } from "events";
import { StrictEventEmitter } from "strict-event-emitter-types";

/**
 * TypedEmitter solves the problem of NodeJS's EventEmitter not being type safe;
 * the data passed into the emit method matches the data in the corresponding handle method,
 * however by default the data is treated as any in both cases.
 *
 * TypedEmitter is identical to StrictEventEmitter except that it is extend-able and new-able
 * and it bakes in the type of EventEmitter, which is the only one Clippy-Music uses.
 */
export type TypedEmitter<T> = { new(): StrictEventEmitter<EventEmitter, T> };
