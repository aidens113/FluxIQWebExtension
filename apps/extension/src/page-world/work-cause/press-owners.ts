// Which armed press's work the page's code is running in, as the press-work
// watch follows it (`../press-work/`), read by the request count
// (`../request-starts.ts`, t1094). The request count is installed before the
// press-work watch, so the watch registers its reader here when it installs;
// until it does, and wherever it cannot follow, nothing is owned and nothing
// is followed, which leaves every request counted as it was.

export type PressOwnersReader = {
  /** The press marks whose work is running now; empty outside any. */
  owners(): readonly object[];
  /** The press mark armed on `target`, while it stands. */
  markOf(target: EventTarget): object | undefined;
  /** Whether every piece of work the press on `target` started was followed: its click seen, its handlers and their scheduling intact and synchronous. */
  followed(target: EventTarget): boolean;
};

const NOBODY: PressOwnersReader = { owners: () => [], markOf: () => undefined, followed: () => false };
let reader: PressOwnersReader = NOBODY;

/** The registry (header): `read` is what the press-work watch registered, or nobody. */
export const pressOwners = {
  register(registered: PressOwnersReader): void {
    reader = registered;
  },
  read(): PressOwnersReader {
    return reader;
  }
};
