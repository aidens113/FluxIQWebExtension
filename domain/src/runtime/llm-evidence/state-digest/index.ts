// The state a capture reports: `state-digest.ts` hashes a secret-free
// projection of the sanitized packet into the digest a call names, and
// `snapshot-states.ts` takes that digest and the route state from one and the
// same capture, so the two always describe the same page. Both are hashed with
// `../../hash/` (`fnv1a`), which the route signature (`../../route-state/`)
// uses too.

export { webLlmSnapshotStates } from "./snapshot-states";
export { webLlmStateDigest } from "./state-digest";
