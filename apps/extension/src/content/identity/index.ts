// Element identity: the signals Core's fingerprint normalizer scores an element
// by -- its accessible name, its label, its implicit role -- and the context
// that tells two identical-looking controls apart. Each signal lives in its own
// module so a rule can be read and changed without touching the descriptor.
//
// Two callers, reading the same rules from opposite ends. `describe-element.ts`
// assembles them into the descriptor a recording puts on the wire;
// `candidates.ts` assembles them into the pool a resolver chooses from when the
// recorded target has drifted. One set of rules, so a candidate and a recorded
// descriptor are comparable.

export { accessibleNameFor, authoredNameAttribute } from "./accessible-name";
export { boundedText } from "./bounded-text";
export { candidateFingerprint, candidateLabel, collectTargetCandidates } from "./candidates";
export { elementContext, landmarkRole } from "./context";
export { implicitRole } from "./implicit-role";
export { associatedLabel, labelText } from "./label";

export type { CandidateFamily, TargetCandidate } from "./candidates";
