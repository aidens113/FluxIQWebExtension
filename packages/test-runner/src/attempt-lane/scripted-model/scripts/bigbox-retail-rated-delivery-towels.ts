import { scriptedTaskProcess } from "./processing-declarations.js";
// Provider-free honest path for the unchanged realistic towels task. All row values come from browser reads.
import type { ScriptedModelScript, ScriptedReply } from "../script.js";
import type { ScriptedModelRequest } from "../wire-request.js";
import { currentPageOf, evidenceOf, latestOf, pageLine, toolCall } from "./evidence.js";
import { scriptedJudgement } from "./judgement.js";

const READ = "web.output.dom-extract_list";
const NEXT = "web.output.dom-next_page";
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
type Step = { step: number; actionId: string; callId?: string; disposition?: string; input?: unknown };
/** The first-visit detours: the framework drafts every act that landed, so these come out of the Flow by an edit. */
const DETOURS: ReadonlySet<string> = new Set(["consent", "offer", "not-now"]);

type Row = Readonly<Record<string, unknown>>;

/** The rows a list read answered, wherever its answer holds them: the first list of records with several columns. */
function columnsOf(value: unknown): readonly Row[] {
  const seen = (node: unknown): readonly Row[] | undefined => {
    if (Array.isArray(node)) {
      if (node.length > 0 && node.every((row) => isRecord(row) && Object.keys(row).length > 1)) return node as readonly Row[];
      for (const child of node) {
        const found = seen(child);
        if (found) return found;
      }
    } else if (isRecord(node)) {
      for (const child of [node.extracted, ...Object.values(node)]) {
        const found = seen(child);
        if (found) return found;
      }
    }
    return undefined;
  };
  const rows = seen(value);
  if (!rows) throw new Error(`The product read answered no rows: ${JSON.stringify(value).slice(0, 400)}`);
  return rows;
}

function column(rows: readonly Row[], test: (sample: string) => boolean, name: string): string {
  for (const row of rows) for (const [key, value] of Object.entries(row)) if (typeof value === "string" && test(value)) return key;
  throw new Error(`The product read has no ${name} column`);
}

/** The `extraction.N` the draft's step for the read holds as its list: the one the read issued by detecting it. */
function extractionOf(steps: readonly Step[]): string {
  const read = steps.find((step) => step.callId === "read-first");
  const found = /extraction\.\d+/u.exec(JSON.stringify(read?.input ?? null))?.[0];
  if (!found) throw new Error(`The draft's read step names no extraction: ${JSON.stringify(read ?? null).slice(0, 400)}`);
  return found;
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
  if (!made.has("department")) return press(request, "department", /(?:checkbox|clickable|field).*"Paper Towels(?: \(\d+\))?"(?:\s|$)/u);
  if (!made.has("delivery")) return press(request, "delivery", /(?:checkbox|clickable|field).*"Delivery(?: \(\d+\))?"(?:\s|$)/u);
  if (!made.has("sort")) {
    const sort = pageLine(page, /(?:select|combobox).*Sort/iu) ?? pageLine(page, /\b(?:select|combobox)\b/u);
    if (!sort) throw new Error("The page shows no sort control");
    return toolCall("Choose the store's Highest rating order.", "sort", "core.run_node", { node: "web.output.dom-select", parameters: { target: { handle: sort.handle }, value: "rating_high" }, consequences: [] }, true);
  }
  const card = pageLine(page, /link ".*Paper Towels.*\/ip\//iu) ?? pageLine(page, /link ".*Paper Towels/iu);
  if (!card) throw new Error("The results show no paper-towel card");
  // One call reads the list the card sits in and keeps every column; this reading only learns the columns' names and records nothing.
  if (!made.has("columns")) {
    return toolCall("Read every column of the product list once.", "columns", "core.run_node", {
      node: READ,
      parameters: { extractList: { handle: card.handle, minItems: 0 } },
      consequences: []
    });
  }
  const columns = columnsOf(evidence.find((entry) => entry.callId === "columns")?.value);
  if (!made.has("read-first")) {
    const name = column(columns, (sample) => /paper towels/iu.test(sample) && !/^(?:https?:|\/)/u.test(sample), "name");
    const price = column(columns, (sample) => /^\$\d/u.test(sample), "price");
    const rating = column(columns, (sample) => /^\d\.\d$/u.test(sample), "rating");
    const ad = column(columns, (sample) => /^(?:Sponsored|Ad)$/u.test(sample), "advertisement mark");
    const fulfillment = column(columns, (sample) => /Delivery .*·|· .*Delivery/u.test(sample), "fulfillment");
    return toolCall("Read eligible packs on this page, excluding advertisements and accessories.", "read-first", "core.run_node", {
      node: READ,
      parameters: {
        extractList: { handle: card.handle, fields: { name, price, rating, ad, fulfillment }, where: [{ field: ad, is: "present", not: true }, { field: rating, atLeast: 4.5 }, { field: name, contains: ["holder", "dispenser"], not: true }], minItems: 0 },
        recordOutput: { datasetId: "rated-delivery-towels", schema: { schemaVersion: "0.1", fields: ["name", "price", "rating"].map((id) => ({ id, label: id, valueType: "string" })) }, writeMode: "append" }
      }, consequences: []
    }, true);
  }
  const extraction = extractionOf(stepsOf(request));
  if (!made.has("next")) return toolCall("Move this product list to its next page.", "next", "core.run_node", { node: NEXT, parameters: { nextPage: { list: extraction } }, consequences: [] }, true);
  const steps = stepsOf(request);
  const read = steps.find((step) => step.actionId === READ && step.callId === "read-first");
  const next = steps.find((step) => step.actionId === NEXT);
  if (!read || !next) throw new Error("The draft does not hold its read and next-page steps");
  const detours = steps.filter((step) => step.callId !== undefined && DETOURS.has(step.callId) && step.disposition === "kept");
  if (detours.length) return { kind: "evidence_tool_decision", summary: "Take the first-visit detours out of the Flow.", decision: { kind: "amend_draft", amendments: detours.map((step) => ({ step: step.step, change: "drop" })) } };
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
