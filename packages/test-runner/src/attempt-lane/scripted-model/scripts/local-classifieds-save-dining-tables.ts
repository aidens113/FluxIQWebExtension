// `local-classifieds-save-dining-tables`: a lasting act per row on a site where a second press undoes
// the first (Save toggles). The model searches, narrows to five miles and sorts, reads the three
// cheapest real tables, opens the first by its own address and saves it by hand, then repeats the
// opening and the save over the read, the address bound to each row's own, and runs forward on the
// rest. A row pressed twice would end up unsaved, so a repeat shows in the site's own state.
//
// `plain`: the Flow's read is the read the model explored with.
// `reshape`: the Flow's own read is written after the hand save, under other column names and
// without the price, so the row a pass carries really differs from the row the save was noted on.
// `row-link`: the design a person writes first. The first table is opened by pressing its card's own
// link, saved, and come back from, all three kept as steps; then those three repeat over the read. The
// card's link is the whole card, wrapped in a plain box of its own, and each pass must press its own
// row's: the Flow names no address, and a toggle site shows a second press of one table as an unsave.
// `open-save-back`: what paid run `run-mw37vz9n-a77a02c2` did. The first table is opened by its card and saved by hand, the
// list is come back to, and only then read, first with a `dedupe` a Flow refuses on a working list and then without it. The
// Flow's save is written while the first table's page shows it on: `set Saved to checked` on that control, so a repeat never
// presses it off. Its loop opens a row, sets that, and goes back, on the read's first three rows. Then the model looks at its
// saved items, and asks for the loop by its first step from there, with the list before the range.
// `by-hand`: what paid run `run-mw3itjcy-ce4429f7` did, and no other form does. It reads the list, then opens each of the three
// tables and presses its Save by hand, with no forward pass at all. Every other form presses only the first by hand, so a repair
// of the act's words proved on them passed two of its three lines on a row a forward pass carried.
// `by-hand-unread`: what paid run `run-mw3if5xt-a2bc72ae` did. The same presses with no read of the list before them, so no row
// is known when each lands and only its page says which table it was.
//
// **Two attempts.** A second attempt reaches the model only where the saved Flow's run did not end it, so these forms leave a Flow
// and their replies read what the request says happened. Both end with the read of the saved items in the Flow, and attempt 1 is
// what any form does: three saves and the table.
// `again-check`: the Flow's save is `set Saved to checked` (open-save-back's), so a second run finds each table saved and presses
// nothing, and it goes to the sorted list by its address, the search, radius and sort held in it: a Flow that keeps the hand journey
// stops on a second run, at the prompt the site remembers or at the second Apply, which the run gate holds back as already done
// (`docs/working/answer-first-plan/reports/attempt-road/two-attempts.md`). Attempt 2 sends no decision at all, and anything that
// reaches one is refused. The judge reads the real rows, and says no to a table without the three saved tables in it.
// `again-press`: the Flow's save is a plain press and it keeps the hand journey (plain's). Wherever the second attempt reaches a
// round, the model goes through the three tables and presses each again, then reads the list. The judge says yes to whatever it is
// shown, because the point of this form is what the Lab's own oracle says. Since t869 the same words carry what landed: the saved
// Flow's Saves read already done, and a press by hand is refused as already done, so nothing is unsaved and the run exits 0. Before,
// an achieved attempt carried nothing and this form unsaved all three.
// `run-again`: `again-press` with its second attempt started by a press of Run again on the first's answer, which the Lab makes
// (`../../live/press-run-again.ts`): the press that means do it again, with an empty act record. On this site that unsaves all
// three, which is what was asked, and the Lab judges it so (`judgeAskedAgain`): proof that a repeat is still caught where it is one.
import type { ScriptedModelRequest } from "../wire-request.js";
import type { ScriptedModelScript, ScriptedReply } from "../script.js";
import { currentPageOf, evidenceOf, latestOf, pageLine, pressOf, toolCall, type EvidenceEntry } from "./evidence.js";

export type SaveDiningTablesForm = "plain" | "reshape" | "row-link" | "open-save-back" | "by-hand" | "by-hand-unread" | "again-check" | "again-press" | "run-again";

const SAVE = ["modify_existing"];
/** The three presses of the by-hand forms, by the call that makes each. */
const SAVES = ["save-1", "save-2", "save-3"] as const;
const READ_NODE = "web.output.dom-extract_list";
const PRESS_NODE = "web.output.dom-click";
const NAVIGATE_NODE = "web.output.browser-navigate";
const CHECK_NODE = "web.output.dom-check";

