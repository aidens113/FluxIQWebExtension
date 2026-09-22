// When each stage of a journey was reached, in milliseconds from its start.
// Stage names are the journey's own closed vocabulary; a checkpoint carries
// counts and flags only, never an identifier a page chose or a value it showed.

export type JourneyCheckpoint = Readonly<{ stage: string; elapsedMs: number } & Readonly<Record<string, number | boolean | string>>>;

export type JourneyTimeline = {
  mark(stage: string, facts?: Readonly<Record<string, number | boolean | string>>): void;
  readonly checkpoints: readonly JourneyCheckpoint[];
  elapsedMs(): number;
};

export function journeyTimeline(now: () => number = Date.now): JourneyTimeline {
  const startedAt = now();
  const checkpoints: JourneyCheckpoint[] = [];
  return {
    mark(stage, facts = {}) { checkpoints.push(Object.freeze({ ...facts, stage, elapsedMs: now() - startedAt })); },
    checkpoints,
    elapsedMs: () => now() - startedAt,
  };
}
