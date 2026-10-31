import type { WebLlmSnapshotBinding } from "../../../sanitize";
import type { WebNodeFrozenScope } from "../types";

/** Only positive browser-owned capture claims can bind an implicit scope. */
export function webNodeFrozenScope(page: WebLlmSnapshotBinding | undefined, sessionId: string): WebNodeFrozenScope | undefined {
  const scope = page?.captureProvenance?.scope;
  if (scope?.sessionId !== sessionId || typeof scope.resetResource !== "string" || scope.resetResource === "" || typeof scope.location !== "string" || scope.location === "" || typeof scope.timeOrigin !== "number" || !Number.isFinite(scope.timeOrigin) || scope.timeOrigin < 0) return undefined;
  if (![scope.browserTabId, scope.browserFrameId].every((id) => typeof id === "number" && Number.isSafeInteger(id) && id >= 0)) return undefined;
  return Object.freeze({ ...scope }) as WebNodeFrozenScope;
}