type Field = { key: string; sample?: string; label?: string; kind?: string; type?: string; coverage?: number };
type DraftStep = { step: number; actionId: string; disposition?: string; written?: boolean; does?: { target?: string }; input?: { parameters?: { url?: string } } };

const startAttempt: ScriptedReply = (request) => ({ do: "flow.createHere", with: { instruction: request.message } });
const finish = (summary: string): Record<string, unknown> => ({ kind: "evidence_tool_decision", summary, decision: { kind: "complete", result: { summary } } });
const callsMade = (request: ScriptedModelRequest): ReadonlySet<string> => new Set(evidenceOf(request).map((entry) => entry.callId));

function fieldsOf(structure: EvidenceEntry): readonly Field[] {
  return Array.isArray(structure.value.fields) ? structure.value.fields as readonly Field[] : [];
}

function fieldWhere(fields: readonly Field[], holds: (field: Field) => boolean, what: string): string {
  const field = fields.find(holds);
  if (!field) throw new Error(`The read's fields hold no ${what}: ${fields.map((candidate) => `${candidate.key}=${candidate.sample ?? candidate.label ?? ""}`).join("; ")}`);
  return field.key;
}

/** What a person reads off a result card: the title is its longest line, the price the one a listing is sold at, the link its address, and the sponsored mark what tells an advert. */
function resultColumns(fields: readonly Field[]) {
  const whole = fields.filter((field) => field.coverage === 1);
  const lines = whole.filter((field) => field.kind === "text" && field.type === "text").sort((left, right) => (right.sample ?? "").length - (left.sample ?? "").length);
  return {
    title: fieldWhere(lines, () => true, "title"),
    price: fieldWhere(whole, (field) => field.type === "currency", "price"),
    url: fieldWhere(whole, (field) => field.kind === "link", "address"),
    sponsored: fieldWhere(fields, (field) => field.sample === "Sponsored", "sponsored mark"),
  };
}

const readOf = (structure: EvidenceEntry, columns: Record<string, string>, where: readonly Record<string, unknown>[], extra: Record<string, unknown> = {}) => ({
  node: READ_NODE,
  parameters: { extractList: { handle: structure.value.extraction, fields: columns, where, minItems: 1 }, ...extra },
  consequences: [],
});

function draftSteps(request: ScriptedModelRequest): readonly DraftStep[] {
  const draft = latestOf(request, "core.flow_draft");
  return Array.isArray(draft?.value.steps) ? draft.value.steps as readonly DraftStep[] : [];
}

/** The steps the Flow holds, in order, as the draft numbers them. */
const proposedSteps = (request: ScriptedModelRequest): readonly DraftStep[] => draftSteps(request).filter((step) => step.disposition === "kept" || step.disposition === "added" || step.written === true);

function listPage(request: ScriptedModelRequest): string {
  const structure = latestOf(request, "web.detect_repeating_structure");
  const location = structure?.value.location;
  if (typeof location !== "string") throw new Error("The request holds no list address to come back to");
  return location;
}

/** The listings of the page's list that are tables, cheapest first as the page sorts them: no advert, and not the legs or the chairs that a search for tables turns up. */
function tablesOn(page: string): readonly { handle: string; price: number; address: string }[] {
  const base = /\(~ = ([^)]+)\)/u.exec(page)?.[1];
  const rows = page.split("\n").flatMap((line) => {
    const row = /^(t\d+) link "£(\d+)(?:£\d+)? ([^"]*)" ~(\/item\/[^\s]+)$/u.exec(line);
    return base && row && !/\b(table legs|chairs)\b/iu.test(row[3]!) ? [{ handle: row[1]!, price: Number(row[2]), address: `${base}${row[4]}` }] : [];
  });
  if (rows.length < 3) throw new Error(`The list shows fewer than three tables: ${page}`);
  return rows;
}

/** What stands over a page: each only while it shows. */
function clearTheWay(request: ScriptedModelRequest, page: string): Record<string, unknown> | undefined {
  if (pageLine(page, /button "Allow all cookies"/u)) return pressOf(request, "Allow cookies so the page can be used.", `cookies-${request.ordinal}`, /button "Allow all cookies"/u);
  if (pageLine(page, /button "Not now"/u)) return pressOf(request, "Put off the notifications prompt.", `not-now-${request.ordinal}`, /button "Not now"/u);
  return undefined;
}

