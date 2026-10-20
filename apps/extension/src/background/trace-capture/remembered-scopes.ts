// How many upload records (`stored-digests.ts`, one per Core and trace scope)
// the background worker keeps at once. A build and the trials after it each
// trace into their own scope, so a few dozen covers every trace still being
// written; a record pushed out only means its digests are uploaded again,
// and Core keeps one copy.

export const TRACE_REMEMBERED_SCOPES = 64;
