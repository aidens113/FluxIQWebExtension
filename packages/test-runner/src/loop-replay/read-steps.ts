// A run's step log, read back as the loops it held: one list of events per loop,
// for Core's loop detector (`automationStudioLlmLoopReplay`).
//
// **What a saved log gives.** Core's step folders (`step-log/` in Core) hold the
// call, its result and its meta. They hold no state digest: the digest is taken
// inside the domain and only "unchanged" or "changed" reaches the log. So a page
// here is a digest of the page view the result carried (or, for a look, of its
// `location`), with the view's handles and frame numbers taken out, because
// both are renumbered on every load (`repeat-guard/outcomes.ts` in Core,
// `run-muwaobm2-882cadd9`). That is close to the domain's digest and not equal
// to it, and the replay report says so.
//
// **What a log gives of a target.** Live, a call says what it really ran with
// (`draft.ranWith`), which names its control by fingerprint. A log does not keep
// it, so here a control is the line the last page view printed for its handle,
// with its place among lines the same (the third "Add to cart" on the page). That
// is the fingerprint for this replay, and `byHandle` turns it off to measure what
// it costs.
//
// **What leaves this file.** Tool ids, step numbers, closed codes and digests.
// A row, a page's text, a typed value or a model's words are read only to be
// digested and are never kept.

import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { automationStudioLlmLoopDigest, automationStudioLlmLoopMeaningfulInput, automationStudioLlmLoopRowBound, automationStudioLlmLoopRowDigests, type AutomationStudioLlmLoopReplayEvent } from "fluxiq/automation";
import type { JsonObject, JsonValue } from "fluxiq/core";

/** One loop's events, and who ran it. */
export type LoopReplayLoop = { role: string | null; briefId: string | null; events: AutomationStudioLlmLoopReplayEvent[] };

/** Tools that only look: Core's and the web domain's. */
const LOOKS: ReadonlySet<string> = new Set(["web.find_on_page", "web.describe_element", "web.detect_repeating_structure", "web.recovery.inspect", "web.recovery.detect_repeating_structure", "core.describe_nodes", "core.recall_result", "project.read_task"]);
/** Submissions of a whole Flow or part: repairs, which the record of what was tried holds. */
const SUBMISSIONS: ReadonlySet<string> = new Set(["core.submit_candidate", "core.submit_subflow"]);
/** Trials, whose gate owns how often they run (`ownRetestBound`, which a log does not keep). */
const TRIALS: ReadonlySet<string> = new Set(["core.test_candidate", "core.test_subflow"]);
/** A part run: its steps are logged as replays, so the decision is what stands for it. */
const RUN_FLOW = "core.run_flow";
/** A project supervisor's tools keyed on the build (`requestContextKey` live, which a log does not keep), and those whose acceptance moves it. */
const KEYED_ON_THE_BUILD: ReadonlySet<string> = new Set(["project.dispatch", "project.assemble"]);
const MOVES_THE_WORK: ReadonlySet<string> = new Set(["project.write_plan", "project.amend_plan", "project.dispatch", "project.assemble"]);
/** The node that reads a list. */
const READS_NODE = /extract|read/u;
/** What a read's rows are under in the web domain (`readRowsKey` on its binding). */
const READ_ROWS_KEY = "read.extracted";
/** The call ids Core gives a call no decision asked for: its opening, a rerun measured as its amendment, a stall's recovery. */
const NOT_THE_MODEL = /^(?:initial\.|rerun\.|core\.stall_recovery\.)/u;
/** The codes a log records a call refused unrun or answered from memory under. */
const REPEAT_REFUSED = "llm_evidence_loop.repeat_refused";
const ANSWERED: ReadonlySet<string> = new Set(["llm_evidence_loop.already_answered", "llm_evidence_loop.already_observed", "llm_evidence_loop.looked_again_unchanged"]);
const AMENDMENT_UNDONE = "llm_evidence_loop.draft_amendment_undone";

