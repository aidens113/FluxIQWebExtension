// Whether a command's `metadata` asks for its observation to be traced: Core
// stamps `metadata.trace = { artifacts: true }` (`ClientGatewayTraceRequest`)
// on each action command it traces. Anything else -- no metadata, another
// shape, `artifacts` not exactly `true` -- is not a request, and the command
// runs and answers exactly as an untraced one.

import { TRACE_METADATA_KEY } from "./metadata-key";

export function isTraceRequest(metadata: unknown): boolean {
  if (typeof metadata !== "object" || metadata === null) return false;
  const request = (metadata as Record<string, unknown>)[TRACE_METADATA_KEY];
  if (typeof request !== "object" || request === null) return false;
  return (request as Record<string, unknown>).artifacts === true;
}
