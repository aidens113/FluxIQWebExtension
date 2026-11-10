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
// **What is already applied is read off the page's address**, as a person reads the filter chips: the site writes
// each filter and the sort into the search URL (`freeShipping=y`, `maxPrice=10`, `sort=price_asc`). A second attempt's
// rounds start on the page its saved Flow left, with some of the filters already on, and a press of Free shipping
// there would turn it off again. The calls this round made still guard each press, so a step is never sent twice
// in one round.
//
// **The `timed-check` form** plays the same path for the `-timed-check` variant row, where a check only a person may
// pass covers the first page a moment after it loads, with nothing done there. It looks at the page before its first
// press, so the hand-off comes from a look, and refuses to go on otherwise (`lookAtTheCheckFirst`).
//
// **The `left-out` form** answers four attempts, the later three replays of the saved Flow, and its judge stands on what
// each read left out (run-mwaudvnh-c208d32c: a saved Flow's replay kept the non-ad rows and left the ads out, rightly,
// and its judge was told what each read kept and never what it left out). Before it answers, the judge requires every
// read page of the result to say, under the ad condition, the rows it left out (`leftOutOnEveryReadPage`), and refuses
// by name a page that says none, so a replay whose reads reach the judge without that account fails the proof.
//
// Every handle, field key and filter label is read from the request's own evidence, never written here.
import type { ScriptedModelScript, ScriptedReply } from "../script.js";
import { currentPageOf, evidenceOf, latestOf, pageLine, pressOf, toolCall, type EvidenceEntry } from "./evidence.js";
import { scriptedJudgement } from "./judgement.js";
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

/** The search address's own parameters, from the page's `URL` line; none on a page with no search address. */
function searchParams(page: string): URLSearchParams {
  const query = /^URL ~\/search\?(\S*)/mu.exec(page)?.[1];
  return new URLSearchParams(query ?? "");
}

