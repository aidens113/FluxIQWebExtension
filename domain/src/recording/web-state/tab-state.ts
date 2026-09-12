import type { StateSnapshot } from "fluxiq/automation-studio";
import { createWebAutomationInitialState } from "../state";
import { putStateValue } from "./state-values";
import type { WebAutomationTabStateInput } from "./types";

// Browser-level state, captured without a content script: which tab is active,
// how many are open, whether recording is on, and what the extension has been
// granted. No DOM is involved, so nothing here overlaps the snapshot pipeline.
export function createWebAutomationStateFromTabs(
  active: WebAutomationTabStateInput | undefined,
  tabs: WebAutomationTabStateInput[],
  input: { timestamp?: number; sourceId?: string; recording?: boolean; permissions?: string[] } = {}
): StateSnapshot {
  const timestamp = input.timestamp ?? Date.now();
  let state = createWebAutomationInitialState(timestamp);
  if (active?.url) state = putStateValue(state, "page.url", "string", active.url, timestamp, input.sourceId, { elementKind: "url" });
  if (active?.title) state = putStateValue(state, "page.title", "string", active.title, timestamp, input.sourceId, { elementKind: "text" });
  if (active?.tabId !== undefined) state = putStateValue(state, "browser.activeTabId", "integer", active.tabId, timestamp, input.sourceId, { elementKind: "internal_id" });
  state = putStateValue(state, "browser.tabCount", "integer", tabs.length, timestamp, input.sourceId, { elementKind: "count" });
  state = putStateValue(state, "recording.active", "boolean", input.recording === true, timestamp, input.sourceId, { elementKind: "status" });
  if (input.permissions?.length) state = putStateValue(state, "browser.permissions", "json", input.permissions, timestamp, input.sourceId, { elementKind: "collection", comparable: false });
  return state;
}
