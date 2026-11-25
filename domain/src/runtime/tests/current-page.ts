import assert from "node:assert/strict";
import { shownPageLines, type ShownPageLine } from "../llm-evidence/page-view/tests/shown-page-lines";

/**
 * Read only the current page the scripted provider was shown, as a model reads it (page-diff D1, P-b): Core's page
 * channel shows each result's page in place, whole the first time a window meets its page key and as change lines
 * after, so the current page is the newest whole delivery of the newest page key with the changes after it applied.
 * A window from before the channel carries the page in `core.current_view`, read as it always was.
 */
export function currentPageLines(evidence: readonly Record<string, unknown>[]): ShownPageLine[] {
  const delivered = deliveredPage(evidence);
  if (delivered !== undefined) return shownPageLines({ page: delivered });
  const current = evidence.find((entry) => entry.toolId === "core.current_view");
  assert.ok(isRecord(current?.value), "the decision must carry the page, delivered in place or as its current view");
  assert.ok(Array.isArray(current.value.groups), "the current view must publish its groups");
  const page = current.value.groups.filter(isRecord).find((group) => group.group === "top");
  assert.ok(isRecord(page?.value), "the current view must publish the page group");
  return shownPageLines(page.value);
}

/** The newest page key's lines rebuilt from its deliveries, or `undefined` when no result carries one. */
function deliveredPage(evidence: readonly Record<string, unknown>[]): string | undefined {
  const pages = new Map<string, string[]>();
  let current: string | undefined;
  for (const entry of evidence) {
    const delivery = isRecord(entry.value) ? entry.value.pageView : undefined;
    if (!isRecord(delivery) || typeof delivery.key !== "string" || delivery.recalled === true) continue;
    if (typeof delivery.whole === "string") {
      pages.set(delivery.key, delivery.whole.split("\n"));
      current = delivery.key;
    } else if (typeof delivery.changes === "string") {
      const before = pages.get(delivery.key);
      assert.ok(before, `the window carries changes to page ${delivery.key} without its whole page`);
      pages.set(delivery.key, withChanges(before, delivery.changes.split("\n")));
      current = delivery.key;
    } else if (delivery.unchanged === true && pages.has(delivery.key)) current = delivery.key;
  }
  return current === undefined ? undefined : pages.get(current)!.join("\n");
}

/**
 * `before` with a delivery's change lines applied in order: a group opens with the unchanged line before it, after
 * two spaces; then `- ` a line that left, `+ ` one that arrived, `~ ` one that now reads as shown, matched by its
 * leading handle or else its first word. The same reading as the Lab's scripted model
 * (`packages/test-runner/src/attempt-lane/scripted-model/scripts/page-changes.ts`), which this package cannot import.
 */
function withChanges(before: readonly string[], changes: readonly string[]): string[] {
  const keyOf = (text: string): string => /^t\d+\b/u.exec(text)?.[0] ?? /^\S*/u.exec(text)?.[0] ?? "";
  const out: string[] = [];
  let at = 0;
  const advance = (found: (line: string) => boolean): boolean => {
    for (let index = at; index < before.length; index += 1) {
      if (!found(before[index]!)) continue;
      out.push(...before.slice(at, index));
      at = index + 1;
      return true;
    }
    return false;
  };
  for (const change of changes) {
    const mark = change.slice(0, 2);
    const text = change.slice(2);
    if (mark === "  ") {
      if (advance((line) => line === text)) out.push(text);
    } else if (mark === "- ") {
      advance((line) => line === text);
    } else if (mark === "+ ") {
      out.push(text);
    } else if (mark === "~ ") {
      const key = keyOf(text);
      advance((line) => keyOf(line) === key);
      out.push(text);
    }
  }
  out.push(...before.slice(at));
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
