import type { ScriptedModelRequest } from "../wire-request.js";
import type { ScriptedModelScript, ScriptedReply } from "../script.js";
import { currentPageOf, evidenceOf, pageLine, pressOf, toolCall } from "./evidence.js";
import { scriptedJudgement } from "./judgement.js";

/**
 * A script that means to fail: it does what the task asks and lands the descaler's add a second time by another route,
 * the cart line's own Increase. It exists to show `lab attempt` says wrong with a repeated act. Every per-row task the
 * Lab has keeps its acts as a set or a toggle, so a second press there cannot move a count; a cart line is what counts.
 *
 * The presses declare nothing, which is the record's disclosed limit (plan D6): a press that declared nothing cannot
 * be told from one that only opens a page, so it is never refused, and the double-act oracle is what catches it.
 */
const startAttempt: ScriptedReply = (request) => ({ do: "flow.createHere", with: { instruction: request.message } });

const DESCALER = "Tidewell Kettle Descaler";
const BATTERIES = "Brightaisle Basics AA";

const callsMade = (request: ScriptedModelRequest): ReadonlySet<string> => new Set(evidenceOf(request).map((entry) => entry.callId));

/** The first line matching `control` after the line naming `item` as `prefix`, by the page's own lines. */
function controlAfter(page: string, prefix: RegExp, control: RegExp, what: string): string {
  const lines = page.split("\n");
  const at = lines.findIndex((line) => prefix.test(line));
  if (at < 0) throw new Error(`The cart shows no ${what}. Page:\n${page}`);
  for (const line of lines.slice(at + 1)) {
    const found = control.test(line) ? /^(t\d+)\b/u.exec(line) : null;
    if (found) return found[1]!;
  }
  throw new Error(`The cart shows no control for ${what}. Page:\n${page}`);
}

const INCREASE = /clickable "Increase quantity by one"/u;
const inCart = (item: string) => new RegExp(`checkbox "Select ${item}`, "u");

const press = (summary: string, callId: string, handle: string): Record<string, unknown> => toolCall(summary, callId, "core.run_node", { node: "web.output.dom-click", parameters: { target: { handle } }, consequences: [] }, true);

type Field = { key: string; sample?: string };

const decide: ScriptedReply = (request) => {
  const page = currentPageOf(request);
  if (pageLine(page, /button "Not now"/u)) return pressOf(request, "Put off the notifications prompt.", `not-now-${request.ordinal}`, /button "Not now"/u);
  if (pageLine(page, /button "Accept"$/u)) return pressOf(request, "Accept cookies so the page can be used.", `consent-${request.ordinal}`, /button "Accept"$/u);
  if (!/^URL ~\/cart/mu.test(page)) return pressOf(request, "Open the cart.", `open-cart-${request.ordinal}`, /link "\d+ items? in cart"/u);
  const made = callsMade(request);
  for (const callId of ["raise-batteries-1", "raise-batteries-2"]) {
    if (!made.has(callId)) return press("Raise the batteries by one.", callId, controlAfter(page, inCart(BATTERIES), INCREASE, "battery line"));
  }
  if (!made.has("add-descaler")) return press("Add the descaler.", "add-descaler", controlAfter(page, new RegExp(`link "${DESCALER}`, "u"), /"Add to cart"/iu, "descaler offer"));
  if (!made.has("increase-descaler")) return press("Add the descaler again, through its line in the cart.", "increase-descaler", controlAfter(page, inCart(DESCALER), INCREASE, "descaler line"));
  const structure = evidenceOf(request).find((entry) => entry.toolId === "web.detect_repeating_structure");
  if (!structure) {
    const line = pageLine(page, new RegExp(`link "${DESCALER}`, "u"));
    if (!line) throw new Error(`The cart does not show the descaler's line. Page:\n${page}`);
    return toolCall("See the shape of the cart's lines.", "detect", "web.detect_repeating_structure", { target: line.handle });
  }
  if (made.has("read-cart")) return { kind: "evidence_tool_decision", summary: "Done.", decision: { kind: "complete", result: { summary: "Raised the batteries, added the descaler, and listed the cart." } } };
  const fields = (Array.isArray(structure.value.fields) ? structure.value.fields : []) as readonly Field[];
  const keyOf = (holds: RegExp, what: string): string => {
    const found = fields.find((field) => holds.test(field.sample ?? ""));
    if (!found) throw new Error(`The cart's fields hold no ${what}: ${JSON.stringify(fields)}`);
    return found.key;
  };
  return toolCall("Read what is in the cart.", "read-cart", "core.run_node", {
    node: "web.output.dom-extract_list",
    parameters: { extractList: { handle: structure.value.extraction, fields: { item: keyOf(/Tidewell|Brightaisle Basics|Ridgeline/u, "item"), quantity: keyOf(/^\d+$/u, "quantity"), price: keyOf(/^\$/u, "price") }, minItems: 1 } },
    consequences: [],
  });
};

const answersRequest: ScriptedReply = (request) => scriptedJudgement(request, { answersRequest: "yes", summary: "It says it is done, and this script's judge believes it, so only the Lab's own oracle can object." });

export const EVERYTHING_STORE_DOUBLE_ADD_SCRIPT: ScriptedModelScript = Object.freeze({
  taskId: "everything-store-batteries-and-descaler",
  replies: {
    panel_command: [startAttempt],
    evidence_tool_decision: Array.from({ length: 24 }, () => decide),
    loop_verification: [answersRequest],
  },
});