const record = (value: unknown): Record<string, unknown> | undefined => typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const text = (value: unknown): string | undefined => typeof value === "string" && value !== "" ? value : undefined;
const digest = (value: string): string => createHash("sha256").update(value).digest("hex").slice(0, 24);

/** A page view with what every load renumbers taken out. */
function viewDigest(location: string | undefined, page: string): string {
  return digest(`${location ?? ""}\u0000${page.replace(/\[frame \d+\]/gu, "[frame]").replace(/\bt\d+\b/gu, "t")}`);
}

/** The page a result leaves, when it says; `current` when it says nothing. */
function stateAfterOf(result: Record<string, unknown> | undefined, current: { state: string | undefined; location: string | undefined }): { state: string | undefined; location: string | undefined } {
  const location = text(result?.location);
  const page = text(result?.page);
  if (page !== undefined) return { state: viewDigest(location, page), location };
  if (location !== undefined && location !== current.location) return { state: digest(location), location };
  return current;
}

/** Each handle a page view printed: a digest of its line and its place among lines the same. Its text stays here. */
function handlesOf(page: string): Map<string, string> {
  const handles = new Map<string, string>();
  const places = new Map<string, number>();
  for (const line of page.split("\n")) {
    const printed = /^\s*(t\d+)\s+(.*)$/u.exec(line);
    if (!printed) continue;
    const words = printed[2]!.replace(/\s+/gu, " ").trim();
    const place = (places.get(words) ?? 0) + 1;
    places.set(words, place);
    handles.set(printed[1]!, digest(`${words}\u0000${place}`));
  }
  return handles;
}

/** What the last page view printed for the handle a call names, if it names one that view showed. */
function viewedTarget(view: ReadonlyMap<string, string>, input: JsonObject): string | undefined {
  const handle = record(record(input.parameters)?.target)?.handle;
  return typeof handle === "string" ? view.get(handle) : undefined;
}

/** Whether a call declared something lasting: the same reading as Core's `automationStudioFlowDraftDeclaresLasting`. */
function declaresLasting(input: JsonObject): boolean {
  const declared = input.consequences;
  return Array.isArray(declared) && declared.some((word) => typeof word !== "string" || (word.trim() !== "" && word.trim().toLowerCase() !== "none"));
}

function draftKeyOf(reading: { added: string; edits: ReadonlyMap<number, string> }): string {
  return automationStudioLlmLoopDigest([reading.added, [...reading.edits].sort((left, right) => left[0] - right[0])]);
}