/** Search, narrow to five miles and sort cheapest first, until the list shows. */
function reachTheList(request: ScriptedModelRequest, page: string, made: ReadonlySet<string>): Record<string, unknown> | undefined {
  if (!/^URL ~\/search\//mu.test(page)) {
    const box = pageLine(page, /field\[search\] "Search Marketplace"/u);
    if (!box) throw new Error("The page shows no Marketplace search box");
    return toolCall("Search Marketplace for dining tables.", "search", "core.run_node", { node: "web.output.dom-type", parameters: { target: { handle: box.handle }, text: "dining table", submit: true }, consequences: [] }, true);
  }
  if (pageLine(page, /dialog "Change location"/u)) {
    const radius = pageLine(page, /select "Radius"/u);
    if (!radius) throw new Error("The location dialog shows no Radius");
    if (!made.has("choose-radius")) return toolCall("Choose five miles.", "choose-radius", "core.run_node", { node: "web.output.dom-select", parameters: { target: { handle: radius.handle }, value: "5" }, consequences: [] }, true);
    // The site swallows the first Apply after a choice, and the same call again is refused as a repeat: the second names how long to wait for the button.
    const apply = pageLine(page, /button "Apply"/u)!;
    const again = made.has("apply-1");
    return toolCall(again ? "Apply the radius again, the first press changed nothing." : "Apply the radius.", again ? "apply-2" : "apply-1", "core.run_node", { node: PRESS_NODE, parameters: { target: { handle: apply.handle }, ...(again ? { timeoutMs: 12_000 } : {}) }, consequences: [] }, true);
  }
  if (!made.has("open-radius")) return pressOf(request, "Open the radius picker.", "open-radius", /button "Kelford · Within 20 mi"/u);
  if (!made.has("open-sort")) return pressOf(request, "Open the sort menu.", "open-sort", /field "Sort by"/u);
  if (!made.has("sort-cheapest")) return pressOf(request, "Sort cheapest first.", "sort-cheapest", /option "Price: lowest first"/u);
  return undefined;
}