const decide: ScriptedReply = (request) => {
  const page = currentPageOf(request);
  const made = callsMade(request);
  const applied = searchParams(page);
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
  if (!made.has("free-shipping") && applied.get("freeShipping") !== "y") return pressOf(request, "Narrow to hubs that ship free.", "free-shipping", /clickable "Free shipping"$/u);
  const ceilingOn = applied.get("maxPrice") === String(CEILING);
  if (!made.has("ceiling-typed") && !ceilingOn) {
    const max = pageLine(page, /field.*"Max"/u);
    if (!max) throw new Error("The page shows no Max price box");
    if (!max.line.includes(`="${CEILING}"`)) return toolCall("Type the price ceiling.", "ceiling-typed", "core.run_node", { node: "web.output.dom-type", parameters: { target: { handle: max.handle }, text: String(CEILING) }, consequences: [] }, true);
  }
  if (!made.has("ceiling-applied") && !ceilingOn) return pressOf(request, "Apply the price ceiling.", "ceiling-applied", /clickable "OK"$/u);
  if (!made.has("sort-by-price") && applied.get("sort") !== "price_asc") return pressOf(request, "Sort the hubs cheapest first.", "sort-by-price", /clickable "Price ↑"$/u);
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
const answersRequest: ScriptedReply = (request) => scriptedJudgement(request, { answersRequest: "yes", summary: "The rows are the free hubs at ten euros or less the person asked for." });

/** The most decisions this script answers: every step of its honest path, and few enough that a loop fails it. */
const MOST_DECISIONS = 30;

/** The timed check's words as the page view writes them: the question it puts, and the box it asks a person to press. */
const TIMED_CHECK = /confirm you are human|Verify you are human/iu;
/** The node a look runs: it reads the page and is never a step of the Flow. */
const LOOK_NODE = "web.output.dom-capture_snapshot";
/** This form's own look, and the round's opening call, whose look after it landed reads the page it arrived on. */
const LOOK_CALL = "look-at-the-page";
const OPENING_CALL = "initial.core.run_node";

/**
 * The `timed-check` form, for the task's `timed-check` variant: a check only a person may pass comes up over the
 * first page on its own timer, with nothing done there. Before its first press of the run, this form requires that a
 * look handed the check to the person and that it then stood past it, and it presses nothing while the check shows.
 *
 * - A round whose evidence shows the person completed a check (`personCompletedCheck`, Core's note on the call that
 *   met it) on its opening call or on this form's look goes on as the plain form does, from the page as it stands.
 *   Any other call is not a look, and is refused by name.
 * - Otherwise the round looks at the page, once: with the check standing, that look is what meets it. A look that
 *   comes back with no hand-off is refused, saying whether the check stood (no look sees it as the person's) or did not
 *   (the variant was not armed, or its timer had not run). Never an answer from the plain path: a run that met the
 *   check through a press would prove the action path, which is not what this form is for.
 *
 * Whether a look has handed the check over is kept for the run, so the later attempts, which start past the check the
 * person passed, go on as the plain form does. Four attempts are answered, the `lab attempt` default.
 */
function lookAtTheCheckFirst(plain: ScriptedReply): ScriptedReply {
  let handedOff = false;
  return (request) => {
    if (!handedOff) {
      const completed = evidenceOf(request).find((entry) => entry.value.personCompletedCheck === true);
      if (completed) {
        if (completed.callId !== OPENING_CALL && completed.callId !== LOOK_CALL) throw new Error(`The person completed the check from ${completed.callId}, which is not a look`);
        handedOff = true;
      } else {
        const shows = TIMED_CHECK.test(currentPageOf(request));
        if (callsMade(request).has(LOOK_CALL)) {
          throw new Error(shows ? "The round looked at the page while the check stood, and the look handed nothing to the person" : "The round looked at the page and no check stood over it: the variant was not armed, or its timer had not run");
        }
        return toolCall(shows ? "A check covers the page. Look at the page as it stands, pressing nothing." : "Look at the page as it stands before doing anything on it.", LOOK_CALL, "core.run_node", { node: LOOK_NODE, parameters: {}, consequences: [] });
      }
    }
    if (TIMED_CHECK.test(currentPageOf(request))) throw new Error("The check still covers the page after the person completed it");
    return plain(request);
  };
}

/** A read page of the result as the judge is shown it (Core `flow-less/read-pages-shown.ts`). */
type ShownReadPage = { place?: string; kept?: number; keptRows?: readonly string[]; leftOut?: readonly { by?: string; rows?: readonly string[] }[] };

/**
 * The `left-out` form's judge: it answers as `plain` does only where every read page of the result says what its
 * conditions left out (header), and throws, naming the pages, where one does not. A page that kept no row is held to
 * it too: it was read the same way.
 */
const leftOutOnEveryReadPage: ScriptedReply = (request) => {
  const context = request.payload?.context as { resultSummary?: { readPages?: readonly ShownReadPage[] } } | undefined;
  const pages = context?.resultSummary?.readPages ?? [];
  if (!pages.length) throw new Error("The judge was shown no read page of the result");
  const silent = pages.flatMap((page, index) => (page.leftOut?.some((set) => (set.rows?.length ?? 0) > 0) ? [] : [`read page ${index + 1}${page.place ? ` (${page.place})` : ""}, kept ${page.kept ?? "?"}`]));
  if (silent.length) throw new Error(`The judge was not told what these reads left out: ${silent.join("; ")}`);
  return answersRequest(request);
};

const LATER_ATTEMPTS = 3;

/**
 * The task's script, for the unarmed read or its `timed-check` variant (`taskId` names which). `plain` is the read's
 * honest path for two attempts; `timed-check` is that path behind a look at the timed check, for the default four;
 * `left-out` is the plain path for the default four, judged on what each read page left out.
 */
export function crossborderMarketplaceFreeHubsUnderTenScript(taskId: string, form: string = "plain"): ScriptedModelScript {
  if (form !== "plain" && form !== "timed-check" && form !== "left-out") throw new Error(`This script has no form "${form}". It has plain, timed-check and left-out`);
  if (form === "plain") {
    return Object.freeze({
      taskId,
      replies: {
        panel_command: [startAttempt, startAttempt],
        evidence_tool_decision: Array.from({ length: MOST_DECISIONS }, () => decide),
        loop_verification: [answersRequest, answersRequest, answersRequest],
      },
    });
  }
  const attempts = 1 + LATER_ATTEMPTS;
  if (form === "left-out") {
    return Object.freeze({
      taskId,
      replies: {
        panel_command: Array.from({ length: attempts }, () => startAttempt),
        evidence_tool_decision: Array.from({ length: MOST_DECISIONS }, () => decide),
        loop_verification: Array.from({ length: 2 * attempts }, () => leftOutOnEveryReadPage),
      },
    });
  }
  const decideTimed = lookAtTheCheckFirst(decide);
  return Object.freeze({
    taskId,
    replies: {
      panel_command: Array.from({ length: attempts }, () => startAttempt),
      evidence_tool_decision: Array.from({ length: MOST_DECISIONS + 2 }, () => decideTimed),
      loop_verification: Array.from({ length: 2 * attempts }, () => answersRequest),
    },
  });
}