/** A step file as text; a folder a run left unfinished may not have it. */
async function readText(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function readJson(file: string): Promise<unknown> {
  const raw = await readText(file);
  return raw === undefined ? undefined : parsed(raw);
}

/** One loop being read: its page, its draft and what the model last decided. */
type Reading = {
  loop: LoopReplayLoop;
  iteration: number;
  page: { state: string | undefined; location: string | undefined };
  /** The draft as far as a log can say, which holds no Flow signature: what the calls added, and the last edit of each step. */
  added: string;
  edits: Map<number, string>;
  editsBefore: Array<Map<number, string>>;
  /** What the last page view printed for each handle, by digest, with its place among lines the same. */
  view: Map<string, string>;
  /** The build as a project supervisor's refusals read it: a digest of what its plans and dispatches answered. */
  build: string;
  decision: Record<string, unknown> | undefined;
};

/**
 * Reads one run's `steps/` into the loops it held, in order. A loop is one role
 * and brief's run of decisions; a new one starts where the iteration count does.
 * A folder that cannot be read is passed over: a log is best-effort.
 */
export async function readLoopReplayLoops(stepsDirectory: string, options: { byHandle?: boolean } = {}): Promise<LoopReplayLoop[]> {
  const names = (await readdir(stepsDirectory, { withFileTypes: true })).filter((entry) => entry.isDirectory() && /^\d{4,}-/u.test(entry.name)).map((entry) => entry.name).sort();
  const loops: LoopReplayLoop[] = [];
  const open = new Map<string, Reading>();
  const reading = (meta: Record<string, unknown>, iteration: number | undefined): Reading => {
    const scope = `${String(meta.role)}|${String(meta.briefId)}|${String(meta.part)}|${String(meta.round)}`;
    const held = open.get(scope);
    if (held && (iteration === undefined || iteration > held.iteration)) {
      if (iteration !== undefined) held.iteration = iteration;
      return held;
    }
    const fresh: Reading = { loop: { role: text(meta.role) ?? null, briefId: text(meta.briefId) ?? null, events: [] }, iteration: iteration ?? 0, page: { state: undefined, location: undefined }, added: "added", edits: new Map(), editsBefore: [], view: new Map(), build: "build", decision: undefined };
    loops.push(fresh.loop);
    open.set(scope, fresh);
    return fresh;
  };
  for (const name of names) {
    const folder = path.join(stepsDirectory, name);
    const step = Number(name.slice(0, name.indexOf("-")));
    const kind = name.slice(name.indexOf("-") + 1);
    const meta = record(await readJson(path.join(folder, "meta.json")));
    if (!meta) continue;
    if (kind === "decide") {
      const iteration = typeof meta.iteration === "number" ? meta.iteration : undefined;
      const current = reading(meta, iteration);
      current.decision = record(record(record(await readJson(path.join(folder, "decision.json")))?.response)?.decision);
      const runFlow = current.decision?.kind === "tool_call" && current.decision.toolId === RUN_FLOW ? record(current.decision.input) as JsonObject | undefined : undefined;
      if (runFlow) current.loop.events.push({
        kind: "call", step, proposes: true,
        // Keyed on the draft, as the loop keys a part run live (`draftOf`).
        call: { callId: name, toolId: RUN_FLOW, input: { ...runFlow, draft: draftKeyOf(current) }, ...(current.page.state !== undefined ? { stateBefore: current.page.state, stateAfter: current.page.state } : {}), effect: "observe", effectApplied: false, refused: false, draftKey: draftKeyOf(current) },
        resultCode: "core.run_flow"
      });
    } else if (kind.startsWith("test-")) {
      for (const held of open.values()) if (held.loop.role === (text(meta.role) ?? null) && held.loop.briefId === (text(meta.briefId) ?? null)) held.loop.events.push({ kind: "moved", step });
    } else if (kind.startsWith("tool-")) {
      const current = reading(meta, undefined);
      const call = record(await readJson(path.join(folder, "call.json")));
      const raw = await readText(path.join(folder, "result.json"));
      const toolId = text(call?.toolId);
      const input = record(call?.input) as JsonObject | undefined;
      if (!toolId || !input) continue;
      const callId = text(call?.callId) ?? name;
      const result = raw === undefined ? undefined : record(parsed(raw));
      const look = LOOKS.has(toolId);
      const reads = toolId === "core.run_node" && READS_NODE.test(text(input.node) ?? "");
      const effect: "observe" | "mutate" = look || reads ? "observe" : "mutate";
      const effectApplied = meta.effectApplied === true;
      const refused = result?.ok === false;
      const gateOwned = TRIALS.has(toolId) && effectApplied;
      const before = current.page;
      const targetWords = viewedTarget(current.view, input);
      current.page = stateAfterOf(result, before);
      if (typeof result?.page === "string") current.view = handlesOf(result.page);
      // A trial moved the page and reports none, so what stands now is not known until a call says.
      if (gateOwned) current.page = { state: undefined, location: undefined };
      const context = KEYED_ON_THE_BUILD.has(toolId) ? current.build : undefined;
      if (MOVES_THE_WORK.has(toolId) && !refused && raw !== undefined) current.build = digest(`${current.build}${raw}`);
      const replayed = input.replay !== undefined || NOT_THE_MODEL.test(callId) || record(current.decision)?.kind === "amend_draft";
      const written = input.write === true && text(meta.resultCode) === "core.run_node.written";
      const rows = result ? automationStudioLlmLoopRowDigests(result as JsonObject, READ_ROWS_KEY) : undefined;
      if (current.decision?.add === true && !refused && (effect === "observe" || effectApplied)) current.added = automationStudioLlmLoopDigest([current.added, toolId, automationStudioLlmLoopMeaningfulInput(input)]);
      const resultCode = text(meta.resultCode);
      const resultReason = text(meta.resultReason);
      current.loop.events.push({
        kind: "call",
        step,
        proposes: !look,
        call: {
          callId, toolId, input,
          ...(context !== undefined ? { context } : {}),
          ...(current.page.location !== undefined ? { placeAfter: digest(current.page.location) } : {}),
          ...(targetWords !== undefined && !options.byHandle ? { ranAs: { ...input, parameters: { ...(record(input.parameters) as JsonObject), target: { fingerprint: targetWords } } }, targetWords } : {}),
          ...(declaresLasting(input) || current.decision?.act !== undefined ? { lasting: true } : {}),
          ...(input.undoes !== undefined ? { undo: true } : {}),
          ...(automationStudioLlmLoopRowBound(input) ? { rowBound: true } : {}),
          ...(before.state !== undefined ? { stateBefore: before.state } : {}),
          ...(current.page.state !== undefined ? { stateAfter: current.page.state } : {}),
          effect, effectApplied, refused,
          ...(rows ? { rows } : {}),
          ...(raw !== undefined ? { answer: digest(raw) } : {}),
          draftKey: draftKeyOf(current),
          ...(SUBMISSIONS.has(toolId) ? { fix: true } : {}),
          ...(TRIALS.has(toolId) ? { judges: true } : {}),
          ...((SUBMISSIONS.has(toolId) || MOVES_THE_WORK.has(toolId)) && !refused ? { accepted: true } : {}),
          ...(replayed || written || gateOwned ? { exempt: true } : {})
        },
        ...(resultCode ? { resultCode } : {}),
        ...(resultReason ? { resultReason } : {}),
        ...(raw !== undefined ? { answerText: raw } : {})
      });
      current.decision = undefined;
    } else if (kind.startsWith("answer-")) {
      const current = reading(meta, undefined);
      const decision = current.decision;
      current.decision = undefined;
      const code = text(meta.resultCode);
      const decided = record(decision);
      if (decided?.kind === "amend_draft") {
        const result = record(await readJson(path.join(folder, "result.json")));
        const applied = typeof result?.applied === "number" ? result.applied : 0;
        const undone = code === AMENDMENT_UNDONE;
        const key = automationStudioLlmLoopDigest(automationStudioLlmLoopMeaningfulInput({ amendments: decided.amendments as JsonValue }));
        const draftBefore = draftKeyOf(current);
        if (undone) current.edits = current.editsBefore.pop() ?? current.edits;
        else if (applied > 0) {
          current.editsBefore.push(new Map(current.edits));
          for (const amendment of Array.isArray(decided.amendments) ? decided.amendments as JsonObject[] : []) {
            if (typeof amendment.step === "number") current.edits.set(amendment.step, automationStudioLlmLoopDigest(automationStudioLlmLoopMeaningfulInput(amendment)));
          }
        }
        current.loop.events.push({ kind: "amended", step, amendment: { key, draftBefore, draftAfter: draftKeyOf(current), applied, undone } });
      } else if (decided?.kind === "tool_call" && (code === REPEAT_REFUSED || (code !== undefined && ANSWERED.has(code)))) {
        const toolId = text(decided.toolId);
        const input = record(decided.input) as JsonObject | undefined;
        if (!toolId || !input) continue;
        current.loop.events.push({ kind: code === REPEAT_REFUSED ? "guard_refused" : "answered", step, toolId, input, ...(current.page.state !== undefined ? { state: current.page.state } : {}) });
      }
    }
  }
  return loops.filter((loop) => loop.events.length > 0);
}

function parsed(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (error) {
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}
