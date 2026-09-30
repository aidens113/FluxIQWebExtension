// Folds Core's raw activity events into the one status a person reads
// (`ActivityDisplay`), at a pace a person can read.
//
// Core reports every seam of its work: a build asks the model, runs a tool,
// reads the result and asks again, often inside one second. Shown as they
// come, those events flip the status several times a second (the t185
// overlay did, and people called it flicker). The pacer keeps what they say
// and changes how often it is said:
//
// - `headline` names the unit of work ("Building your Flow", "Running your
//   Flow") and changes only when the work changes or settles ("Flow ready",
//   "Build failed", "Waiting for you"). Those changes show at once.
// - `detail` is Core's latest sentence. It changes at most once per
//   `detailIntervalMs`: the first change in a quiet period shows at once, and
//   any that arrive before the period ends wait for its end, where only the
//   newest is shown. Nothing is dropped for good -- the last sentence always
//   reaches the screen -- so a stale one is never left showing.
// - `phase` and `step` move with `detail`, so the colour, the mark and the
//   step count cannot change faster than the words beside them.
// - A settling event -- `final`, `failed` or waiting for the person -- skips
//   the wait and replaces anything still waiting.
//
// Pure apart from the injected clock: no browser API, no network.

import type { ActivityDisplay, ClientGatewayActivity } from "../../shared/activity/index";
import type { ActivityClock, ActivityTimer } from "./clock";
import { activityHeadline } from "./headline";

/** The shortest time between two changes of `detail`. */
export const ACTIVITY_DETAIL_INTERVAL_MS = 1_200;

/** The most characters of Core's sentence kept. Core already truncates; this bounds a misbehaving sender. */
const MAX_DETAIL = 160;

export type ActivityPacerOptions = {
  readonly clock: ActivityClock;
  /** Called with the new display whenever what a person sees changes. */
  readonly onChange: (display: ActivityDisplay) => void;
  readonly detailIntervalMs?: number;
};

export class ActivityPacer {
  private shown: ActivityDisplay | null = null;
  private pending: ClientGatewayActivity | undefined;
  private timer: ActivityTimer | undefined;
  private detailChangedAt = Number.NEGATIVE_INFINITY;
  private readonly intervalMs: number;

  constructor(private readonly options: ActivityPacerOptions) {
    this.intervalMs = options.detailIntervalMs ?? ACTIVITY_DETAIL_INTERVAL_MS;
  }

  /** What a person sees now; null before the first event. */
  display(): ActivityDisplay | null {
    return this.shown;
  }

  /** Takes one event, already known to be newer than every one before it. */
  accept(event: ClientGatewayActivity): void {
    const now = this.options.clock.now();
    if (this.showsAtOnce(event) || now - this.detailChangedAt >= this.intervalMs) {
      this.cancelPending();
      this.show(event, now);
      return;
    }
    this.pending = event;
    this.timer ??= this.options.clock.setTimeout(() => this.showPending(), this.detailChangedAt + this.intervalMs - now);
  }

  /** Stops a waiting change; the display keeps what it last showed. */
  dispose(): void {
    this.cancelPending();
  }

  /** A new unit of work, a settling event, or work resuming after it settled: the headline changes, so it shows now. */
  private showsAtOnce(event: ClientGatewayActivity): boolean {
    const shown = this.shown;
    if (shown === null || shown.activityId !== event.activityId) return true;
    if (outcomeOf(event) !== null) return true;
    return !shown.working;
  }

  private showPending(): void {
    this.timer = undefined;
    const event = this.pending;
    this.pending = undefined;
    if (event) this.show(event, this.options.clock.now());
  }

  private cancelPending(): void {
    if (this.timer !== undefined) this.options.clock.clearTimeout(this.timer);
    this.timer = undefined;
    this.pending = undefined;
  }

  private show(event: ClientGatewayActivity, now: number): void {
    const previous = this.shown;
    const next = displayFor(event, previous);
    this.shown = next;
    if (previous === null || next.detail !== previous.detail) this.detailChangedAt = now;
    if (previous === null || visiblyDiffers(previous, next)) this.options.onChange(next);
  }
}

function displayFor(event: ClientGatewayActivity, previous: ActivityDisplay | null): ActivityDisplay {
  const subjectKind = subjectKindOf(event);
  const outcome = outcomeOf(event);
  const working = outcome === null;
  const sameUnit = previous !== null && previous.activityId === event.activityId;
  // A run's step events carry the step; the events between them ("Run
  // started", a note) keep the step last said, so the count does not blink out.
  const step = working ? stepOf(event.step) ?? (sameUnit ? previous.step : null) : null;
  return {
    activityId: event.activityId,
    subjectKind,
    phase: event.phase,
    headline: activityHeadline(subjectKind, outcome),
    detail: bounded(event.label),
    step,
    working,
    outcome,
    sequence: event.sequence
  };
}

function outcomeOf(event: ClientGatewayActivity): ActivityDisplay["outcome"] {
  if (event.phase === "failed") return "failed";
  if (event.phase === "waiting_permission") return "waiting";
  if (event.phase === "done" || event.final === true) return "done";
  return null;
}

function subjectKindOf(event: ClientGatewayActivity): ActivityDisplay["subjectKind"] {
  const kind: unknown = (event.subject as { kind?: unknown } | undefined)?.kind;
  if (kind === "run" || kind === "build") return kind;
  return event.activityId.startsWith("run:") ? "run" : "build";
}

function stepOf(step: ClientGatewayActivity["step"]): ActivityDisplay["step"] {
  if (!step || !Number.isFinite(step.index) || step.index < 1) return null;
  return { index: Math.floor(step.index), count: Number.isFinite(step.count) && step.count >= 0 ? Math.floor(step.count) : 0 };
}

function bounded(text: string): string | null {
  const collapsed = text.replace(/\s+/gu, " ").trim();
  if (!collapsed) return null;
  return collapsed.length > MAX_DETAIL ? `${collapsed.slice(0, MAX_DETAIL - 1)}…` : collapsed;
}

function visiblyDiffers(a: ActivityDisplay, b: ActivityDisplay): boolean {
  return a.activityId !== b.activityId
    || a.headline !== b.headline
    || a.detail !== b.detail
    || a.phase !== b.phase
    || a.working !== b.working
    || a.outcome !== b.outcome
    || a.step?.index !== b.step?.index
    || a.step?.count !== b.step?.count;
}
