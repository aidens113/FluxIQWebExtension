// How a target a step *reads* is looked up once its selector missed
// (`../resolve-target.ts`, t743). The domain marks such a target `readsWords`
// (`domain/.../plan-resolution/read-identity.ts`): its saved words are the value
// the step reads, and an earlier step of the same Flow may have changed them.
// So it is never looked up by those words: its stable signals and a name that
// is not the words find it, each only in the recorded landmark, and Level 2
// weighs the recorded tag's elements in its record and landmark, which the
// family enumeration does not offer when the target is no control. The veto and
// the scorer then judge it without the words (`../../identity/read-words.ts`).
// `scanTagMatches` is the bounded walk the resolver's own word lookup shares.

export { readsItsWords } from "./reads-its-words";
export { inRecordedLandmark } from "./in-recorded-landmark";
export { readFingerprintMatches } from "./read-fingerprint-matches";
export { withReadElements } from "./read-elements";
export { scanTagMatches, MAX_TEXT_SCAN } from "./scan-tag-matches";
