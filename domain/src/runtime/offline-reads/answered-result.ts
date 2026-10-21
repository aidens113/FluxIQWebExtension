// The `client.action_result` payload an offline read answers with (P5,
// tier 2): the content result the sandbox returned, built by the domain's
// gateway-result builder -- the one the extension's background answers a live
// command with -- standing in the recorded read's place. What the recorded
// result knew and the sandbox cannot is kept from it, read as data (Core hands
// the recorded payload over untyped):
// - its timings: the recorded `startedAt` and `completedAt` (falling back to
//   the recorded payload's `startedAt` and `finishedAt`) replace the sandbox's
//   wall clock on the content result before it is built, so the top level and
//   the payload agree and an offline answer is the same on every run;
// - its `metadata.trace`: the trace references Core strips from a result
//   before any consumer reads it, as the recorded result carried them;
// - its `payload.sourceId`: the worker-owned tab and frame the read ran in,
//   which the sandbox has none of and the builder is not given.
// Every other field is the builder's, from the sandbox's result.

import type { ClientGatewayActionResult, ClientGatewayTraceRecordedPayload } from "fluxiq/client-gateway";
import type { CLIENT_GATEWAY_TRACE_METADATA_KEY } from "fluxiq/client-gateway";
import type { JsonObject } from "fluxiq/core";
import type { WebAutomationActionResult } from "../../actions/types";
import { gatewayActionResultFromBrowserResult } from "../../client";

// Core's key, imported as a type only (see `./recorded-snapshot.ts`).
const TRACE_METADATA_KEY: typeof CLIENT_GATEWAY_TRACE_METADATA_KEY = "trace";

export function webOfflineReadAnsweredResult(result: WebAutomationActionResult, recordedResult: ClientGatewayTraceRecordedPayload): ClientGatewayActionResult {
  const recordedPayload = recordOf(recordedResult.payload);
  const startedAt = timeOf(recordedResult.startedAt) ?? timeOf(recordedPayload?.startedAt) ?? result.startedAt;
  const finishedAt = timeOf(recordedResult.completedAt) ?? timeOf(recordedPayload?.finishedAt) ?? result.finishedAt;
  const built = gatewayActionResultFromBrowserResult({ ...result, startedAt, finishedAt });
  const sourceId = recordedPayload?.sourceId;
  const trace = recordOf(recordedResult.metadata)?.[TRACE_METADATA_KEY];
  const answered: ClientGatewayActionResult = { ...built };
  if (typeof sourceId === "string") answered.payload = { ...(built.payload ?? {}), sourceId };
  if (trace !== undefined) answered.metadata = { ...(built.metadata ?? {}), [TRACE_METADATA_KEY]: trace } as JsonObject;
  return answered;
}

function timeOf(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
