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
//
// `score.ts` closes that loop: it hands the pool and the recorded descriptor to
// Core's element matcher and reports which candidate Core says is the recorded
// control. Enumeration and scoring live side by side because they are two
// halves of one question, and because both are built on the signals the modules
// around them define.

export { accessibleNameFor, authoredNameAttribute } from "./accessible-name";
export { boundedText } from "./bounded-text";
export { candidateFingerprint, candidateLabel, collectTargetCandidates } from "./candidates";
export { elementContext, landmarkRole } from "./context";
export { implicitRole } from "./implicit-role";
export { associatedLabel, labelText } from "./label";
export { TARGET_SCORE_FLOOR, TARGET_SCORE_MARGIN, scoreTargetCandidates } from "./score";

export type { CandidateFamily, TargetCandidate } from "./candidates";
export type { CandidateSelection, RecordedIdentity, ScoredCandidate } from "./score";
