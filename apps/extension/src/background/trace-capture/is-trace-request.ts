// Whether a command's `metadata` asks for its observation to be traced
// (`read-trace-request.ts` reads the request itself, with its scope).

import { readTraceRequest } from "./read-trace-request";

export function isTraceRequest(metadata: unknown): boolean {
  return readTraceRequest(metadata) !== undefined;
}
