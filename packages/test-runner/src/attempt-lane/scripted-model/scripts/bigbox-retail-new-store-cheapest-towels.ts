// Provider-free honest path for the realistic new-store task: make the nearby Neighborhood Market the store, narrow and sort
// a search, add the cheapest eligible roll, and read the cart. Test data: every control is found on the delivered page by its
// words, never by a handle that changes between runs.
import type { ScriptedModelScript, ScriptedReply } from "../script.js";
import { currentPageOf, evidenceOf, latestOf, pageLine, toolCall, callsMade } from "./evidence.js";
import { evidenceReadingJudgement, scriptedJudgement, type ShownCondition } from "./judgement.js";
import { scriptedTaskProcess } from "./processing-declarations.js";

const TASK = "bigbox-retail-new-store-cheapest-towels";
const STORE = "Millbrook Crossing Neighborhood Market";

const click = (summary: string, callId: string, handle: string, consequences: readonly string[] = []) =>
  toolCall(summary, callId, "core.run_node", { node: "web.output.dom-click", parameters: { target: { handle } }, consequences }, true);

function need(page: string, words: RegExp, what: string): string {
  const found = pageLine(page, words);
  if (!found) throw new Error(`The page shows no ${what} matching ${String(words)}`);
  return found.handle;
}

/** The first line matching `control` after the line matching `anchor`: a button inside the card the anchor names. */
function controlAfter(page: string, anchor: RegExp, control: RegExp, what: string): string {
  const lines = page.split("\n");
  const at = lines.findIndex((line) => anchor.test(line));
  if (at < 0) throw new Error(`The page shows no ${what} anchor ${String(anchor)}`);
  for (const line of lines.slice(at + 1)) {
    const handle = control.test(line) ? /^(t\d+)\b/u.exec(line)?.[1] : undefined;
    if (handle) return handle;
  }
  throw new Error(`The page shows no control for ${what}`);
}

type Field = { key: string; name?: string; sample?: string };
type DraftStep = { step: number; does?: { target?: string }; disposition?: string };
type Act = { id: string; todo?: string; choices?: readonly { id: string; todo?: string }[] };