const decideOf = (form: SaveDiningTablesForm): ScriptedReply => (request) => {
  const page = currentPageOf(request);
  const arriving = clearTheWay(request, page);
  if (arriving) return arriving;
  const made = callsMade(request);
  if (made.has("forward")) return readBack(request, page, made, form === "again-press" || form === "run-again");
  if (/^URL ~\/item\//mu.test(page)) return saveAndReturn(request, page, made, form);
  const reaching = reachTheList(request, page, made);
  if (reaching) return reaching;
  const structure = latestOf(request, "web.detect_repeating_structure");
  if (!structure) {
    return toolCall("See the shape of the listings.", "detect", "web.detect_repeating_structure", { target: tablesOn(page)[0]!.handle });
  }
  const columns = resultColumns(fieldsOf(structure));
  // Adverts are not listings, and the legs and the chairs are not tables: the three left are the cheapest tables.
  const tables = [{ field: columns.sponsored, is: "present", not: true }, { field: columns.title, contains: ["table legs", "chairs"], not: true }, { field: columns.price, atMost: tablesOn(page)[2]!.price }];
  if (!made.has("read-tables")) return toolCall("Read the tables on offer, cheapest first, leaving out adverts, table legs and chairs.", "read-tables", "core.run_node", readOf(structure, { title: columns.title, price: columns.price, url: columns.url }, tables), form !== "reshape");
  if (!made.has("open-first")) {
    if (form === "row-link") return toolCall("Open the cheapest table by pressing its card.", "open-first", "core.run_node", { node: PRESS_NODE, parameters: { target: { handle: tablesOn(page)[0]!.handle } }, consequences: [] }, true);
    return toolCall("Open the cheapest table's own page by its address.", "open-first", "core.run_node", { node: NAVIGATE_NODE, parameters: { url: tablesOn(page)[0]!.address }, consequences: [] }, true);
  }
  // Back on the list the structure's handle is new: see the listings again before the Flow's read is written or run.
  if (!made.has("detect-again")) return toolCall("See the listings again now that the page is back.", "detect-again", "web.detect_repeating_structure", { target: tablesOn(page)[0]!.handle });
  if (form === "reshape" && !made.has("write-read")) return toolCall("Write the Flow's read of the tables, with the columns the Flow will carry.", "write-read", "core.run_node", { ...readOf(structure, { listing: columns.title, link: columns.url }, tables), write: true });
  if (!made.has("forward") && !repeating(request)) return repeatSave(request, form);
  if (!made.has("forward")) return toolCall("Run forward on the tables not saved yet.", "forward", "core.run_flow", { from: readStep(request, form) });
  throw new Error("unreachable");
};

/** The list by its address, as a step of the Flow: what the address holds, the search, radius and sort, need no steps of their own. */
const writeTheList = (request: ScriptedModelRequest): Record<string, unknown> => toolCall("Go to the sorted list by its address, which holds the search, the radius and the sort.", "write-list", "core.run_node", { node: NAVIGATE_NODE, parameters: { url: listPage(request) }, consequences: [], write: true });

/** The hand journey that first reached the list, to leave out now the Flow goes there by address: all but the start, and the cookies step the site may ask again. */
function handJourney(request: ScriptedModelRequest): { step: number; change: string }[] {
  const steps = proposedSteps(request);
  const arrives = steps.findIndex((step, at) => at > 0 && step.actionId === NAVIGATE_NODE && /\/search\//u.test(step.input?.parameters?.url ?? ""));
  return steps.slice(1, Math.max(arrives, 1)).filter((step) => step.does?.target !== "Allow all cookies").map((step) => ({ step: step.step, change: "drop" }));
}

/** The read paid run `run-mw37vz9n-a77a02c2` wrote, as it wrote it: a working list of title, price and link, adverts and what is no table left out. */
function workingRead(structure: EvidenceEntry, dedupe: boolean): Record<string, unknown> {
  const columns = resultColumns(fieldsOf(structure));
  const where = [{ field: columns.sponsored, is: "absent" }, { field: columns.title, matches: "[Dd]ining table" }, { field: columns.title, matches: "legs x4|chairs", not: true }];
  const schema = { schemaVersion: "0.1", fields: [{ id: "title", label: "Title", valueType: "string" }, { id: "price", label: "Price", valueType: "string" }, { id: "link", label: "Link", valueType: "url" }] };
  const read = readOf(structure, { title: columns.title, price: columns.price, link: columns.url }, where, { recordOutput: { datasetId: "candidates", schema, writeMode: "replace", purpose: "intermediate" } });
  return dedupe ? { ...read, parameters: { ...read.parameters, extractList: { ...read.parameters.extractList, dedupe: true } } } : read;
}

/** The first table's hand presses, which a draft may keep: its card and its Save, by the words they acted on. */
const strayPress = (step: DraftStep): boolean => step.actionId === PRESS_NODE && /^(?:£|Saved?$)/u.test(step.does?.target ?? "");

/** The steps of the loop as the draft now holds them: the read, the press that opens a row, the written save, the way back, and the hand presses to leave out. */
function openSaveBackSteps(request: ScriptedModelRequest): { read: number; open: number; check: number; back: number; strays: readonly number[] } {
  const steps = proposedSteps(request);
  const checkAt = steps.findIndex((step) => step.actionId === CHECK_NODE);
  const before = steps.slice(0, Math.max(checkAt, 0)).reverse();
  const open = before.find((step) => step.actionId === PRESS_NODE);
  const check = steps[checkAt];
  const read = before.find((step) => step.actionId === READ_NODE);
  const back = steps.slice(checkAt + 1).find((step) => step.actionId === NAVIGATE_NODE) ?? before.find((step) => step.actionId === NAVIGATE_NODE);
  if (!open || !check || !read || !back) throw new Error(`The draft holds no read, opening, save and way back: ${JSON.stringify(steps)}`);
  return { read: read.step, open: open.step, check: check.step, back: back.step, strays: steps.filter((step) => step !== open && strayPress(step)).map((step) => step.step) };
}

const decideOpenSaveBackOf = (form: "open-save-back" | "again-check"): ScriptedReply => (request) => {
  const page = currentPageOf(request);
  const arriving = clearTheWay(request, page);
  if (arriving) return arriving;
  const made = callsMade(request);
  if (made.has("forward")) return readBack(request, page, made, form === "again-check");
  const base = /\(~ = ([^)]+)\)/u.exec(page)?.[1];
  if (repeating(request)) {
    if (!made.has("see-saved")) return toolCall("Open the saved items to see their layout, as the Flow's last stage.", "see-saved", "core.run_node", { node: NAVIGATE_NODE, parameters: { url: `${base}/saved/` }, consequences: [] }, true);
    return toolCall("Run the save loop forward over the remaining cheapest tables.", "forward", "core.run_flow", { from: openSaveBackSteps(request).open });
  }
  if (made.has("write-save")) {
    const steps = openSaveBackSteps(request);
    const drop = steps.strays.map((step) => ({ step, change: "drop" }));
    const backMoves = steps.back < steps.check ? [{ step: steps.back, change: "reorder", to: steps.check }] : [];
    const journey = form === "again-check" ? handJourney(request) : [];
    return { kind: "evidence_tool_decision", summary: "Open, save and go back over the first three kept rows, leaving out the presses made by hand.", decision: { kind: "amend_draft", amendments: [...journey, ...drop, ...backMoves, { step: steps.open, change: "repeat", over: steps.read, through: steps.back, most: 3 }] } };
  }
  if (made.has("save-first") && !made.has("back-first")) return toolCall("Back to the sorted results to read the list.", "back-first", "core.run_node", { node: NAVIGATE_NODE, parameters: { url: listPage(request) }, consequences: [] }, true);
  if (/^URL ~\/item\//mu.test(page)) {
    if (!made.has("save-first")) {
      const save = pageLine(page, /button "Save"$/u);
      if (!save) throw new Error("The table's page shows no Save");
      return toolCall("Press Save on the cheapest table and see that it lands.", "save-first", "core.run_node", { node: PRESS_NODE, parameters: { target: { handle: save.handle } }, consequences: SAVE });
    }
    const saved = pageLine(page, /button "Saved"/u);
    if (!saved) throw new Error(`The table's page shows no Saved: ${page.slice(0, 300)}`);
    return toolCall("Write an idempotent save step, so the loop never unsaves a table.", "write-save", "core.run_node", { node: CHECK_NODE, parameters: { target: { handle: saved.handle }, checked: true }, consequences: SAVE, write: true });
  }
  const reaching = reachTheList(request, page, made);
  if (reaching) return reaching;
  if (!latestOf(request, "web.detect_repeating_structure")) return toolCall("See the shape of the listings.", "detect", "web.detect_repeating_structure", { target: tablesOn(page)[0]!.handle });
  if (!made.has("open-first")) return toolCall("Open the cheapest real table to find its Save.", "open-first", "core.run_node", { node: PRESS_NODE, parameters: { target: { handle: tablesOn(page)[0]!.handle } }, consequences: [] });
  // Back on the list the structure's handle is new: see the listings again before the Flow's read is written.
  if (!made.has("detect-again")) return toolCall("See the listings again now that the page is back.", "detect-again", "web.detect_repeating_structure", { target: tablesOn(page)[0]!.handle });
  const structure = latestOf(request, "web.detect_repeating_structure")!;
  if (form === "again-check" && !made.has("write-list")) return writeTheList(request);
  if (!made.has("read-deduped")) return toolCall("Read the tables, each once.", "read-deduped", "core.run_node", workingRead(structure, true));
  if (!made.has("read-tables")) return toolCall("Read the tables on offer, leaving out adverts, table legs and chairs.", "read-tables", "core.run_node", workingRead(structure, false), true);
  return toolCall("Open the first table's page to reach its Save.", "open-again", "core.run_node", { node: PRESS_NODE, parameters: { target: { handle: tablesOn(page)[0]!.handle } }, consequences: [] }, true);
};

/** Every table saved by hand, as the paid runs did: its page, its Save, on to the next, and no forward pass (header). */
function decideByHand(form: "by-hand" | "by-hand-unread"): ScriptedReply {
  let tables: ReturnType<typeof tablesOn> | undefined;
  return (request) => {
    const page = currentPageOf(request);
    const arriving = clearTheWay(request, page);
    if (arriving) return arriving;
    const made = callsMade(request);
    const saved = SAVES.filter((save) => made.has(save)).length;
    if (saved === SAVES.length) return readBack(request, page, made);
    if (/^URL ~\/item\//mu.test(page)) {
      const save = pageLine(page, /button "Save"$/u);
      if (save) return toolCall("Press Save on this table.", SAVES[saved]!, "core.run_node", { node: PRESS_NODE, parameters: { target: { handle: save.handle } }, consequences: SAVE }, true);
      return toolCall("Open the next table's own page.", `open-${saved + 1}`, "core.run_node", { node: NAVIGATE_NODE, parameters: { url: tables![saved]!.address }, consequences: [] }, true);
    }
    const reaching = reachTheList(request, page, made);
    if (reaching) return reaching;
    tables ??= tablesOn(page);
    if (form === "by-hand") {
      const structure = latestOf(request, "web.detect_repeating_structure");
      if (!structure) return toolCall("See the shape of the listings.", "detect", "web.detect_repeating_structure", { target: tables[0]!.handle });
      const columns = resultColumns(fieldsOf(structure));
      if (!made.has("read-tables")) return toolCall("Read the tables on offer, leaving out adverts, table legs and chairs.", "read-tables", "core.run_node", readOf(structure, { title: columns.title, price: columns.price, url: columns.url }, [{ field: columns.sponsored, is: "present", not: true }, { field: columns.title, contains: ["table legs", "chairs"], not: true }]), true);
    }
    return toolCall("Open the cheapest table by pressing its card.", "open-1", "core.run_node", { node: PRESS_NODE, parameters: { target: { handle: tables[0]!.handle } }, consequences: [] }, true);
  };
}

/** The two steps of one table's save the Flow holds: its own page opened by address, and Save pressed on it. The draft may hold the way back to the list after them, so they are found by what they do. */
function saveSpan(request: ScriptedModelRequest, form: SaveDiningTablesForm): { open: number; save: number; read: number } {
  const steps = proposedSteps(request);
  const openAt = steps.length - 1 - [...steps].reverse().findIndex((step) => step.actionId === NAVIGATE_NODE && /\/item\//u.test(step.input?.parameters?.url ?? ""));
  const open = steps[openAt];
  const save = steps.slice(openAt + 1).find((step) => step.actionId === PRESS_NODE);
  if (!open || !save) throw new Error(`The draft holds no table opened and saved: ${JSON.stringify(steps)}`);
  return { open: open.step, save: save.step, read: readStep(request, form) };
}

/** The step that reads the tables the Flow acts on: the one written for it in the reshaping form, else the one the model explored with. */
function readStep(request: ScriptedModelRequest, form: SaveDiningTablesForm): number {
  const reads = proposedSteps(request).filter((step) => step.actionId === READ_NODE && (form !== "reshape" || step.written === true));
  const read = reads.at(-1);
  if (!read) throw new Error(`The draft holds no read of the tables: ${JSON.stringify(proposedSteps(request))}`);
  return read.step;
}

/** The three kept steps of the row-link design, found by what they do: the press on the card, the press on Save, and the way back to the list. */
function cardSpan(request: ScriptedModelRequest): { open: number; back: number; read: number } {
  const steps = proposedSteps(request);
  const lastOf = (node: string, before: number): number => steps.slice(0, before).map((step) => step.actionId).lastIndexOf(node);
  const backAt = lastOf(NAVIGATE_NODE, steps.length);
  const saveAt = lastOf(PRESS_NODE, backAt);
  const openAt = lastOf(PRESS_NODE, saveAt);
  if (backAt < 0 || saveAt < 0 || openAt < 0) throw new Error(`The draft holds no table opened, saved and come back from: ${JSON.stringify(steps)}`);
  return { open: steps[openAt]!.step, back: steps[backAt]!.step, read: readStep(request, "row-link") };
}

/** Repeat the opening and the save over the read's rows, the address each pass opens bound to its row's own; in the row-link form the three kept steps, with no binding: each pass must find its own row's card. */
function repeatSave(request: ScriptedModelRequest, form: SaveDiningTablesForm): Record<string, unknown> {
  if (form === "row-link") {
    const cards = cardSpan(request);
    return { kind: "evidence_tool_decision", summary: "Save each table the read keeps: press its card, press Save, come back.", decision: { kind: "amend_draft", amendments: [{ step: cards.open, change: "repeat", through: cards.back, over: cards.read }] } };
  }
  const span = saveSpan(request, form);
  const repeat = { step: span.open, change: "repeat", through: span.save, over: span.read };
  const readFirst = form === "plain" || form === "again-press" || form === "run-again";
  const bind = { step: span.open, change: "bind", input: { url: { $row: readFirst ? "url" : "link" } } };
  const amendments = readFirst ? [repeat, bind] : [{ step: span.read, change: "reorder", to: span.open }, repeat, bind];
  return { kind: "evidence_tool_decision", summary: "Save each table the read keeps: open its page by its own address, press Save.", decision: { kind: "amend_draft", amendments } };
}

/** Whether the draft already repeats its opening of a table. */
function repeating(request: ScriptedModelRequest): boolean {
  return JSON.stringify(latestOf(request, "core.flow_draft")?.value.steps ?? []).includes("repeats through");
}

/** On a table's own page: press Save once, then come back to the list by its address, which is a step of the Flow only in the row-link form. */
function saveAndReturn(request: ScriptedModelRequest, page: string, made: ReadonlySet<string>, form: SaveDiningTablesForm): Record<string, unknown> {
  if (!made.has("save-first")) {
    const save = pageLine(page, /button "Save"$/u);
    if (!save) throw new Error("The table's page shows no Save");
    return toolCall("Save the cheapest table, by hand, to see that it works.", "save-first", "core.run_node", { node: PRESS_NODE, parameters: { target: { handle: save.handle } }, consequences: SAVE }, true);
  }
  return toolCall("Go back to the list of tables.", "back-first", "core.run_node", { node: NAVIGATE_NODE, parameters: { url: listPage(request) }, consequences: [] }, form === "row-link");
}

/**
 * After the forward run the view is the page as it stands, so its Saved link is pressed by the handle it shows, as a
 * model would. A press refused there, as a handle read from a view of a page left behind is, goes by the address.
 * With `whole` every step of it goes in the Flow, and by the address: the link's words hold how many are saved, which a later run finds different.
 */
function readBack(request: ScriptedModelRequest, page: string, made: ReadonlySet<string>, whole = false): Record<string, unknown> {
  const forward = latestOf(request, "core.run_flow");
  if (forward && forward.value.passed !== true) throw new Error(`The forward run did not pass: ${JSON.stringify(forward.value).slice(0, 1500)}`);
  const base = /\(~ = ([^)]+)\)/u.exec(page)?.[1];
  if (!base) throw new Error("The page names no address its links are relative to");
  const onSaved = /^URL ~\/saved\//mu.test(page);
  if (whole && !onSaved) return toolCall("Open my saved items by their address.", "open-saved-by-address", "core.run_node", { node: NAVIGATE_NODE, parameters: { url: `${base}/saved/` }, consequences: [] }, true);
  if (!made.has("open-saved") && !onSaved) return pressOf(request, "Open my saved items.", "open-saved", /link "Saved(?: \d+)?" ~\/saved\//u);
  if (!onSaved && !made.has("open-saved-by-address")) return toolCall("Open my saved items by their address.", "open-saved-by-address", "core.run_node", { node: NAVIGATE_NODE, parameters: { url: `${base}/saved/` }, consequences: [] });
  const saved = currentSavedPage(request);
  if (!made.has("sort-saved")) return toolCall("Sort the saved items cheapest first.", "sort-saved", "core.run_node", { node: "web.output.dom-select", parameters: { target: { handle: pageLine(saved, /select "Sort saved items"/u)!.handle }, value: "price_ascend" }, consequences: [] }, whole);
  if (!made.has("detect-saved")) return toolCall("See the shape of the saved items.", "detect-saved", "web.detect_repeating_structure", { target: pageLine(saved, /link .* ~\/item\//u)!.handle });
  const detected = latestOf(request, "web.detect_repeating_structure")!;
  const fields = fieldsOf(detected);
  const columns = {
    title: fieldWhere(fields, (field) => field.coverage === 1 && field.kind === "text" && field.type === "text" && fields.some((other) => other.key === `${field.key}_url`), "title"),
    price: fieldWhere(fields, (field) => field.coverage === 1 && field.type === "currency", "price"),
    status: fieldWhere(fields, (field) => field.coverage === 1 && /^(Available|Sold)$/u.test(field.sample ?? ""), "status"),
  };
  if (!made.has("read-saved")) {
    const schema = { schemaVersion: "0.1", fields: ["title", "price", "status"].map((id) => ({ id, label: id, valueType: "string" })) };
    return toolCall("Read everything saved, cheapest first.", "read-saved", "core.run_node", readOf(detected, columns, [], { recordOutput: { datasetId: "saved-items", schema, writeMode: "append" } }), whole);
  }
  return finish("Saved the three cheapest dining tables and listed everything in my saved items, cheapest first.");
}

/** The saved items page as it stands now: the newest view that is that page. */
function currentSavedPage(request: ScriptedModelRequest): string {
  const page = currentPageOf(request);
  if (!/^URL ~\/saved\//mu.test(page)) throw new Error(`The saved items page is not showing: ${page.slice(0, 300)}`);
  return page;
}

const answersRequest: ScriptedReply = () => ({ kind: "diagnosis", diagnosis: { answersRequest: "yes", defects: [] }, summary: "The saved items are listed, cheapest first." });

const SAVED_TABLES = ["Round pine dining table", "Glass dining table", "Dining table, industrial"] as const;

/** A judge that reads what it is shown: the rows Core put in its summary must hold the three saved tables. */
const answersFromTheRows: ScriptedReply = (request) => {
  const summary = JSON.stringify((request.payload?.context as { resultSummary?: { recordSets?: unknown } } | undefined)?.resultSummary?.recordSets ?? null);
  const missing = SAVED_TABLES.filter((title) => !summary.includes(title));
  if (missing.length === 0) return answersRequest(request);
  return { kind: "diagnosis", diagnosis: { answersRequest: "no", defects: missing.map((row) => ({ kind: "asked_missing", row, requestWords: "everything in my saved items" })) }, summary: `The table does not hold: ${missing.join(", ")}.` };
};

/** `again-press`, on the second attempt: once the Flow's run has stopped, each of the first attempt's three tables pressed again by hand (header). */
function pressedAgainInRounds(decide: ScriptedReply): ScriptedReply {
  let tables: ReturnType<typeof tablesOn> | undefined;
  let again = 0;
  let inRounds = false;
  return (request) => {
    const page = currentPageOf(request);
    inRounds ||= latestOf(request, "core.attempt_note")?.value.flowRun !== undefined;
    if (!inRounds) {
      if (/^URL ~\/search\/\S*radius=5\S*sortBy=price_ascend/mu.test(page)) tables ??= tablesOn(page).slice(0, 3);
      return decide(request);
    }
    const made = callsMade(request);
    if (again === (tables?.length ?? 0)) return readBack(request, page, made);
    const table = tables![again]!;
    if (page.includes(`URL ~${new URL(table.address).pathname.replace(/^.*?(\/item\/)/u, "$1")}`)) {
      again += 1;
      // Its act declared, as a model's is, so nothing can say it got through for want of that.
      const control = pageLine(page, /button "Saved?"(?: pressed)?$/u);
      if (!control) throw new Error(`The table's page shows no Save or Saved: ${page.slice(0, 300)}`);
      return toolCall("Save this table.", `again-save-${again}`, "core.run_node", { node: PRESS_NODE, parameters: { target: { handle: control.handle } }, consequences: SAVE });
    }
    return toolCall("Open the next table's own page.", `again-open-${again + 1}`, "core.run_node", { node: NAVIGATE_NODE, parameters: { url: table.address }, consequences: [] });
  };
}

/** What a later attempt was told of the saved Flow's run, where the rounds were reached at all. This form expects a whole run, so anything else is said and refused, never answered with a press. */
const noRoundAfterAWholeRun = (decide: ScriptedReply): ScriptedReply => (request) => {
  const note = latestOf(request, "core.attempt_note")?.value.flowRun as { stoppedAt?: number; happened?: string } | undefined;
  if (note) throw new Error(`The saved Flow's run did not end the attempt, stopped at step ${note.stoppedAt ?? "none"}: ${note.happened ?? "no reason given"}`);
  return decide(request);
};

/** Rounds of both attempts: each kind's replies are counted across a run, and two attempts are one run. */
const MOST_DECISIONS = 80;

export function localClassifiedsSaveDiningTablesScript(form: string = "plain"): ScriptedModelScript {
  if (form !== "plain" && form !== "reshape" && form !== "row-link" && form !== "open-save-back" && form !== "by-hand" && form !== "by-hand-unread" && form !== "again-check" && form !== "again-press" && form !== "run-again") throw new Error(`This script has no form "${form}". It has plain, reshape, row-link, open-save-back, by-hand, by-hand-unread, again-check, again-press and run-again`);
  const decide = form === "again-check" ? noRoundAfterAWholeRun(decideOpenSaveBackOf(form))
    : form === "again-press" || form === "run-again" ? pressedAgainInRounds(decideOf(form))
    : form === "open-save-back" ? decideOpenSaveBackOf(form)
    : form === "by-hand" || form === "by-hand-unread" ? decideByHand(form)
    : decideOf(form);
  const judge = form === "again-check" ? answersFromTheRows : answersRequest;
  return Object.freeze({
    taskId: "local-classifieds-save-dining-tables",
    replies: {
      panel_command: [startAttempt, startAttempt],
      evidence_tool_decision: Array.from({ length: MOST_DECISIONS }, () => decide),
      loop_verification: [judge, judge, judge],
    },
  });
}
