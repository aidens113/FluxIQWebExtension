// What the pace did for one command: how many loads it booked, how many it
// held and for how long in all, and how many refusals it was told of. The
// command's result names it (`paced-result.ts`), so a read that took longer
// because FluxIQ spaced its loads says so rather than looking slow.

export class PaceTally {
  loads = 0;
  waits = 0;
  waitedMs = 0;
  refusals = 0;
  /** The spacing of the origin last paced, once any load or refusal was noted. */
  spacingMs: number | undefined;

  /** Notes one booked load, the wait it was given and the origin's spacing after it. */
  booked(waitMs: number, spacingMs: number): void {
    this.loads += 1;
    this.spacingMs = spacingMs;
    if (waitMs <= 0) return;
    this.waits += 1;
    this.waitedMs += waitMs;
  }

  /** Notes one refusal and the origin's spacing after it. */
  refused(spacingMs: number): void {
    this.refusals += 1;
    this.spacingMs = spacingMs;
  }
}
