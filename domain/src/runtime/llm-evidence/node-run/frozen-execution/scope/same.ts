import type { WebLlmSnapshotBinding } from "../../../sanitize";
import type { WebNodeFrozenScope } from "../types";
import { webNodeFrozenScope } from "./read";

/** Neither a new handle map nor a fresh capture is a new document authority. */
export function webNodeFrozenSameScope(before: WebNodeFrozenScope, page: WebLlmSnapshotBinding | undefined): boolean {
  const now = webNodeFrozenScope(page, before.sessionId);
  return now !== undefined && before.sessionId === now.sessionId && before.resetResource === now.resetResource && before.browserTabId === now.browserTabId && before.browserFrameId === now.browserFrameId && before.location === now.location && before.timeOrigin === now.timeOrigin && before.browserFrameUrlPath === now.browserFrameUrlPath;
}
