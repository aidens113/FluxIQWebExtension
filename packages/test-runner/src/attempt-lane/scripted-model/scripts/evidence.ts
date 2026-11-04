import type { ScriptedModelRequest } from "../wire-request.js";

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

/** The page as it stands now, the words a model would read it from: the newest whole page in `core.current_view`. */
export function currentPageOf(request: ScriptedModelRequest): string {
  const view = [...evidenceOf(request)].reverse().find((entry) => entry.toolId === "core.current_view");
  const groups = view && Array.isArray(view.value.groups) ? view.value.groups : [];
  for (const group of groups) {
    const page = isRecord(group) && isRecord(group.value) ? group.value.page : undefined;
    if (typeof page === "string") return page;
  }
  // Before any newer result, the first call's page is the only one.
  for (const entry of [...evidenceOf(request)].reverse()) if (typeof entry.value.page === "string") return entry.value.page;
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
