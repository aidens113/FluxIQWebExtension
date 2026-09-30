import type { UiReviewLabel, UiReviewPhase } from "./types.js";

export type UiReviewTimers = { setInterval(run: () => void, ms: number): unknown; clearInterval(handle: unknown): void };
export type UiReviewScheduleOptions = {
  /** Takes one moment. Expected never to reject; a rejection is kept in `failures`, and the queue goes on. */
  take: (label: UiReviewLabel, phase: UiReviewPhase) => Promise<void>;
  /** How often a moment is taken while a build or a Flow run is in progress. */
  periodMs?: number;
  /** Periodic moments stop once this many moments have been queued; a phase's own moment is always taken. */
  maxMoments?: number;
  timers?: UiReviewTimers;
};

const DEFAULT_PERIOD_MS = 20_000;
const DEFAULT_MAX_MOMENTS = 60;
const LABEL: Readonly<Record<UiReviewPhase, UiReviewLabel>> = { start: "start", build: "mid-build", "flow-run": "flow-run", end: "end", failure: "failure" };

/**
 * When a run's UI review takes a moment.
 *
 * Every phase the spine reports is one moment, taken as soon as the moments
 * before it are done: `start`, a build (`mid-build`), a Flow run
 * (`flow-run`), and the terminal `end` or `failure`. While a build or a Flow
 * run is the current phase, one more moment of that phase's label is taken
 * every `periodMs`; a tick that finds a moment still in flight is skipped and
 * counted rather than queued, so a slow browser cannot build a backlog.
 * After a terminal phase nothing more is taken.
 *
 * Moments run one at a time, in order, so a run's review reads as a sequence.
 */
export class UiReviewSchedule {
  private readonly take: UiReviewScheduleOptions["take"];
  private readonly periodMs: number;
  private readonly maxMoments: number;
  private readonly timers: UiReviewTimers;
  private tail: Promise<void> = Promise.resolve();
  private timer: unknown;
  private inFlight = 0;
  private queued = 0;
  private currentPhase: UiReviewPhase | undefined;
  /** Periodic ticks skipped because a moment was still being taken. */
  skippedTicks = 0;
  /** Why a moment failed, when `take` rejected. */
  readonly failures: string[] = [];

  constructor(options: UiReviewScheduleOptions) {
    this.take = options.take;
    this.periodMs = options.periodMs ?? DEFAULT_PERIOD_MS;
    this.maxMoments = options.maxMoments ?? DEFAULT_MAX_MOMENTS;
    this.timers = options.timers ?? { setInterval: (run, ms) => { const handle = setInterval(run, ms); handle.unref(); return handle; }, clearInterval: handle => clearInterval(handle as ReturnType<typeof setInterval>) };
  }

  get phase(): UiReviewPhase | undefined { return this.currentPhase; }
  get terminal(): boolean { return this.currentPhase === "end" || this.currentPhase === "failure"; }

  /** Enters `phase` and queues its moment; resolves once that moment has been taken. Ignored after a terminal phase. */
  enter(phase: UiReviewPhase): Promise<void> {
    if (this.terminal) return this.idle();
    this.clearTimer();
    this.currentPhase = phase;
    const moment = this.enqueue(LABEL[phase], phase);
    if (phase === "build" || phase === "flow-run") this.timer = this.timers.setInterval(() => this.tick(phase), this.periodMs);
    return moment;
  }

  /** Resolves once every queued moment has been taken. */
  idle(): Promise<void> { return this.tail; }

  /** Takes nothing more; a moment already in flight still finishes (`idle`). */
  stop(): void {
    this.clearTimer();
    if (!this.terminal) this.currentPhase = "end";
  }

  private tick(phase: UiReviewPhase): void {
    if (this.currentPhase !== phase) return;
    if (this.inFlight > 0) { this.skippedTicks += 1; return; }
    if (this.queued >= this.maxMoments) { this.clearTimer(); return; }
    void this.enqueue(LABEL[phase], phase);
  }

  private enqueue(label: UiReviewLabel, phase: UiReviewPhase): Promise<void> {
    this.inFlight += 1;
    this.queued += 1;
    const moment = this.tail.then(() => this.take(label, phase));
    this.tail = moment.then(
      () => { this.inFlight -= 1; },
      (error: unknown) => { this.inFlight -= 1; this.failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`); },
    );
    return this.tail;
  }

  private clearTimer(): void {
    if (this.timer !== undefined) this.timers.clearInterval(this.timer);
    this.timer = undefined;
  }
}
