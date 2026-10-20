// One run of Core's trace replay harness under a deadline. A throw or a
// harness that never finishes becomes closed failure text: an error's own
// text may quote what the trace held, so only its kind leaves.

import type { ClientGatewayTraceParityReport, ClientGatewayTraceStore } from "fluxiq/client-gateway";
import type { TraceReplay } from "./types.js";

export type TraceReplayAttempt = Readonly<{ report: ClientGatewayTraceParityReport | null; failure: string | null; durationMs: number }>;

export async function replayWithDeadline(replay: TraceReplay, store: ClientGatewayTraceStore, traceId: string, deadlineMs: number): Promise<TraceReplayAttempt> {
  const startedAt = Date.now();
  let timer: NodeJS.Timeout | undefined;
  try {
    // Not unref'd: a harness that hangs with nothing else alive must still reach the deadline, so the result is written.
    const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new ParityDeadline(deadlineMs)), deadlineMs); });
    const report = await Promise.race([replay({ store, traceId }), deadline]);
    return Object.freeze({ report, failure: null, durationMs: Date.now() - startedAt });
  } catch (error) {
    const failure = error instanceof ParityDeadline ? error.message : `the harness threw ${error instanceof Error ? error.name : "a non-error value"} (text withheld)`;
    return Object.freeze({ report: null, failure, durationMs: Date.now() - startedAt });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

class ParityDeadline extends Error {
  constructor(deadlineMs: number) {
    super(`the replay did not finish within ${deadlineMs} ms`);
    this.name = "ParityDeadline";
  }
}
