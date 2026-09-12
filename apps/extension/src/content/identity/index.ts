// Element identity: the signals Core's fingerprint normalizer scores an element
// by -- its accessible name, its label, its implicit role -- and the context
// that tells two identical-looking controls apart. `describe-element.ts` is the
// only caller; each signal lives in its own module so a rule can be read and
// changed without touching the descriptor.

export { accessibleNameFor, authoredNameAttribute } from "./accessible-name";
export { boundedText } from "./bounded-text";
export { elementContext } from "./context";
export { implicitRole } from "./implicit-role";
export { associatedLabel, labelText } from "./label";
