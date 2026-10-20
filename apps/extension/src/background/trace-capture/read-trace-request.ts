// A command's trace request as the capture uses it: Core stamps
// `metadata.trace = { artifacts: true, scope? }` (`ClientGatewayTraceRequest`)
// on each action command it traces, `scope` naming the trace the command is
// recorded into. `undefined` when the metadata is not a request -- no
// metadata, another shape, `artifacts` not exactly `true` -- and the command
// runs and answers exactly as an untraced one. A scope that is not a nonempty
// string is read as no scope: the command is still traced, recorded per Core.

import { TRACE_METADATA_KEY } from "./metadata-key";
import type { TraceRequest } from "./types";

export function readTraceRequest(metadata: unknown): TraceRequest | undefined {
  if (typeof metadata !== "object" || metadata === null) return undefined;
  const request = (metadata as Record<string, unknown>)[TRACE_METADATA_KEY];
  if (typeof request !== "object" || request === null) return undefined;
  const { artifacts, scope } = request as Record<string, unknown>;
  if (artifacts !== true) return undefined;
  return typeof scope === "string" && scope.length > 0 ? { scope } : {};
}
