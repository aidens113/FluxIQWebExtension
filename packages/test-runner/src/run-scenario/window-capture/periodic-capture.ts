import type { CapturedEvidenceEvent, CapturePolicy } from "@fluxiq-web-extension/test-evidence";

type Timers = { set: (callback: () => void, ms: number) => unknown; clear: (handle: unknown) => void };

export type PeriodicCaptureInput = {
  /** The run's capture policy: nothing is taken under `none`, and the periodic share stays inside `maxScreenshots`. */
  policy: Pick<CapturePolicy, "screenshots" | "maxScreenshots">;
  /** Publishes one checkpoint event through the run's evidence controller, which owns the picture, the quota and the bytes. */
  trigger: (summary: string, details: Record<string, unknown>) => Promise<Pick<CapturedEvidenceEvent, "screenshot">>;
  intervalMs?: number;
  nowMs?: () => number;
  timers?: Timers;
};

const DEFAULT_INTERVAL_MS = 15_000;
/** The share of `maxScreenshots` periodic pictures may use, so the run's own moments -- a failure above all -- still have room. */
const PERIODIC_SHARE = 0.8;

const realTimers: Timers = {
  set: (callback, ms) => { const handle = setTimeout(callback, ms); handle.unref(); return handle; },
  clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * A picture of the browser every 15 s while the run works, and one more as it
 * ends, so a review sees the build and the Flow run as they happened rather
 * than only the moments the run chose to publish.
 *
 * Each picture is a `checkpoint` evidence event published through the run's
 * own controller, so it is taken under `checkpoints` and `events` policies
 * alike and counted against the same `maxScreenshots` and `maxBytes`. Ticks
 * never overlap: the next is scheduled when the last has finished. It stops at
 * its share of the quota, when the controller answers `quota`, when a publish
 * fails, and at `stop`. It never throws, and its timer never keeps the process
 * alive; a failed publish is kept in `failure` rather than failing the run.
 */
export class PeriodicCapture {
  private readonly intervalMs: number;
  private readonly maxCaptures: number;
  private readonly nowMs: () => number;
  private readonly timers: Timers;
  private readonly startedAt: number;
  private timer: unknown;
  private inFlight: Promise<void> = Promise.resolve();
  private running = false;
  private stopped = false;
  private taken = 0;
  /** The first publish that failed; periodic capture stops there. */
  failure: unknown;

  constructor(private readonly input: PeriodicCaptureInput) {
    this.intervalMs = input.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.maxCaptures = input.policy.screenshots === "none" ? 0 : Math.floor(input.policy.maxScreenshots * PERIODIC_SHARE);
    this.nowMs = input.nowMs ?? Date.now;
    this.timers = input.timers ?? realTimers;
    this.startedAt = this.nowMs();
  }

  /** Begins the periodic pictures; a second call, or one after `stop`, does nothing. */
  start(): void {
    if (this.running || this.stopped || this.maxCaptures === 0) return;
    this.running = true;
    this.schedule();
  }

  /** Ends the periodic pictures, waits for one in flight, and takes the closing picture when asked. */
  async stop(options: { finalCapture: boolean }): Promise<void> {
    this.stopped = true;
    this.timers.clear(this.timer);
    await this.inFlight;
    if (options.finalCapture && this.input.policy.screenshots !== "none" && this.failure === undefined && this.running) {
      await this.publish("The browser as the run ended", { periodic: false, final: true });
    }
  }

  private schedule(): void {
    if (this.stopped || this.taken >= this.maxCaptures) return;
    this.timer = this.timers.set(() => {
      this.inFlight = this.tick();
    }, this.intervalMs);
  }

  private async tick(): Promise<void> {
    if (this.stopped) return;
    this.taken += 1;
    const quotaReached = await this.publish("Periodic view of the browser", { periodic: true, sequence: this.taken });
    if (!quotaReached) this.schedule();
  }

  /** Answers whether periodic capture must stop: the controller's quota is spent, or the publish failed. */
  private async publish(summary: string, details: Record<string, unknown>): Promise<boolean> {
    try {
      const event = await this.input.trigger(summary, { ...details, elapsedMs: this.nowMs() - this.startedAt });
      return event.screenshot?.suppressed === "quota";
    } catch (error) {
      this.failure ??= error;
      return true;
    }
  }
}
