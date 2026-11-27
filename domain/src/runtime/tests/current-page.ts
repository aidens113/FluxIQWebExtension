import assert from "node:assert/strict";
import { shownPageLines, type ShownPageLine } from "../llm-evidence/page-view/tests/shown-page-lines";

/** Core's one trailing entry holding the page deliveries (Core t1080, `runtime/llm/view-channel/window-tool-id.ts`). */
const PAGE_WINDOW_TOOL_ID = "core.page_window";

/**
 * Read only the current page the scripted provider was shown, as a model reads it (page-diff D1, P-b). Core's page
 * channel delivers a page whole the first time a window meets its page key and as change lines after. Since Core t1080
 * the deliveries sit in one trailing `core.page_window` entry and each result keeps only a note of its delivery
 * (`{ key, shown, in }`), so the current page is the window's page marked `current`, rebuilt from its whole delivery
 * with the changes after it applied (`windowPage`). A window from before t1080 carries each delivery in its result
 * (`deliveredPage`), and one from before the channel carries the page in `core.current_view`; both are read as they
 * always were.
 */
export function currentPageLines(evidence: readonly Record<string, unknown>[]): ShownPageLine[] {
  const delivered = windowPage(evidence) ?? deliveredPage(evidence);
  if (delivered !== undefined) return shownPageLines({ page: delivered });
  const current = evidence.find((entry) => entry.toolId === "core.current_view");
  assert.ok(isRecord(current?.value), "the decision must carry the page, delivered in its window, in place or as its current view");
  assert.ok(Array.isArray(current.value.groups), "the current view must publish its groups");
  const page = current.value.groups.filter(isRecord).find((group) => group.group === "top");
  assert.ok(isRecord(page?.value), "the current view must publish the page group");
  return shownPageLines(page.value);
}

/**
 * The page the window marks `current` (never a recalled copy), from its first whole delivery -- a part answer names the
 * delivery it is `from` and is not the page's start -- with each later `changes` applied in order; `undefined` when the
 * evidence carries no page window or the window marks no page current. The same reading as the Lab's scripted model
 * (`packages/test-runner/src/attempt-lane/scripted-model/scripts/evidence.ts`, `windowPageOf`), which this package
 * cannot import.
 */
function windowPage(evidence: readonly Record<string, unknown>[]): string | undefined {
  const window = evidence.find((entry) => entry.toolId === PAGE_WINDOW_TOOL_ID);
  const pages = isRecord(window?.value) && Array.isArray(window.value.pages) ? window.value.pages : [];
  const held = pages.find((page) => isRecord(page) && page.current === true && page.recalled !== true);
  const shown = isRecord(held) && Array.isArray(held.shown) ? held.shown.filter(isRecord) : [];
  let lines: string[] | undefined;
  for (const delivery of shown) {
    if (delivery.from !== undefined) continue;
    if (typeof delivery.whole === "string") lines = delivery.whole.split("\n");
    else if (typeof delivery.changes === "string") {
      assert.ok(lines, `the page window carries changes to page ${String(isRecord(held) ? held.key : "")} without its whole page`);
      lines = withChanges(lines, delivery.changes.split("\n"));
    }
  }
  return lines?.join("\n");
}

/** Before Core t1080: the newest page key's lines rebuilt from the deliveries its results carry, or `undefined` when none does. */
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
