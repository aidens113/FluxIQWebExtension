// Progress from a worktree operation, as one JSON line per step on stderr.
//
// Creating a worktree installs two checkouts and runs for around a minute with
// nothing to show, so an operation that prints nothing reads as hung. It goes
// to stderr because stdout belongs to whatever result the calling script
// prints, and a progress line written there would corrupt it. A caller that
// wants the steps somewhere else passes its own `note`.

/** @param {Record<string, unknown>} line */
export function noteProgress(line) {
  process.stderr.write(`${JSON.stringify({ scope: "worktree", ...line })}\n`);
}
