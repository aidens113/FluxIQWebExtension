import { withDeadline } from "./with-deadline.js";

/** One way of photographing the browser: JPEG bytes, or a rejection saying why not. */
export type CaptureSource = { name: string; timeoutMs?: number; capture: (signal: AbortSignal) => Promise<Uint8Array> };

/** What one capture attempt produced: the first source that answered, and why each source before it did not. */
export type CaptureAttempt = { bytes?: Uint8Array; source?: string; failures: Array<{ source: string; reason: string }> };

/**
 * Tries each source in order and keeps the first picture, all inside one
 * deadline.
 *
 * Each source gets what is left of `deadlineMs`, capped by its own `timeoutMs`,
 * and a source reached with no time left is recorded as skipped rather than
 * started. It never rejects: a failed source is a reason in `failures`, and a
 * capture with no picture is an attempt without `bytes`, which the evidence
 * controller publishes as `capture-unavailable`.
 */
export async function captureFirstAvailable(sources: readonly CaptureSource[], deadlineMs: number, nowMs: () => number = Date.now): Promise<CaptureAttempt> {
  const failures: CaptureAttempt["failures"] = [];
  const endsAt = nowMs() + deadlineMs;
  for (const source of sources) {
    const remaining = Math.min(endsAt - nowMs(), source.timeoutMs ?? Number.POSITIVE_INFINITY);
    if (remaining <= 0) {
      failures.push({ source: source.name, reason: "no time was left in the capture deadline" });
      continue;
    }
    try {
      const bytes = await withDeadline(source.capture, remaining, source.name);
      if (bytes.byteLength > 0) return { bytes, source: source.name, failures };
      failures.push({ source: source.name, reason: "returned an empty image" });
    } catch (error) {
      failures.push({ source: source.name, reason: describe(error) });
    }
  }
  return { failures };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