const decideFor = (panel: boolean): ScriptedReply => (request) => {
  const page = currentPageOf(request);
  // Progress is read from the page as well as from this attempt's own calls: a repair of a replayed Flow starts from the page the replay left.
  const made = new Set(callsMade(request));
  const onCart = /^URL .*\/cart\)/mu.test(page);
  const sorted = /^URL .*sort=price_low/mu.test(page);
  const added = /link "[^"]*\b(?:[2-9]|\d\d+) \$\d/u.test(page);
  const onProduct = /^URL .*\/ip\//mu.test(page);
  if (onCart || sorted) for (const id of ["cookies", "picker", "store", "search", "department", "today", "sort"]) made.add(id);
  if (onCart || (sorted && added)) made.add("add");
  if (onCart) made.add("cart");
  const evidence = evidenceOf(request);
  if (!made.has("cookies")) {
    const reject = pageLine(page, /button "Reject all"/u);
    if (reject) return click("Decline optional cookies.", "cookies", reject.handle);
  }
  if (!made.has("picker")) return click("Open the store picker.", "picker", need(page, /button "Pickup or delivery\?/u, "store picker"));
  if (!made.has("store")) return click(`Set ${STORE} as my store.`, "store", controlAfter(page, new RegExp(`"${STORE}"`, "u"), /button "Set as my store"/u, "store choice"), ["modify_existing"]);
  if (!made.has("search")) {
    const box = need(page, /(?:field|input|searchbox)\S*\s+"Search/iu, "search field");
    return toolCall("Search for paper towels.", "search", "core.run_node", { node: "web.output.dom-type", parameters: { target: { handle: box }, text: "paper towels", submit: true }, consequences: [] }, true);
  }
  const check = (summary: string, callId: string, words: RegExp) =>
    toolCall(summary, callId, "core.run_node", { node: "web.output.dom-check", parameters: { target: { handle: need(page, words, callId) }, checked: true }, consequences: [] }, true);
  if (!made.has("department")) return check("Narrow to the Paper Towels department.", "department", /checkbox "Paper Towels(?: \(\d+\))?" .*group="Department"/u);
  if (!made.has("today")) return check("Keep what can be ready today.", "today", /checkbox "Today(?: \(\d+\))?" .*group="Speed"/u);
  if (!made.has("sort")) {
    return toolCall("Sort by lowest price.", "sort", "core.run_node", { node: "web.output.dom-select", parameters: { target: { handle: need(page, /select "Sort by"/u, "sort control") }, value: "price_low" }, consequences: [] }, true);
  }
  if (panel) {
    // The product page's own path: open the first listing, press its Add to cart, then the panel's "View cart" that follows "Added to cart".
    if (!made.has("open") && !onProduct) return click("Open the first listing.", "open", need(page, /link ".*" \S*\/ip\//u, "first listing"));
    made.add("open");
    // The buy box may need a second press before the item is added (it wakes on the first).
    const addedPanel = /Added to cart/u.test(page);
    if (!made.has("add") && !addedPanel) return click("Add the item to the cart.", "add", need(page, /button "Add to cart"/u, "Add to cart button"), ["modify_existing"]);
    if (!made.has("add2") && !addedPanel && made.has("add") && !made.has("cart")) return click("Add the item to the cart again, as the first press only woke the box.", "add2", need(page, /button "Add to cart"/u, "Add to cart button"), ["modify_existing"]);
    if (!made.has("cart")) return click("Open the cart from the panel.", "cart", controlAfter(page, /Added to cart/u, /link "View cart"/u, "View cart"));
  }
  if (!made.has("add")) return click("Add the cheapest qualifying item.", "add", need(page, /button "\+ Add"/u, "+ Add button"), ["modify_existing"]);
  if (!made.has("cart")) return click("Open the cart.", "cart", need(page, /link "[^"]*\d+ \$\d[^"]*"/u, "cart link"));
  if (!made.has("detect")) return toolCall("See the shape of the cart's lines.", "detect", "web.detect_repeating_structure", { target: need(page, /link ".*" \S*\/ip\//u, "cart line") });
  const structure = latestOf(request, "web.detect_repeating_structure");
  if (!structure) throw new Error("The structure detection left no evidence");
  if (!made.has("read-cart")) {
    const fields = (Array.isArray(structure.value.fields) ? structure.value.fields : []) as readonly Field[];
    const pick = (test: (field: Field) => boolean, what: string): string => {
      const found = fields.find(test);
      if (!found) throw new Error(`The cart's fields hold no ${what}: ${JSON.stringify(fields).slice(0, 600)}`);
      return found.key;
    };
    return toolCall("Read the cart's lines.", "read-cart", "core.run_node", {
      node: "web.output.dom-extract_list",
      parameters: { extractList: { handle: structure.value.extraction, fields: { item: pick((f) => f.name === "link", "item"), quantity: pick((f) => /select_control$/u.test(f.key), "quantity"), price: pick((f) => f.name === "price", "price") } } },
      consequences: [],
    });
  }
  // The add step is the act the instruction names; Core asks for it to be marked, so mark it from the draft itself.
  const draft = latestOf(request, "core.flow_draft")?.value;
  const acts = (Array.isArray(draft?.acts) ? draft.acts : []) as readonly Act[];
  const open = acts.flatMap((act) => (act.choices?.length ? act.choices.filter((choice) => choice.todo !== undefined).map((choice) => choice.id) : act.todo !== undefined ? [act.id] : []));
  const steps = (Array.isArray(draft?.steps) ? draft.steps : []) as readonly DraftStep[];
  const adding = steps.find((step) => step.does?.target === (panel ? "Add to cart" : "+ Add") && step.disposition === "kept");
  const marked = evidence.some((entry) => entry.callId.startsWith("core.amendment_check"));
  if (open.length > 0 && adding && !marked) {
    return { kind: "evidence_tool_decision", summary: "Mark the add step as the act of adding the item.", decision: { kind: "amend_draft", amendments: [{ step: adding.step, change: "keep", act: open[0] }] } };
  }
  return { kind: "evidence_tool_decision", summary: "The cart was read.", decision: { kind: "complete", result: { summary: `Set ${STORE} as the store, added the cheapest qualifying item for pickup and read the cart.` } } };
};

const decide = decideFor(false);

const startAttempt: ScriptedReply = (request) => ({ do: "flow.createHere", with: { instruction: request.message }, acts: ["modify_existing", "create_new"], process: scriptedTaskProcess(TASK) });
const judge: ScriptedReply = (request) => scriptedJudgement(request, { answersRequest: "yes", summary: "The cart read answers the request; the fixture oracle verifies every record." });

/** What the task names on the chosen item, in the words the product page shows it in. The instruction itself says "4.5", so the rating is matched beside its review count. */
export const BIGBOX_CHOSEN_ITEM_CONDITIONS: readonly ShownCondition[] = Object.freeze([
  { what: "rating line of at least 4.5", words: /\b(?:4\.[5-9]|5\.0)\b[^"]{0,30}reviews?/u },
  { what: "pickup-today line", words: /Pickup today/u },
]);
const judgeEvidence: ScriptedReply = (request) =>
  evidenceReadingJudgement(request, { answersRequest: "yes", summary: "The chosen item shows its rating and pickup today, and the cart read answers the request." }, BIGBOX_CHOSEN_ITEM_CONDITIONS);

export const BIGBOX_RETAIL_NEW_STORE_CHEAPEST_TOWELS_SCRIPT: ScriptedModelScript = Object.freeze({
  taskId: TASK,
  replies: {
    panel_command: Array.from({ length: 4 }, () => startAttempt),
    evidence_tool_decision: Array.from({ length: 40 }, () => decide),
    loop_verification: Array.from({ length: 8 }, () => judge),
  },
});

/** The script's form: `plain` (the default) adds from the results card; `panel` adds on the product page and opens the cart from its "Added to cart" panel, judged on evidence. */
export function bigboxRetailNewStoreCheapestTowelsScript(form: string = "plain"): ScriptedModelScript {
  if (form === "plain") return BIGBOX_RETAIL_NEW_STORE_CHEAPEST_TOWELS_SCRIPT;
  if (form !== "panel") throw new Error(`This script has no form "${form}". It has plain and panel`);
  return Object.freeze({
    taskId: TASK,
    replies: {
      panel_command: Array.from({ length: 4 }, () => startAttempt),
      evidence_tool_decision: Array.from({ length: 60 }, () => decideFor(true)),
      loop_verification: Array.from({ length: 8 }, () => judgeEvidence),
    },
  });
}
