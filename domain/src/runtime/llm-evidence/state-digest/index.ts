// The state a capture reports: `state-digest.ts` hashes a value-free
// projection of the sanitized packet into the digest a call names, and
// `snapshot-states.ts` takes that digest and the route state from one and the
// same capture, so the two always describe the same page.

export { webLlmSnapshotStates } from "./snapshot-states";
export { webLlmStateDigest } from "./state-digest";
