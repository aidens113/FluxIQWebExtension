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
//
// `reportable-text.ts` is the one rule about what leaves the page: a failure
// naming the candidates it weighed quotes a label, never a container's
// contents.
//
// `veto.ts` points the same scorer back at Level 1. An exact strategy chooses
// by one signal -- a class set, a line of text -- and used to act on it
// unweighed; the veto scores what it chose against the recording and refuses a
// match the page contradicts. Level 1 keeps its speed and its precedence and
// loses only the ability to act on evidence Level 2 would reject outright.

export { accessibleNameFor, authoredNameAttribute } from "./accessible-name";
export { boundedText } from "./bounded-text";
export { candidateFingerprint, candidateLabel, collectTargetCandidates } from "./candidates";
export { elementContext, landmarkRole } from "./context";
export { implicitRole } from "./implicit-role";
export { associatedLabel, labelText } from "./label";
export { reportableText } from "./reportable-text";
export { TARGET_SCORE_FLOOR, TARGET_SCORE_MARGIN, scoreTargetCandidate, scoreTargetCandidates } from "./score";
export { TARGET_VETO_FLOOR, vetoExactMatch } from "./veto";

export type { CandidateFamily, TargetCandidate } from "./candidates";
export type { CandidateSelection, RecordedIdentity, ScoredCandidate } from "./score";
export type { TargetVeto } from "./veto";
