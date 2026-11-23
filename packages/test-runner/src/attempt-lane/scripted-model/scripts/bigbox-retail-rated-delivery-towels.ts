import { scriptedTaskProcess } from "./processing-declarations.js";
// Provider-free honest path for the unchanged realistic towels task. All row values come from browser reads.
import type { ScriptedModelScript, ScriptedReply } from "../script.js";
import type { ScriptedModelRequest } from "../wire-request.js";
import { currentPageOf, evidenceOf, latestOf, pageLine, toolCall } from "./evidence.js";
import { scriptedJudgement } from "./judgement.js";

const READ = "web.output.dom-extract_list";
const NEXT = "web.output.dom-next_page";
type Field = { key: string; sample?: string; type?: string; kind?: string };
type Step = { step: number; actionId: string };

function field(fields: readonly Field[], test: (candidate: Field) => boolean, name: string): string {
  const found = fields.find(test);
  if (!found) throw new Error(`The product detection has no ${name} field`);
  return found.key;
}

function press(request: ScriptedModelRequest, callId: string, words: RegExp, add = true) {
  const target = pageLine(currentPageOf(request), words);
  if (!target) throw new Error(`No visible control matches ${String(words)}`);
  return toolCall(`Press ${callId}.`, callId, "core.run_node", { node: "web.output.dom-click", parameters: { target: { handle: target.handle } }, consequences: [] }, add);
}

function stepsOf(request: ScriptedModelRequest): readonly Step[] {
  const steps = latestOf(request, "core.flow_draft")?.value.steps;
  return Array.isArray(steps) ? steps as readonly Step[] : [];
}

const decide: ScriptedReply = (request) => {
  const page = currentPageOf(request);
  const evidence = evidenceOf(request);
  const made = new Set(evidence.map((entry) => entry.callId));
  // Transient first-visit detours are not fixed steps in the saved Flow.
  for (const [callId, words] of [["consent", /"Accept all"/u], ["offer", /(?:link|clickable|button) "No thanks"/u], ["not-now", /(?:clickable|button) "Not now"/u]] as const) {
    if (!made.has(callId) && pageLine(page, words)) return press(request, callId, words, false);
  }
  if (!made.has("search")) {
    const box = pageLine(page, /(?:field|input|searchbox).*search/iu) ?? pageLine(page, /(?:field|input|searchbox)/u);
    if (!box) throw new Error("The page shows no search field");
    return toolCall("Search for paper towels.", "search", "core.run_node", { node: "web.output.dom-type", parameters: { target: { handle: box.handle }, text: "paper towels", submit: true }, consequences: [] }, true);
  }
  if (!made.has("department")) return press(request, "department", /(?:checkbox|clickable|field).*"Paper Towels"(?:\s|$)/u);
  if (!made.has("delivery")) return press(request, "delivery", /(?:checkbox|clickable|field).*"Delivery"(?:\s|$)/u);
  if (!made.has("sort")) {
    const sort = pageLine(page, /(?:select|combobox).*Sort/iu) ?? pageLine(page, /\b(?:select|combobox)\b/u);
    if (!sort) throw new Error("The page shows no sort control");
    return toolCall("Choose the store's Highest rating order.", "sort", "core.run_node", { node: "web.output.dom-select", parameters: { target: { handle: sort.handle }, value: "rating_high" }, consequences: [] }, true);
  }
  const detected = latestOf(request, "web.detect_repeating_structure");
  if (!detected) {
    const card = pageLine(page, /link ".*Paper Towels/iu);
    if (!card) throw new Error("The results show no paper-towel card");
    return toolCall("Read the shape of the product cards.", "detect", "web.detect_repeating_structure", { target: card.handle });
  }
  if (!Array.isArray(detected.value.fields)) throw new Error(`The product detection failed: ${JSON.stringify(detected.value)}`);
  if (!made.has("read-first")) {
    const fields = detected.value.fields as readonly Field[];
    const name = field(fields, (candidate) => candidate.kind !== "link" && /paper towels/iu.test(candidate.sample ?? ""), "name");
    const price = field(fields, (candidate) => candidate.type === "currency", "price");
    const rating = field(fields, (candidate) => /^\d\.\d$/u.test(candidate.sample ?? ""), "rating");
    const ad = field(fields, (candidate) => /^(?:Sponsored|Ad)$/u.test(candidate.sample ?? ""), "advertisement mark");
    return toolCall("Read eligible packs on this page, excluding advertisements and accessories.", "read-first", "core.run_node", {
      node: READ,
      parameters: {
        extractList: { handle: detected.value.extraction, fields: { name, price, rating }, where: [{ field: ad, is: "present", not: true }, { field: rating, atLeast: 4.5 }, { field: name, contains: ["holder", "dispenser"], not: true }], minItems: 0 },
        recordOutput: { datasetId: "rated-delivery-towels", schema: { schemaVersion: "0.1", fields: ["name", "price", "rating"].map((id) => ({ id, label: id, valueType: "string" })) }, writeMode: "append" }
      }, consequences: []
    }, true);
  }
  if (!made.has("next")) return toolCall("Move this product list to its next page.", "next", "core.run_node", { node: NEXT, parameters: { nextPage: { list: detected.value.extraction } }, consequences: [] }, true);
  const steps = stepsOf(request);
  const read = steps.find((step) => step.actionId === READ);
  const next = steps.find((step) => step.actionId === NEXT);
  if (!read || !next) throw new Error("The draft does not hold its read and next-page steps");
  if (!JSON.stringify(steps).includes("repeats through")) return { kind: "evidence_tool_decision", summary: "Read and advance until the list itself ends.", decision: { kind: "amend_draft", amendments: [{ step: read.step, change: "repeat", while: next.step, through: next.step }] } };
  if (!made.has("read-rest")) return toolCall("Read from the current page through the end using that loop.", "read-rest", "core.run_flow", { from: read.step });
  const ran = evidence.find((entry) => entry.callId === "read-rest");
  if (ran?.value.ok === false || ran?.value.passed === false) throw new Error(`The paging loop did not finish: ${JSON.stringify(ran.value)}`);
  return { kind: "evidence_tool_decision", summary: "The requested rows are held from every page.", decision: { kind: "complete", result: { summary: "Read every qualifying pack in the store's Highest rating order." } } };
};

const startAttempt: ScriptedReply = (request) => ({ do: "flow.createHere", with: { instruction: request.message }, process: scriptedTaskProcess("bigbox-retail-rated-delivery-towels") });
const judge: ScriptedReply = (request) => scriptedJudgement(request, { answersRequest: "yes", summary: "The kept rows answer the request; the unchanged fixture oracle verifies every record." });

export const BIGBOX_RETAIL_RATED_DELIVERY_TOWELS_SCRIPT: ScriptedModelScript = Object.freeze({
  taskId: "bigbox-retail-rated-delivery-towels",
  replies: {
    panel_command: Array.from({ length: 4 }, () => startAttempt),
    evidence_tool_decision: Array.from({ length: 32 }, () => decide),
    loop_verification: Array.from({ length: 8 }, () => judge)
  }
});
