import { countOverlayChanges } from "./count-overlay-changes.js";
import { readOverlaySample, type OverlayCdp } from "./read-overlay-sample.js";
import type { OverlaySample, OverlaySampleWindow } from "./types.js";

export type OverlayWindowOptions = {
  cdp: OverlayCdp;
  secrets: readonly string[];
  /** The screened location of the sampled tab, kept with the window. */
  pageUrl?: string;
  intervalMs?: number;
  durationMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** One read; the real one is `readOverlaySample`. Replaced in tests. */
  read?: (cdp: OverlayCdp, atMs: number, secrets: readonly string[]) => Promise<OverlaySample>;
};

const OVERLAY_SAMPLE_INTERVAL_MS = 200;
const OVERLAY_SAMPLE_DURATION_MS = 3_000;

/**
 * Reads the overlay about every `intervalMs` for `durationMs` and says what the
 * reads show. Reads are scheduled from the window's start rather than one after
 * another, so a slow read shortens the wait before the next one instead of
 * stretching the window; a read slower than the interval is followed at once.
 */
export async function sampleOverlayWindow(options: OverlayWindowOptions): Promise<OverlaySampleWindow> {
  const intervalMs = options.intervalMs ?? OVERLAY_SAMPLE_INTERVAL_MS;
  const durationMs = options.durationMs ?? OVERLAY_SAMPLE_DURATION_MS;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? (ms => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const read = options.read ?? readOverlaySample;
  const started = now();
  const samples: OverlaySample[] = [];
  for (let index = 0; index * intervalMs <= durationMs; index += 1) {
    const due = started + index * intervalMs;
    const wait = due - now();
    if (wait > 0) await sleep(wait);
    samples.push(await read(options.cdp, Math.max(0, now() - started), options.secrets));
  }
  return { startedAt: new Date(started).toISOString(), intervalMs, durationMs, ...(options.pageUrl === undefined ? {} : { pageUrl: options.pageUrl }), samples, counts: countOverlayChanges(samples) };
}
