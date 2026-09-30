// FluxIQ's step messages as data: which activity events are messages and
// what each says (`stepMessages`), how the action behind one went, in words
// (`outcomeWords`), and any step, tool or check in a person's words rather
// than an id (`stepWords`). No DOM.
export { stepMessages, type StepMessage, type StepMessageKind, type StepOutcome } from "./messages";
export { outcomeWords, type OutcomeWords } from "./outcome";
export { stepWords, type StepWords } from "./words";
