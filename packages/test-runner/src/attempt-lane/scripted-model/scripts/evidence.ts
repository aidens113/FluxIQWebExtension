import { webLlmShownPageText } from "@fluxiq-web-extension/domain/node";
import type { ScriptedModelRequest } from "../wire-request.js";
import { applyPageChanges } from "./page-changes.js";

/** One entry of a decision's evidence window, as Core wrote it into the request. */
export type EvidenceEntry = Readonly<{ callId: string; toolId: string; value: Readonly<Record<string, unknown>> }>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** The decision's evidence window, in the order things happened. */
export function evidenceOf(request: ScriptedModelRequest): readonly EvidenceEntry[] {
  const context = request.payload?.context;
  const loop = isRecord(context) ? context.evidenceLoop : undefined;
  const evidence = isRecord(loop) ? loop.evidence : undefined;
  return Array.isArray(evidence) ? evidence.filter((entry): entry is EvidenceEntry => isRecord(entry) && typeof entry.toolId === "string" && isRecord(entry.value)) : [];
}

/** Core's one trailing entry holding the page deliveries (t1080). */
const PAGE_WINDOW_TOOL_ID = "core.page_window";

/**
 * The page the work is on, from Core's trailing page window (t1080): the page marked `current`, from its first whole
 * delivery (a part answer, which names the delivery it is `from`, is not the page's start), with each later `changes`
 * applied in order. Undefined when the request carries no window, or the window holds no current page.
 */
function windowPageOf(evidence: readonly EvidenceEntry[]): string | undefined {
  const window = evidence.find((entry) => entry.toolId === PAGE_WINDOW_TOOL_ID);
  const pages = window && Array.isArray(window.value.pages) ? window.value.pages : [];
  const held = pages.find((page) => isRecord(page) && page.current === true && page.recalled !== true);
  const shown = isRecord(held) && Array.isArray(held.shown) ? held.shown.filter(isRecord) : [];
  let lines: string[] | undefined;
  for (const delivery of shown) {
    if (delivery.from !== undefined) continue;
    if (typeof delivery.whole === "string") lines = delivery.whole.split("\n");
    else if (typeof delivery.changes === "string") {
      if (lines === undefined) throw new Error(`The page window carries changes to page ${String(held?.key)} without its whole page`);
      lines = applyPageChanges(lines, delivery.changes.split("\n"));
    }
  }
  return lines?.join("\n");
}

/**
 * The page as it stands now, rebuilt as a model would from the deliveries the request carries (page-diff D1): since
 * t1080 from Core's trailing `core.page_window` (`windowPageOf`). A request from before t1080 carries each delivery
 * in its result instead: the newest whole delivery of the newest result's page key, then the `changes` after it,
 * applied in order; a reference (`replacedBy`, `droppedAt`), a recalled page or unchanged adds nothing. A request from
 * before the page channel holds the page itself, or `core.current_view`'s, and is read as it always was.
 */
export function currentPageOf(request: ScriptedModelRequest): string {
  const fromWindow = windowPageOf(evidenceOf(request));
  if (fromWindow !== undefined) return fromWindow;
  const pages = new Map<string, string[]>();
  let current: string | undefined;
  for (const entry of evidenceOf(request)) {
    const delivery = entry.value.pageView;
    if (!isRecord(delivery) || typeof delivery.key !== "string" || delivery.recalled === true) continue;
    if (typeof delivery.whole === "string") {
      pages.set(delivery.key, delivery.whole.split("\n"));
      current = delivery.key;
    } else if (typeof delivery.changes === "string") {
      const before = pages.get(delivery.key);
      if (before === undefined) throw new Error(`The request carries changes to page ${delivery.key} without its whole page`);
      pages.set(delivery.key, applyPageChanges(before, delivery.changes.split("\n")));
      current = delivery.key;
    } else if (delivery.unchanged === true && pages.has(delivery.key)) current = delivery.key;
  }
  if (current !== undefined) return pages.get(current)!.join("\n");
  const view = [...evidenceOf(request)].reverse().find((entry) => entry.toolId === "core.current_view");
  const groups = view && Array.isArray(view.value.groups) ? view.value.groups : [];
  for (const group of groups) {
    const value = isRecord(group) && isRecord(group.value) ? group.value : undefined;
    // A call's answer is the page itself, or holds the whole page answer as its `page`.
    const page = webLlmShownPageText(value) ?? webLlmShownPageText(value?.page);
    if (page !== undefined) return page;
  }
  // Before any newer result, the first call's page is the only one.
  for (const entry of [...evidenceOf(request)].reverse()) {
    const page = webLlmShownPageText(entry.value);
    if (page !== undefined) return page;
  }
  throw new Error("The request holds no page to read");
}

