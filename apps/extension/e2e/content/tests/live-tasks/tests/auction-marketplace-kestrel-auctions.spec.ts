// Can the product read `auction-marketplace-kestrel-auctions`' ten owed rows
// off the real Hammerline fixture, with no Lab run and no model? (t194-w25)
//
// Every step a Flow would take is taken by the content script's own verbs,
// delivered as the background worker delivers them: the arrival overlays, the
// search, the rail filters, the bot check, the price box, the sort and the
// read. `page.*` is used only to wait for a document, to observe what is on
// it, and to tap the runtime stub's outbox for a read's checkpoints. The owed
// rows, the instruction and the manifest's own extraction are imported from the
// scenario, never copied.
//
// What the rows prove, and the gaps they name (the report beside the brief,
// `t194-w25-kestrel-fixture.md`, has the causes and the fixes):
//
// - the filter route reads the ten owed rows with the manifest's own selectors,
//   and every site trap on the way is met by the product: the overlays, the
//   condition filter's format reset, the bot check, Enter in the price box
//   submitting nothing, the sort button's ignored first press, the skeletons;
// - **G1** a read built from the structure detection cannot return the badged
//   listing's title: no proposed column is the title alone
//   (`content/extraction/infer-fields.ts` `pathStep`);
// - **G2** the keyword results' numbered pager is not detected, so a read
//   from the detection's handle reads page one and stops
//   (`content/extraction/detect-pagination.ts`);
// - **G3** a bound over a price written the continental way reads the wrong
//   number (`domain/src/actions/extraction/condition-match.ts` `NUMBER`);
// - **G4** (grid-view row) a read whose every record is empty still passes its
//   post-condition (`content/actions/extract-list.ts` `validationFor`);
// - and not a gap: the Next arrow that reloads page two does not trap a read,
//   which takes the pager's next number instead (`extraction/pagination.ts`).
//
// A row marked `test.fail` asserts the correct answer and is expected to fail
// until its gap is fixed; Playwright reports it the moment it starts passing.
//
// Cross-document reads: a numbered link loads a new document and the harness's
// page script dies with it. `readAcrossDocuments` is the worker's half
// (`src/runtime/extract-list-continuation.ts`, unit-tested in
// `src/runtime/tests/extract-list-continuation.test.ts`) re-enacted here, so
// the content script's half runs for real in every document, checkpoints
// included; the worker's own code is not what runs.

