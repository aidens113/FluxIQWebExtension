import { webResetResource } from "../../llm-evidence/control-spot";
import { screenedEvidenceUrl } from "../../llm-evidence/location";
import { sanitizeWebLlmSnapshotWithBindings } from "../../llm-evidence/sanitize";
import type { WebLlmSnapshotBinding } from "../../llm-evidence";
import { webTargetObservation } from "./classify-observation";
import type { WebTargetObservation } from "./observation";
import type { WebTargetCaptureProvenance } from "./provenance";
import type { WebTargetScope } from "./scope";

/** Correlate browser-owned capture context before giving a snapshot to identity matching. */
export function webCapturedTargetObservation(input: {
  snapshot: unknown;
  page?: WebLlmSnapshotBinding;
  sessionId: unknown;
  sourceId: unknown;
  requested: WebTargetScope;
  previous?: WebTargetCaptureProvenance;
}): { kind: "observed"; observation: WebTargetObservation } | { kind: "rejected"; reason: "invalid_source" | "resource_mismatch" } {
  const resetResource = webResetResource(input.sessionId, input.sourceId);
  const source = typeof input.sourceId === "string" ? /^tab:(\d+):frame:(\d+)$/u.exec(input.sourceId) : null;
  const browserTabId = source === null ? undefined : Number(source[1]);
  const browserFrameId = source === null ? undefined : Number(source[2]);
  if (resetResource === undefined || typeof input.sessionId !== "string" || browserTabId === undefined || browserFrameId === undefined || !Number.isSafeInteger(browserTabId) || !Number.isSafeInteger(browserFrameId)) return { kind: "rejected", reason: "invalid_source" };
  const requested = input.requested;
  if ((requested.sessionId !== undefined && requested.sessionId !== input.sessionId)
    || (requested.browserTabId !== undefined && requested.browserTabId !== browserTabId)
    || (requested.browserFrameId !== undefined && requested.browserFrameId !== browserFrameId)
    || (requested.resetResource !== undefined && requested.resetResource !== resetResource)) return { kind: "rejected", reason: "resource_mismatch" };
  const raw = record(input.snapshot);
  const navigation = record(record(raw?.evidence)?.navigation);
  const location = safeLocation(raw?.url);
  const timeOrigin = typeof navigation?.timeOrigin === "number" && Number.isFinite(navigation.timeOrigin) && navigation.timeOrigin >= 0 ? navigation.timeOrigin : undefined;
  if (requested.browserFrameUrlPath !== undefined && location !== undefined && new URL(location).pathname !== requested.browserFrameUrlPath) return { kind: "rejected", reason: "resource_mismatch" };
  const scope: WebTargetScope = {
    kind: requested.kind,
    sessionId: input.sessionId,
    browserTabId,
    browserFrameId,
    resetResource,
    ...(requested.browserFrameUrlPath === undefined ? {} : { browserFrameUrlPath: requested.browserFrameUrlPath }),
    ...(location === undefined ? {} : { location }),
    ...(timeOrigin === undefined ? {} : { timeOrigin })
  };
  const page = input.page ?? sanitizeWebLlmSnapshotWithBindings(input.snapshot);
  const observation = webTargetObservation({ snapshot: input.snapshot, page, scope, samePlace: samePlace(input.previous, scope) });
  return { kind: "observed", observation };
}

function samePlace(previous: WebTargetCaptureProvenance | undefined, current: WebTargetScope): "yes" | "no" | "unknown" {
  const before = previous?.scope;
  if (before?.sessionId === undefined || before.resetResource === undefined || before.browserTabId === undefined || before.browserFrameId === undefined || before.location === undefined || before.timeOrigin === undefined || current.location === undefined || current.timeOrigin === undefined) return "unknown";
  return before.sessionId === current.sessionId && before.resetResource === current.resetResource && before.browserTabId === current.browserTabId && before.browserFrameId === current.browserFrameId && before.location === current.location && before.timeOrigin === current.timeOrigin ? "yes" : "no";
}

function safeLocation(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const screened = screenedEvidenceUrl(value);
  if (screened === undefined) return undefined;
  const location = new URL(value).href;
  return location === screened ? location : undefined;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
