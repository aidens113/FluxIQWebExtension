/** Compare private identity sets while exposing only counts and their equality. */
export function replayKeyPreservation(before: readonly string[], after: readonly string[]): Readonly<{
  before: number; after: number; preserved: boolean;
}> {
  const original = [...before].sort();
  const current = [...after].sort();
  return Object.freeze({ before: original.length, after: current.length,
    preserved: original.length === current.length && original.every((identity, index) => identity === current[index]) });
}
