import type { ObservedCoreCall } from "../../core-recording-proxy.js";

/** The program endpoints the extension chat reads a thread, or its list, through. Writes are `append-turn` and `open-conversation`. */
const READ_ENDPOINTS: ReadonlySet<string> = new Set(["get-conversation", "list-conversations"]);

/** The reads the extension itself made at or after `sinceMs`, oldest first. Only calls that carried the extension's credential count. */
export function extensionReadsSince(calls: readonly Pick<ObservedCoreCall, "at" | "endpoint" | "bearer">[], sinceMs: number): Array<{ at: number; endpoint: string }> {
  return calls
    .filter((call) => call.bearer && call.endpoint !== null && READ_ENDPOINTS.has(call.endpoint) && call.at >= sinceMs)
    .map((call) => ({ at: call.at, endpoint: call.endpoint as string }));
}

/** True once no extension read has been recorded for `quietMs` (or since `floorMs` when the chat has never read). */
export function chatIsQuiet(calls: readonly Pick<ObservedCoreCall, "at" | "endpoint" | "bearer">[], nowMs: number, quietMs: number, floorMs: number): boolean {
  const reads = extensionReadsSince(calls, floorMs);
  const last = reads.length > 0 ? reads[reads.length - 1]!.at : floorMs;
  return nowMs - last >= quietMs;
}

/** One answer to a request for the panel's change stream, as the browser reported it. */
export type StreamOpening = { at: number; status: number };

/** True when the stream was opened (answered 200) strictly after `afterMs`. */
export function streamOpenedAfter(openings: readonly StreamOpening[], afterMs: number): boolean {
  return openings.some((opening) => opening.status === 200 && opening.at > afterMs);
}
