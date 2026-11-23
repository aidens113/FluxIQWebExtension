/**
 * The files the fresh capture's runner and its Core host module exchange in the
 * isolated fixture root: what the stopped boundary proved and what was asked
 * for, the entry the service actually received, why a host refused it, and the
 * one native request it answered.
 */
export const RECORDED_CAPTURE_FILES = Object.freeze({
  configuration: ".recorded-capture.json",
  entry: ".recorded-capture-entry.json",
  refusal: ".recorded-capture-refusal.json",
  wire: ".recorded-capture-wire.json"
});
