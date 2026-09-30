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
//   Flow", "Fixing your Flow") and changes only when the work changes,
//   settles ("Flow ready", "Build failed") or needs the person ("Waiting for
//   you: finish the check on the page"). Those changes show at once, however
//   recently the detail changed (`headline.ts`, `unit-situation.ts`).
// - `detail` is Core's latest event in a person's words (`activityWording`:
//   no tool id or result code ever reaches it). It changes at most once per
//   `detailIntervalMs`: the first change in a quiet period shows at once, and
//   any that arrive before the period ends wait for its end, where only the
//   newest is shown. Nothing is dropped for good -- the last sentence always
//   reaches the screen -- so a stale one is never left showing. A sentence
//   that only repeats the headline is dropped (`isHeadlineEcho`).
// - `phase` and `step` move with `detail`, so the colour, the mark and the
//   step count cannot change faster than the words beside them.
// - A settling event -- `final`, `failed` or waiting for the person -- changes
//   the headline or the outcome, so it skips the wait and replaces anything
//   still waiting.
//
// Pure apart from the injected clock: no browser API, no network.

import { activityWording, isHeadlineEcho, type ActivityDisplay, type ClientGatewayActivity } from "../../shared/activity/index";
import type { ActivityClock, ActivityTimer } from "./clock";
import { activityHeadline } from "./headline";
import { UnitSituation, type UnitState } from "./unit-situation";

/** The shortest time between two changes of `detail`. */
export const ACTIVITY_DETAIL_INTERVAL_MS = 1_200;

/** The most characters of Core's sentence kept. Core already truncates; this bounds a misbehaving sender. */
const MAX_DETAIL = 160;

/** The detail under "Waiting for you: finish the check on the page", in place of the page action's own outcome. */
const CHECK_DETAIL = "Only a person can get past this page";

export type ActivityPacerOptions = {
  readonly clock: ActivityClock;
  /** Called with the new display whenever what a person sees changes. */
  readonly onChange: (display: ActivityDisplay) => void;
  readonly detailIntervalMs?: number;
};

export class ActivityPacer {
  private shown: ActivityDisplay | null = null;
  private pending: ActivityDisplay | undefined;
  private readonly situation = new UnitSituation();
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
    const next = displayFor(event, this.shown, this.situation.observe(event));
    if (this.showsAtOnce(next) || now - this.detailChangedAt >= this.intervalMs) {
      this.cancelPending();
      this.show(next, now);
      return;
    }
    this.pending = next;
    this.timer ??= this.options.clock.setTimeout(() => this.showPending(), this.detailChangedAt + this.intervalMs - now);
  }

  /** Stops a waiting change; the display keeps what it last showed. */
  dispose(): void {
    this.cancelPending();
  }

  /** A new unit of work, or a new headline or outcome for this one (a repair, a check, settling, resuming): it shows now. */
  private showsAtOnce(next: ActivityDisplay): boolean {
    const shown = this.shown;
    return shown === null || shown.activityId !== next.activityId || shown.headline !== next.headline || shown.outcome !== next.outcome;
  }

  private showPending(): void {
    this.timer = undefined;
    const next = this.pending;
    this.pending = undefined;
    if (next) this.show(next, this.options.clock.now());
  }

  private cancelPending(): void {
    if (this.timer !== undefined) this.options.clock.clearTimeout(this.timer);
    this.timer = undefined;
    this.pending = undefined;
  }

  private show(next: ActivityDisplay, now: number): void {
    const previous = this.shown;
    this.shown = next;
    if (previous === null || next.detail !== previous.detail) this.detailChangedAt = now;
    if (previous === null || visiblyDiffers(previous, next)) this.options.onChange(next);
  }
}

function displayFor(event: ClientGatewayActivity, previous: ActivityDisplay | null, unit: UnitState): ActivityDisplay {
  const subjectKind = subjectKindOf(event);
  // A check only the person can answer holds the work until the page lets it
  // through; Core's own settling and waiting events still say what they say.
  const outcome = outcomeOf(event) ?? (unit.check ? "waiting" : null);
  const working = outcome === null;
  const headline = activityHeadline(subjectKind, outcome, {
    repairing: unit.repairing,
    waitingOn: event.phase === "waiting_permission" ? "answer" : "check"
  });
  const detail = bounded(unit.checkReportedNow ? CHECK_DETAIL : activityWording(event).sentence);
  const sameUnit = previous !== null && previous.activityId === event.activityId;
  // A run's step events carry the step; the events between them ("Run
  // started", a note) keep the step last said, so the count does not blink out.
  const step = working ? stepOf(event.step) ?? (sameUnit ? previous.step : null) : null;
  return {
    activityId: event.activityId,
    subjectKind,
    phase: event.phase,
    headline,
    detail: isHeadlineEcho(headline, detail) ? null : detail,
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
