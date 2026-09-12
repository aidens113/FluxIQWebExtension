// Trusted-input emulation (decision D5): the key and input events a real
// user's typing produces, and the default actions a synthetic key never
// triggers -- Enter submitting a form with its default button, Tab moving
// focus along the tabbable order. Where no honest emulation exists, the
// outcome says `unsupported` rather than pretending.

export { keyboard } from "./capability";
export type { KeyboardCapability } from "./capability";
export type { KeyPressOutcome } from "./press-key";
