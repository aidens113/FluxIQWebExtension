import type { WebTargetScope } from "../../../../target-reacquire/identity";
import type { WebNodeFrozenScope, WebNodeFrozenScopeInput } from "../types";
import { webNodeFrozenScope } from "./read";

/** Capture a targeted child separately; a merged top snapshot cannot prove it. */
export async function webNodeFrozenCommandScope(input: WebNodeFrozenScopeInput): Promise<WebNodeFrozenScope | undefined> {
  const { parameters } = input;
  const tab = parameters.browserTabId ?? parameters.tabId;
  const frame = parameters.browserFrameId ?? parameters.frameId;
  const path = parameters.browserFrameUrlPath;
  if ((tab !== undefined && (typeof tab !== "number" || !Number.isSafeInteger(tab) || tab < 0)) || (frame !== undefined && (typeof frame !== "number" || !Number.isSafeInteger(frame) || frame < 0)) || (path !== undefined && typeof path !== "string")) return undefined;
  const before = webNodeFrozenScope(input.before, input.sessionId);
  if (before === undefined) return undefined;
  if ((tab === undefined || tab === before.browserTabId) && (frame === undefined || frame === before.browserFrameId) && path === undefined) return before;
  const requested: WebTargetScope = {
    kind: "single-frame", sessionId: input.sessionId, browserTabId: typeof tab === "number" ? tab : before.browserTabId
  };
  if (typeof frame === "number") requested.browserFrameId = frame;
  else if (path === undefined) requested.browserFrameId = 0;
  if (typeof path === "string") requested.browserFrameUrlPath = path;
  const page = await input.look({ includeHidden: true, scope: requested });
  const actual = webNodeFrozenScope(page, input.sessionId);
  if (actual === undefined || actual.kind !== "single-frame" || actual.browserTabId !== requested.browserTabId || (requested.browserFrameId !== undefined && actual.browserFrameId !== requested.browserFrameId) || (path !== undefined && actual.browserFrameUrlPath !== path)) return undefined;
  return actual;
}
