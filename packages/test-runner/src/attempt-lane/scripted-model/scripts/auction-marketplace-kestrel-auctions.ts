// Provider-free honest path for the realistic Kestrel auctions task, built from the decisions of a live first attempt that
// answered right (run-mwz2jc4w-0c207128, attempt 1): decline the cookies, search, narrow to auctions with the site's own
// filter, read every column of the result list, advance its pages in a loop, and let the declared processing cut the rows.
// Test data: every control and column is found on the delivered page or in the detection's own evidence, by its words,
// never by a handle that changes between runs.
import type { ScriptedModelScript, ScriptedReply } from "../script.js";
import type { ScriptedModelRequest } from "../wire-request.js";
import { currentPageOf, evidenceOf, latestOf, pageLine, toolCall, callsMade } from "./evidence.js";
import { scriptedJudgement } from "./judgement.js";
import { scriptedTaskProcess } from "./processing-declarations.js";

const TASK = "auction-marketplace-kestrel-auctions";
const READ = "web.output.dom-extract_list";
const NEXT = "web.output.dom-next_page";
type Step = { step: number; actionId: string; callId?: string; disposition?: string; input?: unknown };

const press = (request: ScriptedModelRequest, callId: string, words: RegExp, add = true) => {
  const target = pageLine(currentPageOf(request), words);
  if (!target) throw new Error(`No visible control matches ${String(words)} for ${callId}`);
  return toolCall(`Press ${callId}.`, callId, "core.run_node", { node: "web.output.dom-click", parameters: { target: { handle: target.handle } }, consequences: [] }, add);
};

const stepsOf = (request: ScriptedModelRequest): readonly Step[] => {
  const steps = latestOf(request, "core.flow_draft")?.value.steps;
  return Array.isArray(steps) ? steps as readonly Step[] : [];
};

const decide: ScriptedReply = (request) => {
  const page = currentPageOf(request);
  const made = callsMade(request);
  // The cookie cover is a first-visit detour, not a step of the saved Flow.
  if (!made.has("cookies") && pageLine(page, /(?:clickable|button) "Reject all"/u)) return press(request, "cookies", /(?:clickable|button) "Reject all"/u, false);
  if (!made.has("search")) {
    const box = pageLine(page, /field\S*\s+"Search for anything/u) ?? pageLine(page, /\bfield\b/u);
    if (!box) throw new Error("The page shows no search field");
    return toolCall("Search for the camera.", "search", "core.run_node", { node: "web.output.dom-type", parameters: { target: { handle: box.handle }, text: "kestrel 35", submit: true }, consequences: [] }, true);
  }
  if (!made.has("auction")) return press(request, "auction", /link "Auction" ~\/sch\//u);
  if (!made.has("detect")) {
    const card = pageLine(page, /link "Kestrel [^"]*" same href/u);
    if (!card) throw new Error("The results show no listing card to take the shape of");
    return toolCall("See the shape of the auction cards.", "detect", "web.detect_repeating_structure", { target: card.handle });
  }
  const structure = latestOf(request, "web.detect_repeating_structure");
  if (!structure || typeof structure.value.extraction !== "string") throw new Error(`The detection holds no extraction: ${JSON.stringify(structure?.value ?? null).slice(0, 400)}`);
  if (!made.has("read-first")) {
    return toolCall("Read every column of the auction list.", "read-first", "core.run_node", { node: READ, parameters: { extractList: { handle: structure.value.extraction } }, consequences: [] }, true);
  }
  const steps = stepsOf(request);
  const read = steps.find((step) => step.actionId === READ && step.callId === "read-first");
  const extraction = /extraction\.\d+/u.exec(JSON.stringify(read?.input ?? null))?.[0] ?? structure.value.extraction;
  if (!made.has("next")) return toolCall("Move the list to its next page.", "next", "core.run_node", { node: NEXT, parameters: { nextPage: { list: extraction } }, consequences: [] }, true);
  const next = steps.find((step) => step.actionId === NEXT);
  if (!read || !next) throw new Error("The draft does not hold its read and next-page steps");
  if (!JSON.stringify(steps).includes("repeats through")) return { kind: "evidence_tool_decision", summary: "Read and advance until the list itself ends.", decision: { kind: "amend_draft", amendments: [{ step: read.step, change: "repeat", while: next.step, through: next.step }] } };
  if (!made.has("read-rest")) return toolCall("Read from the current page through the end using that loop.", "read-rest", "core.run_flow", { from: read.step });
  const ran = evidenceOf(request).find((entry) => entry.callId === "read-rest");
  if (ran?.value.ok === false || ran?.value.passed === false) throw new Error(`The paging loop did not finish: ${JSON.stringify(ran.value)}`);
  return { kind: "evidence_tool_decision", summary: "The auctions are held from every page.", decision: { kind: "complete", result: { summary: "Read every auction of the original Kestrel 35 under the ceiling, soonest ending first." } } };
};

const startAttempt: ScriptedReply = (request) => ({ do: "flow.createHere", with: { instruction: request.message }, process: scriptedTaskProcess(TASK) });
const judge: ScriptedReply = (request) => scriptedJudgement(request, { answersRequest: "yes", summary: "The kept rows answer the request; the fixture oracle verifies every record." });

export const AUCTION_MARKETPLACE_KESTREL_AUCTIONS_SCRIPT: ScriptedModelScript = Object.freeze({
  taskId: TASK,
  replies: {
    panel_command: Array.from({ length: 4 }, () => startAttempt),
    evidence_tool_decision: Array.from({ length: 40 }, () => decide),
    loop_verification: Array.from({ length: 8 }, () => judge),
  },
});