import type { Page } from "@playwright/test";
import type { JsonObject } from "fluxiq/core";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_RUN_NODE_TOOL_ID,
  type WebLlmEvidenceGateway
} from "@fluxiq-web-extension/domain";
import {
  webAutomationExtractConditionNumber,
  type WebAutomationExtractItemCondition,
  type WebAutomationExtractListRequest,
  type WebAutomationStructureDetection
} from "@fluxiq-web-extension/domain/client";
import { AUCTION_MARKETPLACE_LIVE_TASKS, auctionMarketplaceManifest } from "../../../../../../scenario-lab/src/scenarios/auction-marketplace/index.js";
import { parseSearchParams, searchListings } from "../../../../../../scenario-lab/src/scenarios/auction-marketplace/catalog/index.js";
import type { BrowserActionCommand, BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

const TASK = AUCTION_MARKETPLACE_LIVE_TASKS.find((task) => task.id === "auction-marketplace-kestrel-auctions")!;
const WORKFLOW = auctionMarketplaceManifest.workflows!.find((workflow) => workflow.recordingScript.some((step) => step.id === TASK.expectedDatasetId))!;
/** The ten rows the judge compares against, in order. */
const OWED = WORKFLOW.expected!.extracted!.find((entry) => entry.step === TASK.expectedDatasetId)!.records!;
/** The manifest's own read of the filtered, sorted results. */
const MANIFEST_READ = WORKFLOW.recordingScript.find((step) => step.id === TASK.expectedDatasetId)!;
const OWED_COLUMNS = ["title", "price", "bids", "postage"] as const;
/** How many live listings the keyword search returns, by the fixture's own search: fifty, over three overlapping pages. */
const KEYWORD_LISTINGS = searchListings(parseSearchParams(new URLSearchParams("_nkw=kestrel+35&_sop=1")), []).length;

const RESULTS_PATH = "/sch/i.html";
const SEARCH_BOX = 'form[role="search"] input[name="_nkw"]';
const PAGER = 'nav[aria-label="Results pagination"]';
const NEXT_ARROW = `${PAGER} a[aria-label="Go to next search page"]`;
const EXTRACT_LIST_NODE = "web.output.dom-extract_list";
const CHECKPOINT_MESSAGE = "fluxiq.extraction.checkpoint";
const BASE = { projectId: "project.kestrel-fixture", flowId: "flow.kestrel-fixture", maxEvidenceBytes: 24_000 } as const;
/**
 * The title column G1's fix would propose: the heading's span that carries no
 * class, which is the title on every card, badged or not. Used only where a
 * row isolates another part of the chain from G1.
 */
const TITLE_WITHOUT_BADGE = ":scope > div:nth-child(2) > a span:not([class])";

type Row = Record<string, string | null>;
type Detected = Extract<WebAutomationStructureDetection, { ok: true }>;
type Packet = { extraction: string; itemCount: number; fields: Array<{ key: string; label: string; coverage: number }> };
type Acted = BrowserActionResult | "document replaced";

let command = 0;

function note(label: string, value: unknown): void {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  console.log(`[kestrel] ${label}: ${text}`);
  test.info().annotations.push({ type: label, description: text.slice(0, 2_000) });
}

/** Whether an error is the harness losing the document it was talking to, which is what a navigation does to it. */
function documentWent(error: unknown): boolean {
  return error instanceof Error && /Execution context was destroyed|navigat|frame was detached|stub is not installed|Cannot find context/iu.test(error.message);
}

/** One verb, as the worker sends it. A navigation that takes the document before the reply is reported, not thrown. */
async function act(harness: ContentHarness, action: Omit<BrowserActionCommand, "commandId">): Promise<Acted> {
  try {
    return await harness.runAction({ commandId: `kestrel.${++command}`, ...action } as BrowserActionCommand);
  } catch (error) {
    if (documentWent(error)) return "document replaced";
    throw error;
  }
}

function succeeded(reply: Acted): BrowserActionResult {
  expect(reply, "the verb answered in the document it was sent to").not.toBe("document replaced");
  const result = reply as BrowserActionResult;
  expect(result.status, JSON.stringify({ message: result.message, validation: result.validation, failure: (result as { failure?: unknown }).failure })).toBe("succeeded");
  return result;
}

/** Waits for the content script to announce itself in the page's current document. */
async function ready(harness: ContentHarness): Promise<void> {
  await harness.page.waitForLoadState("load");
  await expect.poll(async () => (await harness.messages().catch(() => [])).some((message) => message.type === "fluxiq.contentReady"), { timeout: 15_000 }).toBe(true);
}

/** Waits for a document at another address than `before` that `matches`, and for the content script in it. */
async function arrive(harness: ContentHarness, before: string, matches: (url: URL) => boolean): Promise<void> {
  await harness.page.waitForURL((url) => url.href !== before && matches(url), { timeout: 20_000, waitUntil: "load" });
  await ready(harness);
}

const isResults = (url: URL): boolean => url.pathname.endsWith(RESULTS_PATH);

/** The product's own wait for the cards to hydrate from their skeletons (`ul[aria-busy]` turns false). */
async function hydrated(harness: ContentHarness): Promise<void> {
  succeeded(await act(harness, { actionType: "web.dom.wait_for_selector", selector: 'ul[aria-busy="false"]', timeoutMs: 5_000 }));
}

/** Clicks a link with the content script and waits for the document it loads. */
async function follow(harness: ContentHarness, selector: string, matches: (url: URL) => boolean = isResults): Promise<Acted> {
  const before = harness.page.url();
  const reply = await act(harness, { actionType: "web.dom.click", selector, timeoutMs: 10_000 });
  await arrive(harness, before, matches);
  return reply;
}

/** Names the rail option labelled `label` by its position, which is all a selector can name: the classes are build hashes. Observes only. */
async function railOption(page: Page, section: string, label: string): Promise<string> {
  const index = await page.evaluate(([name, wanted]) => Array.from(document.querySelectorAll(`section[aria-label="${name}"] li`))
    .findIndex((item) => item.querySelector("a > span")?.textContent === wanted), [section, label] as const);
  expect(index, `the ${section} filter offers ${label}`).toBeGreaterThanOrEqual(0);
  return `section[aria-label="${section}"] li:nth-child(${index + 1}) > a`;
}

/** The buying-format tab the results say they show. */
async function formatTab(page: Page): Promise<string | null> {
  return await page.locator('nav[aria-label="Buying format"] a[aria-current="page"]').textContent();
}

/** Arms a fixture variant through the Lab's authenticated endpoint and reloads into it. */
async function armVariant(harness: ContentHarness, mode: string): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/set-mode`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify({ mode })
  });
  expect(response.ok, `the Lab armed ${mode}`).toBe(true);
  await harness.page.reload();
  await ready(harness);
}

/** The home page's three arrivals, answered in the one order that holds: promotion, greeting, cookies. */
async function answerArrivals(harness: ContentHarness): Promise<void> {
  succeeded(await act(harness, { actionType: "web.dom.wait_for_selector", selector: 'div[aria-labelledby="hl-promo-title"]', wait: { condition: "visible" }, timeoutMs: 15_000 }));
  succeeded(await act(harness, { actionType: "web.dom.click", selector: 'div[aria-labelledby="hl-promo-title"] > div:last-child > span' }));
  succeeded(await act(harness, { actionType: "web.dom.wait_for_selector", selector: "#hal-greeting", wait: { condition: "visible" }, timeoutMs: 15_000 }));
  succeeded(await act(harness, { actionType: "web.dom.click", selector: "#hal-greeting .hal-close" }));
  succeeded(await act(harness, { actionType: "web.dom.click", selector: 'div[aria-label="Cookie consent"] > div:last-child > button:first-child' }));
}

/** Searches "kestrel 35" from the header and waits for the hydrated results. */
async function search(harness: ContentHarness): Promise<void> {
  succeeded(await act(harness, { actionType: "web.dom.type", selector: SEARCH_BOX, text: "kestrel 35" }));
  const before = harness.page.url();
  const enter = await act(harness, { actionType: "web.dom.keypress", selector: SEARCH_BOX, key: "Enter" });
  if (enter !== "document replaced") expect(enter.status).toBe("succeeded");
  await arrive(harness, before, isResults);
  await hydrated(harness);
}

/** Opens the sort menu (the product presses again when the first press is ignored) and chooses "Time: ending soonest". */
async function sortEndingSoonest(harness: ContentHarness): Promise<BrowserActionResult> {
  const press = succeeded(await act(harness, { actionType: "web.dom.click", selector: 'button[aria-haspopup="menu"]' }));
  await follow(harness, 'div[role="menu"] > a:nth-child(2)', (url) => isResults(url) && url.searchParams.get("_sop") === "1");
  await hydrated(harness);
  return press;
}

/** What the filter route met on the way, for the traps row. */
type FilterWalk = { formatAfterConditions: string | null; challenged: boolean; enterInPrice: BrowserActionResult; enterKeptAddress: boolean; sortPress: BrowserActionResult; surveyRefusal?: unknown };

/**
 * The manifest's own chain, every step by the content script: Pre-owned and
 * Seller refurbished, the Auction tab (after the conditions, which reset it),
 * the bot check when it stands, Model Kestrel 35, Type Rangefinder and Film
 * camera, Max 150 by the round arrow, and the sort.
 */
async function walkFilterRoute(harness: ContentHarness, survey = false): Promise<FilterWalk> {
  const page = harness.page;
  let surveyRefusal: unknown;
  const clearSurvey = async (): Promise<void> => {
    if (!survey) return;
    // The survey interrupts the second results view on, 800 ms after load.
    const shown = await act(harness, { actionType: "web.dom.wait_for_selector", selector: 'div[aria-labelledby="hl-survey-title"]', wait: { condition: "visible" }, timeoutMs: 5_000 });
    if (shown === "document replaced" || shown.status !== "succeeded") return;
    // A press on a control the survey covers -- one that changes nothing if it
    // lands -- says what the click verb does about a modal it did not expect.
    const covered = await act(harness, { actionType: "web.dom.click", selector: "main h1 + button", timeoutMs: 8_000 });
    const surveyStillUp = await page.locator('div[aria-labelledby="hl-survey-title"]').isVisible();
    surveyRefusal ??= {
      reply: covered === "document replaced" ? covered : { status: covered.status, message: covered.message, validation: covered.validation, failure: (covered as { failure?: unknown }).failure },
      surveyStillUp
    };
    if (surveyStillUp) succeeded(await act(harness, { actionType: "web.dom.click", selector: 'div[aria-labelledby="hl-survey-title"] > div:last-child > span' }));
  };
  await answerArrivals(harness);
  await search(harness);
  await follow(harness, await railOption(page, "Condition", "Pre-owned"));
  await hydrated(harness);
  await clearSurvey();
  await follow(harness, await railOption(page, "Condition", "Seller refurbished"));
  await hydrated(harness);
  const formatAfterConditions = await formatTab(page);
  // The fourth results view of the session is sent to the bot check instead.
  await follow(harness, 'nav[aria-label="Buying format"] a:nth-child(2)', (url) => url.pathname.includes("/splashui/challenge") || isResults(url));
  const challenged = page.url().includes("/splashui/challenge");
  if (challenged) {
    const before = page.url();
    await act(harness, { actionType: "web.dom.click", selector: "button", timeoutMs: 10_000 });
    await arrive(harness, before, isResults);
  }
  await hydrated(harness);
  expect(await formatTab(page), "the Auction tab is chosen").toBe("Auction");
  succeeded(await act(harness, { actionType: "web.dom.click", selector: 'section[aria-label="Model"] > div' }));
  await follow(harness, await railOption(page, "Model", "Kestrel 35"));
  await hydrated(harness);
  succeeded(await act(harness, { actionType: "web.dom.click", selector: 'section[aria-label="Type"] > div' }));
  await follow(harness, await railOption(page, "Type", "Rangefinder camera"));
  await hydrated(harness);
  await follow(harness, await railOption(page, "Type", "Film camera"));
  await hydrated(harness);
  succeeded(await act(harness, { actionType: "web.dom.type", selector: 'input[name="_udhi"]', text: "150" }));
  const before = page.url();
  const enterInPrice = succeeded(await act(harness, { actionType: "web.dom.keypress", selector: 'input[name="_udhi"]', key: "Enter" }));
  await page.waitForTimeout(1_500);
  const enterKeptAddress = page.url() === before;
  await act(harness, { actionType: "web.dom.click", selector: 'section[aria-label="Price"] div[title="Submit price range"]', timeoutMs: 10_000 });
  await arrive(harness, before, (url) => isResults(url) && url.searchParams.get("_udhi") === "150");
  await hydrated(harness);
  const sortPress = await sortEndingSoonest(harness);
  return { formatAfterConditions, challenged, enterInPrice, enterKeptAddress, sortPress, surveyRefusal };
}

async function detect(harness: ContentHarness): Promise<Detected> {
  const reply = succeeded(await act(harness, { actionType: "web.dom.capture_snapshot", detectStructure: {} }));
  const structure = reply.structure as WebAutomationStructureDetection;
  expect(structure.ok, `a structure was detected: ${JSON.stringify(structure)}`).toBe(true);
  return structure as Detected;
}

function project(rows: readonly Row[], keys: Record<(typeof OWED_COLUMNS)[number], string>): Row[] {
  return rows.map((row) => Object.fromEntries(OWED_COLUMNS.map((column) => [column, row[keys[column]] ?? null])));
}

/** A field of the detection by the shape of its label: page structure the model is shown, never a value. */
function labelled(fields: readonly { key: string; label: string; coverage: number }[], pattern: RegExp, full: boolean): string {
  const found = fields.find((field) => pattern.test(field.label) && (full ? field.coverage === 1 : field.coverage < 1));
  expect(found, `a detected column labelled ${pattern} (${full ? "on every card" : "on some cards"}): ${fields.map((field) => `${field.label} ${field.coverage}`).join(" | ")}`).toBeTruthy();
  return found!.key;
}

/** The detected columns this task's read needs, picked by label as a model must pick them. */
function taskColumns(fields: readonly { key: string; label: string; coverage: number }[]) {
  return {
    // The title link's words: the one column every card fills with its title.
    // The heading's span beside it reads only the badge on a badged card.
    title: labelled(fields, /> a\.[\w-]+(?: \(.*\))?$/u, true),
    price: labelled(fields, /> div:3 > span\.[\w-]+(?: \(.*\))?$/u, true),
    estimate: labelled(fields, /> div:3 > span\.[\w-]+(?: \(.*\))?$/u, false),
    bids: labelled(fields, /> div:4 > span\.[\w-]+(?: \(.*\))?$/u, true),
    postage: labelled(fields, /> div:6 > span\.[\w-]+(?: \(.*\))?$/u, true),
    condition: labelled(fields, /> div:2 > span:1(?: \(.*\))?$/u, true),
    adMark: labelled(fields, /^data-adid$/u, false)
  };
}

/**
 * The domain's authoring runtime over this harness, as `list-completeness.spec.ts`
 * builds it: every detection and read is the page's, the decisions are the
 * test's, and no model is attached. `send` carries a read into other
 * documents when one is given.
 */
function evidenceRuntime(harness: ContentHarness, dispatched: Array<{ actionType: string; parameters: JsonObject; reply: BrowserActionResult }>) {
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.live-browser"],
    structureDetectionSessionIds: () => ["session.live-browser"],
    executeAction: async (_sessionId, request) => {
      const reply = succeededOrFailed(await act(harness, { actionType: request.actionType, ...request.parameters } as Omit<BrowserActionCommand, "commandId">));
      dispatched.push({ actionType: request.actionType, parameters: request.parameters, reply });
      const payload: JsonObject = {};
      if (reply.snapshot !== undefined) payload.snapshot = JSON.parse(JSON.stringify(reply.snapshot)) as JsonObject;
      if (reply.structure !== undefined) payload.structure = JSON.parse(JSON.stringify(reply.structure)) as JsonObject;
      if (reply.extracted !== undefined) payload.records = JSON.parse(JSON.stringify(reply.extracted)) as JsonObject;
      return { status: reply.status, payload, ...(reply.status === "failed" && typeof reply.message === "string" ? { error: reply.message } : {}) };
    }
  };
  return createWebAutomationLlmEvidenceRuntime(gateway);
}

function succeededOrFailed(reply: Acted): BrowserActionResult {
  expect(reply, "the verb answered in the document it was sent to").not.toBe("document replaced");
  return reply as BrowserActionResult;
}

/**
 * The read the instruction asks for, over detected columns: the instruction's
 * four columns kept under its own names, and its conditions written over the
 * columns the detection showed. Every condition is one the vocabulary has:
 * - advertisements out: the `data-adid` mark is absent;
 * - not for parts: the condition line is not "For parts or not working";
 * - auctions only: the bids line says bids, where fixed price says "Buy it now";
 * - under £150 at the pound estimate: the estimate, where there is one, is not
 *   150 or more, and a price in pounds -- which has no estimate -- is not 150 or
 *   more; `startsWith` keeps the second from reading a foreign price at all;
 * - the original Kestrel 35 only: the title names it and none of the
 *   lookalikes. This is the one condition the vocabulary can say only by
 *   enumerating the lookalikes' spellings this page uses, which is why the
 *   filter route, whose Model filter says it, is the route a Flow should take.
 */
function instructionRead(columns: ReturnType<typeof taskColumns>): { fields: Record<string, string>; where: WebAutomationExtractItemCondition[] } {
  return {
    fields: { title: columns.title, price: columns.price, bids: columns.bids, postage: columns.postage },
    where: [
      { field: columns.adMark, is: "absent" },
      { field: columns.condition, equals: "For parts or not working", not: true },
      { field: "bids", matches: "\\bbids?$" },
      { field: columns.estimate, atLeast: 150, not: true },
      { field: "price", startsWith: "£", atLeast: 150, not: true },
      { field: "title", contains: "kestrel 35" },
      {
        field: "title",
        matches: ["35\\s*-?\\s*s\\b", "\\bm(?:ar)?k\\s*(?:ii|2)\\b", "\\b350\\b", "lens (?:only|cap|hood)", "case only", "box only", "strap", "filter", "self-timer", "instruction manual", "flashgun"],
        not: true
      }
    ]
  };
}

/** A plan value as the runtime's tool input takes it: plain JSON. */
function asJson(value: object): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

// ---------------------------------------------------------------------------
// Reading across documents: the worker's half, re-enacted.

type Taps = { sent: Array<{ type?: string; token?: string; checkpoint?: unknown }> };
const taps = new WeakMap<Page, Taps>();

/** Mirrors every message the content script sends into the test, so a checkpoint sent just before a document goes is not lost with it. */
async function tapOutbox(page: Page): Promise<Taps> {
  let tap = taps.get(page);
  if (!tap) {
    const created: Taps = { sent: [] };
    tap = created;
    taps.set(page, created);
    await page.exposeBinding("__kestrelSent", (_source, message: { type?: string; token?: string; checkpoint?: unknown }) => {
      created.sent.push(message);
    });
  }
  await page.evaluate(() => {
    const host = (window as unknown as Record<string, { sent: unknown[] & { kestrelTap?: boolean } } | undefined>).__fluxiqContentHarness;
    if (!host || host.sent.kestrelTap) return;
    const push = host.sent.push.bind(host.sent);
    host.sent.push = (...items: unknown[]) => {
      for (const item of items) void (window as unknown as { __kestrelSent?: (value: unknown) => Promise<void> }).__kestrelSent?.(item);
      return push(...items);
    };
    host.sent.kestrelTap = true;
  });
  return tap;
}

/** Marks the current document, and waits until the page holds another one with the content script in it. */
async function markDocument(page: Page, mark: string): Promise<void> {
  await page.evaluate((value) => { (window as unknown as Record<string, string>).__kestrelDocument = value; }, mark);
}

async function nextDocument(harness: ContentHarness, mark: string): Promise<void> {
  await expect.poll(async () => await harness.page.evaluate(() => (window as unknown as Record<string, string | undefined>).__kestrelDocument).catch(() => mark), { timeout: 20_000 }).not.toBe(mark);
  await ready(harness);
}

type CrossDocumentRead = { reply: BrowserActionResult; documents: string[]; checkpoints: number[] };

/**
 * One paginated read carried into every document its pagination loads, as the
 * worker carries it: a token beside the action, the last checkpoint taken from
 * the page's own `fluxiq.extraction.checkpoint`, and the same action sent again
 * with it once the reply is lost to a navigation. A document that goes without
 * checkpointing is allowed three times in a row, as the worker allows.
 */
async function readAcrossDocuments(harness: ContentHarness, extractList: WebAutomationExtractListRequest, timeoutMs: number): Promise<CrossDocumentRead> {
  const tap = await tapOutbox(harness.page);
  const token = `kestrel-read-${++command}`;
  const deadline = Date.now() + timeoutMs;
  const documents: string[] = [];
  const checkpoints: number[] = [];
  let resume: unknown;
  for (let stalled = 0; ;) {
    await tapOutbox(harness.page);
    const mark = `${token}.${documents.length}`;
    await markDocument(harness.page, mark);
    documents.push(new URL(harness.page.url()).search);
    const from = tap.sent.length;
    try {
      const delivery = await harness.deliver({
        type: "executeAction",
        topFrameOnly: true,
        extraction: { token, ...(resume === undefined ? {} : { resume }) },
        action: { commandId: token, actionType: "web.dom.extract_list", timeoutMs: Math.max(1, deadline - Date.now()), extractList }
      });
      expect(delivery.responded, "the page answered the read").toBe(true);
      return { reply: delivery.response as BrowserActionResult, documents, checkpoints };
    } catch (error) {
      if (!documentWent(error)) throw error;
      await nextDocument(harness, mark);
      const taken = tap.sent.slice(from).filter((message) => message.type === CHECKPOINT_MESSAGE && message.token === token).at(-1);
      if (taken) {
        resume = taken.checkpoint;
        checkpoints.push((taken.checkpoint as { pagesRead: number }).pagesRead);
        stalled = 0;
      } else {
        stalled += 1;
        expect(stalled, "documents in a row that went without a checkpoint").toBeLessThanOrEqual(3);
      }
    }
  }
}

// ---------------------------------------------------------------------------

test.describe("auction-marketplace-kestrel-auctions on the fixture", () => {
  test.describe.configure({ timeout: 180_000 });

  test("filter route: the content script walks the manifest's chain and the manifest's read returns the ten owed rows", async ({ openHarness }) => {
    const harness = await openHarness("auction-marketplace");
    const walk = await walkFilterRoute(harness);
    note("walk", walk);

    // The traps, each met by the product rather than by the test.
    expect(walk.formatAfterConditions, "a condition click puts the results back on All listings").toBe("All listings");
    expect(walk.challenged, "the fourth results view is the bot check, and Continue passes it").toBe(true);
    expect(walk.enterInPrice.validation).toMatchObject({ status: "passed", actual: "the form has no submit button and more than one field, so Enter does not submit it" });
    expect(walk.enterKeptAddress, "Enter in the price box submits nothing").toBe(true);
    expect(walk.sortPress.validation, "the sort button ignores its first press and the click verb presses again").toMatchObject({ status: "passed", actual: expect.stringContaining("the page ignored the first press, so it was pressed once more") });
    expect(new URL(harness.page.url()).searchParams.get("_sop"), "sorted by ending soonest").toBe("1");

    const read = succeeded(await act(harness, { actionType: "web.dom.extract_list", timeoutMs: 20_000, extractList: { item: MANIFEST_READ.target!, fields: MANIFEST_READ.fields! } }));
    expect(read.extraction).toMatchObject({ recordCount: OWED.length, pagesRead: 1, truncated: false, itemsSeen: OWED.length });
    expect(read.extracted, "the ten owed rows, in the order they end").toEqual(OWED);
  });

  test("filter route: the detection keeps the ads apart and reads price, bids and postage as the cards show them", async ({ openHarness }) => {
    const harness = await openHarness("auction-marketplace");
    await walkFilterRoute(harness);
    const { proposal, infiniteScroll } = await detect(harness);
    note("filtered proposal", { item: proposal.item, itemCount: proposal.itemCount, pagination: proposal.pagination ?? null, infiniteScroll: infiniteScroll ?? null, fields: proposal.fields.map((field) => `${field.label} ${field.coverage}`) });
    // Ten results and two advertisements, one of them m4 again: the item
    // selector takes both kinds, and the ad mark is a column to narrow by.
    expect(proposal.itemCount).toBe(OWED.length + 2);
    const columns = taskColumns(proposal.fields);
    const all = succeeded(await act(harness, {
      actionType: "web.dom.extract_list",
      timeoutMs: 20_000,
      extractList: { item: proposal.item, fields: Object.fromEntries(proposal.fields.map((field) => [field.key, field.spec])), where: [{ field: columns.adMark, is: "absent" }] }
    }));
    const rows = (all.extracted ?? []) as Row[];
    expect(rows.map((row) => row[columns.price]), "the price slot alone: never \"or Buy it now\", never the estimate").toEqual(OWED.map((row) => row.price));
    expect(rows.map((row) => row[columns.bids])).toEqual(OWED.map((row) => row.bids));
    expect(rows.map((row) => row[columns.postage])).toEqual(OWED.map((row) => row.postage));
    expect(rows.map((row) => row[columns.estimate] === null ? "none" : /^approx\. £\d+\.\d\d$/u.test(row[columns.estimate]!) ? "estimate" : row[columns.estimate]),
      "the pound estimate is its own column, there exactly where the price is not in pounds").toEqual(OWED.map((row) => row.price!.startsWith("£") ? "none" : "estimate"));
    // The fix G1 proposes reads every title, the badged one included.
    const fixed = succeeded(await act(harness, {
      actionType: "web.dom.extract_list",
      timeoutMs: 20_000,
      extractList: { item: proposal.item, fields: { title: TITLE_WITHOUT_BADGE }, where: [{ read: { kind: "attribute", attribute: "data-adid" }, is: "absent" }] }
    }));
    expect((fixed.extracted as Row[]).map((row) => row.title)).toEqual(OWED.map((row) => row.title));
  });

  test("filter route, G1: a read built from the detection through the evidence runtime returns the ten owed rows", async ({ openHarness }) => {
    test.fail(true, "G1: no detected column is the title alone; the badged listing m9 reads \"New listing\" (content/extraction/infer-fields.ts pathStep)");
    const harness = await openHarness("auction-marketplace");
    await walkFilterRoute(harness);
    const dispatched: Array<{ actionType: string; parameters: JsonObject; reply: BrowserActionResult }> = [];
    const runtime = evidenceRuntime(harness, dispatched);
    const detected = await runtime.executeTool({ ...BASE, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
    expect(detected.resultCode, JSON.stringify(detected.evidence)).toBe("web.structure.detected");
    const packet = detected.evidence as unknown as Packet;
    note("filtered packet", packet.fields.map((field) => `${field.key} | ${field.label} | ${field.coverage}`));
    const columns = taskColumns(packet.fields);
    const read = await runtime.executeTool({
      ...BASE,
      callId: "call.read",
      toolId: WEB_LLM_RUN_NODE_TOOL_ID,
      value: { node: EXTRACT_LIST_NODE, parameters: { extractList: { handle: packet.extraction, ...asJson(instructionRead(columns)) } }, consequences: [] }
    });
    expect(read.resultCode, JSON.stringify(read.evidence)).toBe("web.inspect.succeeded");
    const sent = dispatched.filter((entry) => entry.actionType === "web.dom.extract_list").at(-1)!;
    note("filtered runtime request", sent.parameters.extractList);
    const rows = (sent.reply.extracted ?? []) as Row[];
    note("filtered runtime rows", rows);
    expect(rows.length, "ten rows: the conditions keep every owed listing and nothing else").toBe(OWED.length);
    expect(rows.map(({ price, bids, postage }) => ({ price, bids, postage }))).toEqual(OWED.map(({ price, bids, postage }) => ({ price, bids, postage })));
    expect(rows, "and every title as the card shows it").toEqual(OWED);
  });

  test("keyword route, G2: the detection says how the results continue", async ({ openHarness }) => {
    test.fail(true, "G2: the numbered pager inside nav[aria-label=\"Results pagination\"] is not detected (content/extraction/detect-pagination.ts:107)");
    const harness = await openHarness("auction-marketplace");
    await answerArrivals(harness);
    await search(harness);
    await sortEndingSoonest(harness);
    const { proposal } = await detect(harness);
    note("keyword proposal", { item: proposal.item, itemCount: proposal.itemCount, pagination: proposal.pagination ?? null });
    expect(proposal.pagination, "a numbered pagination over the pager's page links").toMatchObject({ mode: "numbered" });
  });

  test("keyword route: through the evidence runtime the read stops at page one, then read across documents with G1 and G2 supplied it returns the ten owed rows", async ({ openHarness }) => {
    const harness = await openHarness("auction-marketplace");
    await answerArrivals(harness);
    await search(harness);
    await sortEndingSoonest(harness);

    const dispatched: Array<{ actionType: string; parameters: JsonObject; reply: BrowserActionResult }> = [];
    const runtime = evidenceRuntime(harness, dispatched);
    const detected = await runtime.executeTool({ ...BASE, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
    expect(detected.resultCode, JSON.stringify(detected.evidence)).toBe("web.structure.detected");
    const packet = detected.evidence as unknown as Packet;
    note("keyword packet", packet.fields.map((field) => `${field.key} | ${field.label} | ${field.coverage}`));
    const columns = taskColumns(packet.fields);
    const read = await runtime.executeTool({
      ...BASE,
      callId: "call.read",
      toolId: WEB_LLM_RUN_NODE_TOOL_ID,
      value: { node: EXTRACT_LIST_NODE, parameters: { extractList: { handle: packet.extraction, ...asJson(instructionRead(columns)), minItems: 0 } }, consequences: [] }
    });
    expect(read.resultCode, JSON.stringify(read.evidence)).toBe("web.inspect.succeeded");
    const sent = dispatched.filter((entry) => entry.actionType === "web.dom.extract_list").at(-1)!;
    const request = sent.parameters.extractList as unknown as WebAutomationExtractListRequest;
    note("keyword runtime request", request);
    note("keyword runtime summary", sent.reply.extraction);
    // G2 as the person would meet it: no pagination, one page, and nothing says the list went on.
    expect(request.paginate, "the handle carries no pagination, so the read cannot ask for one").toBeUndefined();
    const pageOne = (sent.reply.extracted ?? []) as Row[];
    expect(pageOne.length, "page one holds only some of the owed rows").toBeLessThan(OWED.length);
    expect(sent.reply.extraction?.truncated, "and the read does not say it stopped short").toBe(false);
    // Every condition was resolved into a read of its own column: the estimate
    // and the condition line are tested without becoming columns of the table.
    expect(Object.keys(request.fields).sort()).toEqual([...OWED_COLUMNS].sort());

    // The same literal request, with G2's pagination and G1's title supplied,
    // carried across the documents its numbered links load: page 2, the bot
    // check the fourth results view meets, and page 3.
    const whole: WebAutomationExtractListRequest = {
      ...request,
      fields: { ...request.fields, title: TITLE_WITHOUT_BADGE },
      paginate: { mode: "numbered", pages: `${PAGER} > a`, maxPages: 5 }
    };
    const across = await readAcrossDocuments(harness, whole, 90_000);
    note("keyword across documents", { documents: across.documents, checkpoints: across.checkpoints, status: across.reply.status, extraction: across.reply.extraction, validation: across.reply.validation });
    expect(across.reply.status, JSON.stringify(across.reply.validation ?? across.reply.message)).toBe("succeeded");
    expect(across.reply.extraction).toMatchObject({ pagesRead: 3 });
    expect(across.reply.extracted, "the ten owed rows, each once, in the order they end").toEqual(OWED);
  });

  test("keyword route: the Next arrow that reloads page two does not trap a read -- it goes on to page three by the pager's numbers", async ({ openHarness }) => {
    const harness = await openHarness("auction-marketplace");
    await answerArrivals(harness);
    await search(harness);
    await sortEndingSoonest(harness);
    const { proposal } = await detect(harness);
    const across = await readAcrossDocuments(harness, {
      item: `${proposal.item}[data-listingid]`,
      fields: { title: TITLE_WITHOUT_BADGE, link: { kind: "link", selector: ":scope > div:nth-child(2) > a" } },
      paginate: { next: NEXT_ARROW, maxPages: 4 },
      minItems: 0
    }, 90_000);
    note("next arrow", { documents: across.documents, checkpoints: across.checkpoints, status: across.reply.status, extraction: across.reply.extraction, validation: across.reply.validation });
    // Page 2's arrow leads back to page 2 (pages/results.ts:44-57); the read
    // sees a Next that leads to its own page and takes the number after the
    // current one instead (content/extraction/pagination.ts pagerSuccessor).
    // Between the two, the fourth results view is the bot check, which clears itself.
    expect(across.documents.map((search) => new URLSearchParams(search).get("_pgn") ?? (search.startsWith("?ru=") ? "check" : "1"))).toEqual(["1", "2", "check", "3"]);
    expect(across.reply.status).toBe("succeeded");
    expect(across.reply.extraction, "every live listing the search returns, each once").toMatchObject({ recordCount: KEYWORD_LISTINGS, pagesRead: 3 });
  });

  test("G3: a bound over a price written the continental way reads the amount the page states", () => {
    test.fail(true, "G3: NUMBER in domain/src/actions/extraction/condition-match.ts reads '169,00' as 16900 and '1.165,00' as 1.165");
    // m9 and x7 as their cards write them (cameras.ts:28,37 via money.ts:18-24).
    const m9 = OWED.find((row) => row.price?.startsWith("EUR 169"))!.price!;
    expect(webAutomationExtractConditionNumber(m9)).toBe(169);
    expect(webAutomationExtractConditionNumber("EUR 1.165,00")).toBe(1165);
  });

  /** Arms `variant`, walks the filter route and reads the result with the detection's every column, organic cards only. */
  async function variantWalk(harness: ContentHarness, variant: "grid-view" | "feedback-survey") {
    const task = AUCTION_MARKETPLACE_LIVE_TASKS.find((entry) => entry.variantId === variant && entry.expectedDatasetId === TASK.expectedDatasetId);
    expect(task, `live-tasks.ts sets the ${variant} row`).toBeTruthy();
    await armVariant(harness, variant);
    const walk = await walkFilterRoute(harness, variant === "feedback-survey");
    note(`${variant} walk`, { challenged: walk.challenged, surveyRefusal: walk.surveyRefusal ?? null });
    const manifestRead = succeededOrFailed(await act(harness, { actionType: "web.dom.extract_list", timeoutMs: 20_000, extractList: { item: MANIFEST_READ.target!, fields: MANIFEST_READ.fields! } }));
    note(`${variant} manifest read`, { status: manifestRead.status, extraction: manifestRead.extraction, validation: manifestRead.validation });
    const { proposal } = await detect(harness);
    note(`${variant} proposal`, { item: proposal.item, itemCount: proposal.itemCount, fields: proposal.fields.map((field) => `${field.label} ${field.coverage}`) });
    const all = succeeded(await act(harness, {
      actionType: "web.dom.extract_list",
      timeoutMs: 20_000,
      extractList: { item: `${proposal.item}[data-listingid]`, fields: Object.fromEntries(proposal.fields.map((field) => [field.key, field.spec])) }
    }));
    const rows = (all.extracted ?? []) as Row[];
    // The detected columns equal to each owed column, row for row.
    const offered = Object.fromEntries(OWED_COLUMNS.map((column) => [column, proposal.fields
      .filter((field) => rows.length === OWED.length && rows.every((row, index) => row[field.key] === OWED[index]![column]))
      .map((field) => field.label)])) as Record<(typeof OWED_COLUMNS)[number], string[]>;
    note(`${variant} owed columns offered`, offered);
    return { walk, manifestRead, proposal, offered };
  }

  test("grid-view: price, bids and postage are detected columns, and the list layout's read comes back empty rather than failing", async ({ openHarness }) => {
    const harness = await openHarness("auction-marketplace");
    const { manifestRead, proposal, offered } = await variantWalk(harness, "grid-view");
    // The Flow built on the list layout meets the gallery: its positions name
    // no element, and the read says so only in its sentence (G4).
    expect(manifestRead.status).toBe("succeeded");
    expect(manifestRead.extraction).toMatchObject({ recordCount: OWED.length, emptyRecords: OWED.length });
    expect(manifestRead.validation?.status).toBe("passed");
    for (const column of ["price", "bids", "postage"] as const) expect(offered[column], `a detected column is the owed ${column}`).not.toEqual([]);
    // G1's fix reads the gallery's titles too.
    const fixed = succeeded(await act(harness, {
      actionType: "web.dom.extract_list",
      timeoutMs: 20_000,
      extractList: { item: `${proposal.item}[data-listingid]`, fields: { title: ":scope h3 a span:not([class])" } }
    }));
    expect((fixed.extracted as Row[]).map((row) => row.title)).toEqual(OWED.map((row) => row.title));
  });

  test("grid-view, G1: a detected column holds every owed title", async ({ openHarness }) => {
    test.fail(true, "G1 in the gallery: the heading link reads the badge and the title run together, its span the badge alone (content/extraction/infer-fields.ts pathStep)");
    const harness = await openHarness("auction-marketplace");
    const { offered } = await variantWalk(harness, "grid-view");
    expect(offered.title).not.toEqual([]);
  });

  test("feedback-survey: the survey is met by the click verb, and the filter route reads the ten owed rows", async ({ openHarness }) => {
    const harness = await openHarness("auction-marketplace");
    const { walk, manifestRead, offered } = await variantWalk(harness, "feedback-survey");
    expect(walk.surveyRefusal, "the survey came up on the second results view").toBeTruthy();
    expect(manifestRead.extracted, "the list layout's read is unchanged under the survey").toEqual(OWED);
    for (const column of ["price", "bids", "postage"] as const) expect(offered[column], `a detected column is the owed ${column}`).not.toEqual([]);
  });
});
