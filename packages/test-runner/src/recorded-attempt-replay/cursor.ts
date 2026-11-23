import { admitRecordedAttempt } from "./admit.js";
import { recordedRequestDigest } from "./request-digest.js";
import type { RecordedAttemptArtifact, RecordedExchange, ReplayDivergence } from "./types.js";

/** Independent ordered streams; the first mismatch stops the entire playback, with no lookahead. */
export function recordedReplyCursor(artifact: RecordedAttemptArtifact) {
  const admission = admitRecordedAttempt(artifact);
  if (!admission.admitted) throw new Error(`recorded_artifact_not_admitted:${admission.gaps.join(",")}`);
  const streams = new Map<string, RecordedExchange[]>();
  for (const exchange of artifact.exchanges) streams.set(exchange.stream, [...(streams.get(exchange.stream) ?? []), { ...exchange, response: Uint8Array.from(exchange.response!) }]);
  const consumed = new Map<string, number>();
  let divergence: ReplayDivergence | null = null;
  const take = (stream: string, request: string): RecordedExchange | null => {
    if (divergence) return null;
    const ordinal = (consumed.get(stream) ?? 0) + 1;
    const entries = streams.get(stream);
    const expected = entries?.[ordinal - 1];
    let actualDigest: string | null = null;
    try { actualDigest = recordedRequestDigest(request); } catch { /* best-effort: unreadable request is classified and latched below */ }
    const expectedDigest = expected ? recordedRequestDigest(expected.request) : null;
    const code = !entries ? "unknown_stream" : !expected ? "exhausted_stream" : actualDigest === null ? "unreadable_request" : actualDigest !== expectedDigest ? "request_changed" : null;
    if (code) {
      divergence = { code, stream, ordinal, expectedDigest, actualDigest };
      return null;
    }
    consumed.set(stream, ordinal);
    return { ...expected!, response: Uint8Array.from(expected!.response!) };
  };
  return {
    take,
    report: () => ({ divergence, logicalCalls: [...consumed.values()].reduce((sum, count) => sum + count, 0), externalUsd: 0 as const, complete: divergence === null && [...streams].every(([stream, entries]) => consumed.get(stream) === entries.length) }),
  };
}
