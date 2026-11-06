// `crossborder-marketplace-free-hubs-under-ten`: a filtered, sorted read, and the one task whose honest path meets
// a check only a person may pass. The model clears what covers the first page, searches for the hubs, narrows
// the results to free shipping and a ceiling of 10 euros with the site's own filters, sorts them cheapest
// first, and reads the ten rows that are not ads: title, store, price, rating.
//
// **The traffic screen is never the model's.** The site puts "I'm not a robot" in place of the search's third
// load, which is the price ceiling. FluxIQ hands that to a person (the Lab plays them) and the call stands as it
// was made, so this script never presses or reads a check and meets it nowhere. A second attempt runs the saved
// Flow and meets the same screen on its first search, which the person clears again.
//
// Every handle, field key and filter label is read from the request's own evidence, never written here.
import type { ScriptedModelScript, ScriptedReply } from "../script.js";
import { currentPageOf, evidenceOf, latestOf, pageLine, pressOf, toolCall, type EvidenceEntry } from "./evidence.js";
import type { ScriptedModelRequest } from "../wire-request.js";

const READ_NODE = "web.output.dom-extract_list";

/** What a buyer asked for: hubs at this price or less, in the euros the page writes them in. */
const CEILING = 10;

type Field = { key: string; sample?: string; label?: string; kind?: string; type?: string; coverage?: number };

const startAttempt: ScriptedReply = (request) => ({ do: "flow.createHere", with: { instruction: request.message } });
const finish = (summary: string): Record<string, unknown> => ({ kind: "evidence_tool_decision", summary, decision: { kind: "complete", result: { summary } } });
const callsMade = (request: ScriptedModelRequest): ReadonlySet<string> => new Set(evidenceOf(request).map((entry) => entry.callId));

/** What stands over the page on a first visit, in the order a person clears it, each only while it shows. */
const COVERS: readonly { summary: string; callId: string; words: RegExp }[] = [
  { summary: "Close the welcome offer that sits over the page.", callId: "dismiss-welcome", words: /"No thanks"/u },
  { summary: "Accept cookies so the page can be used.", callId: "accept-cookies", words: /"Accept all"/u },
  { summary: "Decline the notification prompt that covers the filters.", callId: "decline-notifications", words: /"Not now"/u },
];

const fieldsOf = (structure: EvidenceEntry): readonly Field[] => (Array.isArray(structure.value.fields) ? structure.value.fields as readonly Field[] : []);

function fieldWhere(fields: readonly Field[], holds: (field: Field) => boolean, what: string): string {
  const field = fields.find(holds);
  if (!field) throw new Error(`The read's fields hold no ${what}: ${fields.map((candidate) => `${candidate.key}=${candidate.sample ?? candidate.label ?? ""}`).join("; ")}`);
  return field.key;
}

/** What a person reads off a card: the title is its longest line, the store the line beside the shop mark, the price the currency, the rating the figure out of five, and the ad mark what tells a paid placement. */
function cardColumns(fields: readonly Field[]) {
  const whole = fields.filter((field) => field.coverage === 1 && field.kind !== "link" && field.kind !== "image");
  const lines = whole.filter((field) => field.type === "text").sort((left, right) => (right.sample ?? "").length - (left.sample ?? "").length);
  return {
    title: fieldWhere(lines, () => true, "title"),
    store: fieldWhere(whole, (field) => /\b(Store|Shop|Official|Hub|Tech|Mart|Direct)\b/u.test(field.sample ?? "") && field.key !== lines[0]?.key, "store"),
    price: fieldWhere(whole, (field) => field.type === "currency", "price"),
    rating: fieldWhere(fields, (field) => /^\d\.\d$/u.test(field.sample ?? ""), "rating"),
    ad: fieldWhere(fields, (field) => /^(Ad|Sponsored)$/u.test(field.sample ?? ""), "ad mark"),
  };
}

const decide: ScriptedReply = (request) => {
  const page = currentPageOf(request);
  const made = callsMade(request);
  if (made.has("read-hubs")) return finish("The free hubs at ten euros or less are read, cheapest first.");
  for (const cover of COVERS) {
    if (!made.has(cover.callId) && pageLine(page, cover.words)) return pressOf(request, cover.summary, cover.callId, cover.words);
  }
  if (!/^URL ~\/search/mu.test(page)) {
    const box = pageLine(page, /\bfield\b.*(?:q|search|Mega Sale)/iu) ?? pageLine(page, /input|field/u);
    if (!box) throw new Error("The page shows no search box");
    return toolCall("Search for the hubs.", "search", "core.run_node", { node: "web.output.dom-type", parameters: { target: { handle: box.handle }, text: "usb c hub", submit: true }, consequences: [] }, true);
  }
  // Each step once, by the calls made: after a check a person cleared, the page a decision reads may still be the one before the press, and a press made twice is a step the Flow cannot place.
  if (!made.has("free-shipping")) return pressOf(request, "Narrow to hubs that ship free.", "free-shipping", /clickable "Free shipping"$/u);
  if (!made.has("ceiling-typed")) {
    const max = pageLine(page, /field.*"Max"/u);
    if (!max) throw new Error("The page shows no Max price box");
    return toolCall("Type the price ceiling.", "ceiling-typed", "core.run_node", { node: "web.output.dom-type", parameters: { target: { handle: max.handle }, text: String(CEILING) }, consequences: [] }, true);
  }
  if (!made.has("ceiling-applied")) return pressOf(request, "Apply the price ceiling.", "ceiling-applied", /clickable "OK"$/u);
  if (!made.has("sort-by-price")) return pressOf(request, "Sort the hubs cheapest first.", "sort-by-price", /clickable "Price ↑"$/u);
  const structure = latestOf(request, "web.detect_repeating_structure");
  if (!structure) {
    const card = pageLine(page, /^t\d+ link ".*\bHub\b.*" same href/u);
    if (!card) throw new Error("The results show no hub card to take the shape of");
    return toolCall("See the shape of the hub cards.", "detect-hubs", "web.detect_repeating_structure", { target: card.handle });
  }
  const columns = cardColumns(fieldsOf(structure));
  return toolCall("Read the hubs, leaving out the ads.", "read-hubs", "core.run_node", {
    node: READ_NODE,
    parameters: {
      extractList: { handle: structure.value.extraction, fields: { title: columns.title, store: columns.store, price: columns.price, rating: columns.rating }, where: [{ field: columns.ad, is: "present", not: true }], minItems: 1 },
      recordOutput: {
        datasetId: "free-hubs-under-ten",
        schema: { schemaVersion: "0.1", fields: ["title", "store", "price", "rating"].map((id) => ({ id, label: id, valueType: "string" })) },
        writeMode: "append",
      },
    },
    consequences: [],
  }, true);
};

/** The judge: yes, on what the person asked for, which Core shows it from its own records. */
const answersRequest: ScriptedReply = () => ({ kind: "diagnosis", diagnosis: { answersRequest: "yes", defects: [] }, summary: "The rows are the free hubs at ten euros or less the person asked for." });

/** The most decisions this script answers: every step of its honest path, and few enough that a loop fails it. */
const MOST_DECISIONS = 30;

export const CROSSBORDER_MARKETPLACE_FREE_HUBS_UNDER_TEN_SCRIPT: ScriptedModelScript = Object.freeze({
  taskId: "crossborder-marketplace-free-hubs-under-ten",
  replies: {
    panel_command: [startAttempt, startAttempt],
    evidence_tool_decision: Array.from({ length: MOST_DECISIONS }, () => decide),
    loop_verification: [answersRequest, answersRequest, answersRequest],
  },
});
