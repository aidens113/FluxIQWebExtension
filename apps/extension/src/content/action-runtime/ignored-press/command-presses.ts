// How many extra presses one command has already made, across the attempts the
// in-page recovery makes of it (`../recovery/attempt.ts`).
//
// A press the page did not answer at all, after which a layer covered the
// control during the wait, is not taken for answered by that layer (t476): the
// click reports the cover as a refusal, the recovery closes the layer through
// its own way out and runs the click again, and that run's press is the extra
// one. The click runs afresh on each attempt and keeps nothing itself, so the
// extra press is noted here, against the command, and `press-again.ts`'s bound
// of one extra press per command still holds across the attempts: the press
// made after the layer is closed is never followed by a third.
//
// Keyed by the command object, which every attempt of one execution shares
// (`../../actions/execute.ts` hands the same command to each). A command Core
// sends again is a new object and starts from none; nothing here outlives it.

const made = new WeakMap<object, number>();

/** The extra presses `command` has made so far, on any attempt. */
export function extraPressesMade(command: object): number {
  return made.get(command) ?? 0;
}

/** Notes that `command` has made one more extra press. */
export function noteExtraPress(command: object): void {
  made.set(command, extraPressesMade(command) + 1);
}
