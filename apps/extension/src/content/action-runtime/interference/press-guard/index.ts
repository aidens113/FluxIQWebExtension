// Whether a way out may be pressed for what pressing it would do (t401).
//
// `../way-out.ts` finds the control whose label is a way out; this asks the
// control a press would reach whether its press acts -- submits a form, toggles
// a state, or is named to retry, confirm, accept or go on -- and refuses it if
// so (`acting-control.ts`, over the words in `acting-wording.ts`).

export { actsOnPress } from "./acting-control";