/** The first line of the page view matching `words`, with its handle: `t12 link "Our team" ~/team`. */
export function pageLine(page: string, words: RegExp): { handle: string; line: string } | undefined {
  for (const line of page.split("\n")) {
    const handle = /^(t\d+)\b/u.exec(line)?.[1];
    if (handle && words.test(line)) return { handle, line };
  }
  return undefined;
}

/** The newest evidence of `toolId`, where a script needs what a call of its own found. */
export function latestOf(request: ScriptedModelRequest, toolId: string): EvidenceEntry | undefined {
  return [...evidenceOf(request)].reverse().find((entry) => entry.toolId === toolId);
}

/** A tool-call decision, in the shape the request's schema asks for. */
export function toolCall(summary: string, callId: string, toolId: string, input: Record<string, unknown>, add = false): Record<string, unknown> {
  return { kind: "evidence_tool_decision", summary, decision: { kind: "tool_call", callId, toolId, input, ...(add ? { add: true } : {}) } };
}

/** A press of one control, read from the page by the words a person would look for. */
export function pressOf(request: ScriptedModelRequest, summary: string, callId: string, words: RegExp): Record<string, unknown> {
  const found = pageLine(currentPageOf(request), words);
  if (!found) throw new Error(`The page shows nothing matching ${String(words)} for "${summary}"`);
  return toolCall(summary, callId, "core.run_node", { node: "web.output.dom-click", parameters: { target: { handle: found.handle } }, consequences: [] }, true);
}

/** The words of a refused call's result: its code, and what it says of itself where it says. */
function refusalWords(value: Readonly<Record<string, unknown>>): string {
  const detail = isRecord(value.detail) ? value.detail : undefined;
  const instead = Array.isArray(detail?.instead) ? detail.instead.filter((item): item is string => typeof item === "string") : [];
  const parts = [typeof value.code === "string" ? value.code : undefined, typeof detail?.reason === "string" ? detail.reason : undefined, instead.length > 0 ? instead.join(", ") : undefined, typeof value.message === "string" ? value.message : undefined];
  return parts.filter((part): part is string => part !== undefined).join("; ") || JSON.stringify(value).slice(0, 300);
}

/**
 * The calls this decision's evidence says were done, by call id. A call whose result was refused (`ok: false`) is
 * not done: it stops the script at that step, with the refusal's words, so a broken script fails where it broke
 * and not many decisions later. `reported` names the calls whose refusal the script reads and reports itself, in
 * words of its own (a read it asks again on a fresh detection, a final read it will not keep); those are counted
 * and are not a stop here.
 */
export function callsMade(request: ScriptedModelRequest, reported: (callId: string) => boolean = () => false): ReadonlySet<string> {
  const made = new Set<string>();
  for (const entry of evidenceOf(request)) {
    if (entry.value.ok === false && !reported(entry.callId)) throw new Error(`The call ${entry.callId} (${entry.toolId}) was refused: ${refusalWords(entry.value)}`);
    made.add(entry.callId);
  }
  return made;
}

/** The rows a read's result holds: its own list, or the group of Core's current view its `core.view_reference` names, whatever that group is called. */
export function heldRowsOf(entry: EvidenceEntry, evidence: readonly EvidenceEntry[]): readonly unknown[] | undefined {
  const read = isRecord(entry.value.read) ? entry.value.read : undefined;
  if (read === undefined) return undefined;
  if (Array.isArray(read.extracted)) return read.extracted;
  const reference = isRecord(read.extracted) && isRecord(read.extracted["core.view_reference"]) ? read.extracted["core.view_reference"] : undefined;
  if (reference === undefined || reference.callId !== entry.callId || typeof reference.group !== "string") return undefined;
  const current = [...evidence].reverse().find((item) => item.toolId === "core.current_view");
  const groups = current && Array.isArray(current.value.groups) ? current.value.groups : [];
  const held = groups.find((group) => isRecord(group) && group.callId === reference.callId && group.group === reference.group && group.holder === "read");
  const rows = isRecord(held) && isRecord(held.value) ? held.value.extracted : undefined;
  return Array.isArray(rows) ? rows : undefined;
}
