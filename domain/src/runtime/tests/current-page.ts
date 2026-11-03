import assert from "node:assert/strict";
import { shownPageLines, type ShownPageLine } from "../llm-evidence/page-view/tests/shown-page-lines";

/** Read only the current page the scripted provider was shown, never an older result's view reference. */
export function currentPageLines(evidence: readonly Record<string, unknown>[]): ShownPageLine[] {
  const current = evidence.find((entry) => entry.toolId === "core.current_view");
  assert.ok(isRecord(current?.value), "the decision must publish its current view");
  assert.ok(Array.isArray(current.value.groups), "the current view must publish its groups");
  const page = current.value.groups.filter(isRecord).find((group) => group.group === "top");
  assert.ok(isRecord(page?.value), "the current view must publish the page group");
  return shownPageLines(page.value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
