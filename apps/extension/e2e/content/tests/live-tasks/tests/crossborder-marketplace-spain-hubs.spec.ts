// Can the product read `crossborder-marketplace-spain-hubs` off the real site,
// with no Lab and no model? (t194-w26)
//
// The live task asks for every hub that ships from Spain, ships free and is
// rated 4.5 or better, ads left out, each once, in Best Match order, as the
// results write title, store, price and rating. The answer is
// `spainHubRecords()` -- thirteen rows -- and is imported, never copied.
//
// Every action on the page below is the content script's own
// (`harness.runAction`), aimed at the element the content script's own
// snapshot lists under the words a person would name it by. `page.*` only waits
// and observes, with one exception that is the person's and not the product's:
// the traffic screen's "I'm not a robot", which the task declares a person
// hand-off (`live-tasks.ts` TRAFFIC_SCREEN).
//
// Reads go through the domain's evidence runtime with scripted decisions, as
// `extraction/tests/list-completeness.spec.ts` does: detect, read every column,
// then name the columns and conditions the instruction asks for. The decisions
// are what a model can write -- detected keys and conditions over them -- and a
// column is chosen by the values a read showed, which is all a model has to go
// on: the packet labels are paths through hashed class names (D3).
//
// A row marked `test.fail` asserts the correct answer and fails for its named
// gap; once the gap's fix lands it passes unexpectedly and the marker comes off.
// Rows that fail here fail for a product cause, named in the assertion and in
// `docs/working/language-driven-flow-loop-plan/reports/t194-w26-spain-hubs-fixture.md`.
//
// What the harness cannot show: a list read that follows a pager link loads a
// new document and the page script answering the harness dies with it. The
// unpaged route below plays the worker's part itself -- it catches each
// checkpoint the content script sends before following a control and delivers
// the read again into the next document with that checkpoint as its resume,
// which is what `runtime/extract-list-continuation.ts` does and what
// `src/runtime/tests/extract-list-continuation.test.ts` proves of the worker.

import type { JsonObject } from "fluxiq/core";
import type { Page } from "@playwright/test";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_RUN_NODE_TOOL_ID,
  type WebLlmEvidenceGateway
} from "@fluxiq-web-extension/domain";
import type { WebAutomationExtractListRequest } from "@fluxiq-web-extension/domain/client";
import { MARKET_SEED, spainHubRecords } from "../../../../../../scenario-lab/src/scenarios/crossborder-marketplace/manifest/index.js";
import { marketClasses } from "../../../../../../scenario-lab/src/scenarios/crossborder-marketplace/styles/index.js";
import type { BrowserActionCommand, BrowserActionResult, DomElementDescriptor } from "../../../../../src/shared/protocol.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

const SCENARIO = "crossborder-marketplace";
const EXTRACT_LIST_NODE = "web.output.dom-extract_list";
const CHECKPOINT_MESSAGE = "fluxiq.extraction.checkpoint";
const CHECKPOINT_BINDING = "__w26Checkpoint";
const BASE = { projectId: "project.spain-hubs", flowId: "flow.spain-hubs", maxEvidenceBytes: 48_000 } as const;
const COLUMNS = ["title", "store", "price", "rating"] as const;

type Row = Record<string, string | null>;
type Column = (typeof COLUMNS)[number];
type StructurePacket = { extraction: string; itemCount: number; pagination: string; fields: Array<{ key: string; label: string; kind: string; coverage: number }> };
type Dispatched = { actionType: string; parameters: JsonObject; reply: BrowserActionResult };
type Checkpoint = { records: unknown[]; pagesRead: number; scrolls: number; missingFields: string[] };

/** The thirteen records the task is judged by, computed from the catalogue. */
const EXPECTED = spainHubRecords();

// ---------------------------------------------------------------------------
// The walk: what a Flow's nodes do, with the content script's own actions.
// ---------------------------------------------------------------------------

let commandCount = 0;
function nextId(what: string): string {
  return `spain-hubs.${what}.${++commandCount}`;
}

async function run(harness: ContentHarness, action: Omit<BrowserActionCommand, "commandId">, what: string): Promise<BrowserActionResult> {
  return await harness.runAction({ commandId: nextId(what), ...action } as BrowserActionCommand);
}

/** Waits for a document to finish loading and the content script to announce itself in it. */
async function contentReady(page: Page): Promise<void> {
  await page.waitForLoadState("load");
  await expect.poll(async () => await page.evaluate(() => {
    const stub = (window as unknown as Record<string, { sent: Array<{ type?: string }> } | undefined>).__fluxiqContentHarness;
    return stub?.sent.some((message) => message.type === "fluxiq.contentReady") ?? false;
  }).catch(() => false), { timeout: 15_000, message: "the content script announced itself in the new document" }).toBe(true);
}

/** The snapshot's interactive elements whose own words are exactly `label`. */
async function named(harness: ContentHarness, label: string): Promise<DomElementDescriptor[]> {
  const snapshot = await harness.capture();
  return snapshot.interactiveElements.filter((element) => (element.visibleText ?? element.text ?? "").replace(/\s+/gu, " ").trim() === label);
}

/** Clicks the one element the snapshot lists under `label` (narrowed by `where`), as a click node aimed at it does. */
async function click(harness: ContentHarness, label: string, where: (element: DomElementDescriptor) => boolean = () => true): Promise<BrowserActionResult> {
  const found = (await named(harness, label)).filter(where);
  expect(found.map((element) => element.selector), `the snapshot lists exactly one control named "${label}"`).toHaveLength(1);
  const reply = await run(harness, { actionType: "web.dom.click", selector: found[0]!.selector }, `click ${label}`);
  expect(reply.status, `click "${label}": ${JSON.stringify(reply.validation)}`).toBe("succeeded");
  return reply;
}

/** A click that loads another document: the reply comes back before the load, and the next action waits for the new document. */
async function clickAndLoad(harness: ContentHarness, label: string, where?: (element: DomElementDescriptor) => boolean): Promise<void> {
  const before = harness.page.url();
  await click(harness, label, where);
  await harness.page.waitForURL((url) => url.href !== before, { timeout: 15_000 });
  await contentReady(harness.page);
}

/** The traffic screen, passed as the person the task hands it to passes it. Returns whether it stood. */
async function personPassesTrafficScreen(page: Page): Promise<boolean> {
  if ((await page.title()) !== "Security check") return false;
  await page.getByText("I'm not a robot").click();
  await expect.poll(async () => await page.title().catch(() => "Security check"), { timeout: 15_000 }).not.toBe("Security check");
  await contentReady(page);
  return true;
}

/** Arrival and the search: the welcome coupons, the consent banner, "usb c hub" and Enter (`steps.ts` ARRIVE). */
async function arriveAndSearch(harness: ContentHarness): Promise<void> {
  expect((await run(harness, { actionType: "web.dom.wait_for_text", text: "Welcome back, Mara!", timeoutMs: 8_000 }, "welcome")).status).toBe("succeeded");
  await click(harness, "No thanks");
  await click(harness, "Accept all");
  const boxes = (await harness.capture()).interactiveElements.filter((element) => element.tagName.toLowerCase() === "input" && (element.name ?? element.attributes?.name) === "q");
  expect(boxes, "the snapshot lists the search box").toHaveLength(1);
  const box = boxes[0]!.selector;
  expect((await run(harness, { actionType: "web.dom.type", selector: box, text: "usb c hub" }, "type")).status).toBe("succeeded");
  const before = harness.page.url();
  const enter = await run(harness, { actionType: "web.dom.keypress", selector: box, key: "Enter" }, "enter");
  expect(enter.status, JSON.stringify(enter.validation)).toBe("succeeded");
  await harness.page.waitForURL((url) => url.href !== before && url.pathname.endsWith("/search"), { timeout: 15_000 });
  await contentReady(harness.page);
}

/** The notification prompt arrives 3.5 s into a results page and is answered "Not now". */
async function declineNotifications(harness: ContentHarness): Promise<void> {
  expect((await run(harness, { actionType: "web.dom.wait_for_text", text: "Never miss a price drop", timeoutMs: 8_000 }, "prompt")).status).toBe("succeeded");
  await click(harness, "Not now");
}

/** The sidebar filter of that name. The snapshot's selector is a path, so the sidebar is told apart by the `aside` it sits in. */
const inSidebar = (element: DomElementDescriptor): boolean => / aside( |$)|^aside /u.test(element.selector);

/** Search, then narrow by the sidebar's Spain, Free shipping and 4★ & up, passing the traffic screen the third load brings. */
async function walkFilteredRoute(harness: ContentHarness): Promise<{ trafficScreen: boolean; spainCandidates: string[] }> {
  await arriveAndSearch(harness);
  await declineNotifications(harness);
  // Trap: the header's region picker also offers a Spain, in a shadow root.
  // What the content script lists under "Spain" is what a click node can aim at.
  const spainCandidates = (await named(harness, "Spain")).map((element) => element.selector);
  await clickAndLoad(harness, "Spain", inSidebar);
  await clickAndLoad(harness, "Free shipping", inSidebar);
  const trafficScreen = await personPassesTrafficScreen(harness.page);
  await clickAndLoad(harness, "4★ & up", inSidebar);
  expect(new URL(harness.page.url()).searchParams.get("shipFrom"), "narrowed to Spain").toBe("ES");
  return { trafficScreen, spainCandidates };
}

// ---------------------------------------------------------------------------
// The reads: the domain's evidence runtime over the content script, no model.
// ---------------------------------------------------------------------------

type Reader = {
  runtime: ReturnType<typeof createWebAutomationLlmEvidenceRuntime>;
  dispatched: Dispatched[];
};

/**
 * The runtime over a gateway that plays the background worker: an
 * `extract_list` goes with a continuation token, and a read whose document is
 * replaced goes on in the next one from the last checkpoint it sent.
 */
function reader(harness: ContentHarness, checkpoints: Checkpoint[]): Reader {
  const dispatched: Dispatched[] = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.live-browser"],
    structureDetectionSessionIds: () => ["session.live-browser"],
    executeAction: async (_sessionId, request) => {
      const action = { commandId: nextId(request.actionType), actionType: request.actionType, ...request.parameters } as BrowserActionCommand;
      const reply = action.actionType === "web.dom.extract_list"
        ? await acrossDocuments(harness, action, checkpoints)
        : await harness.runAction(action);
      dispatched.push({ actionType: request.actionType, parameters: request.parameters, reply });
      const payload: JsonObject = {};
      if (reply.snapshot !== undefined) payload.snapshot = JSON.parse(JSON.stringify(reply.snapshot)) as JsonObject;
      if (reply.structure !== undefined) payload.structure = JSON.parse(JSON.stringify(reply.structure)) as JsonObject;
      if (reply.extracted !== undefined) payload.records = JSON.parse(JSON.stringify(reply.extracted)) as JsonObject;
      return { status: reply.status, payload, ...(reply.status === "failed" && typeof reply.message === "string" ? { error: reply.message } : {}) };
    }
  };
  return { runtime: createWebAutomationLlmEvidenceRuntime(gateway), dispatched };
}

/** One list read carried over every document its pagination loads, as `runtime/extract-list-continuation.ts` carries it. */
async function acrossDocuments(harness: ContentHarness, action: BrowserActionCommand, checkpoints: Checkpoint[]): Promise<BrowserActionResult> {
  const token = `t-${action.commandId}`;
  let resume: Checkpoint | undefined;
  for (let document = 0; document < 8; document += 1) {
    const sentBefore = checkpoints.length;
    try {
      const delivery = await harness.deliver({ type: "executeAction", topFrameOnly: true, extraction: { token, ...(resume ? { resume } : {}) }, action });
      if (!delivery.responded) throw new Error("the content script did not answer the list read");
      return delivery.response as BrowserActionResult;
    } catch (error) {
      // The read followed a control and its document was replaced. Go on in the
      // next one from the last checkpoint it sent, after the person passes the
      // traffic screen if that is what loaded.
      if (checkpoints.length === sentBefore) throw error;
      resume = checkpoints.at(-1);
      await contentReady(harness.page);
      await personPassesTrafficScreen(harness.page);
    }
  }
  throw new Error("the list read never finished");
}

/** Records the checkpoints the content script sends, in every document from now on. */
async function catchCheckpoints(page: Page): Promise<Checkpoint[]> {
  const caught: Checkpoint[] = [];
  await page.exposeBinding(CHECKPOINT_BINDING, (_source, json: string) => {
    caught.push((JSON.parse(json) as { checkpoint: Checkpoint }).checkpoint);
  });
  await page.addInitScript(({ binding, type }) => {
    const stub = (window as unknown as Record<string, { sent: unknown[] } | undefined>).__fluxiqContentHarness;
    if (!stub) return;
    const push = stub.sent.push.bind(stub.sent);
    stub.sent.push = (...messages: unknown[]) => {
      for (const message of messages) {
        if ((message as { type?: string }).type === type) (window as unknown as Record<string, (json: string) => void>)[binding]?.(JSON.stringify(message));
      }
      return push(...messages);
    };
  }, { binding: CHECKPOINT_BINDING, type: CHECKPOINT_MESSAGE });
  return caught;
}

async function detect(reader: Reader): Promise<StructurePacket> {
  const detected = await reader.runtime.executeTool({ ...BASE, callId: `call.detect.${++commandCount}`, toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  expect(detected.resultCode, JSON.stringify(detected.evidence)).toBe("web.structure.detected");
  return detected.evidence as unknown as StructurePacket;
}

/** Runs the extraction node over the detected list and returns the rows the page answered and the literal request that went out. */
async function readList(reader: Reader, extractList: JsonObject): Promise<{ rows: Row[]; request: WebAutomationExtractListRequest; reply: BrowserActionResult }> {
  const read = await reader.runtime.executeTool({
    ...BASE,
    callId: `call.read.${++commandCount}`,
    toolId: WEB_LLM_RUN_NODE_TOOL_ID,
    value: { node: EXTRACT_LIST_NODE, parameters: { extractList }, consequences: [] }
  });
  expect(read.resultCode, JSON.stringify(read.evidence).slice(0, 2_000)).toBe("web.inspect.succeeded");
  const sent = reader.dispatched.filter((entry) => entry.actionType === "web.dom.extract_list").at(-1);
  if (!sent) throw new Error("no extract_list went out");
  return { rows: (sent.reply.extracted ?? []) as Row[], request: sent.parameters.extractList as unknown as WebAutomationExtractListRequest, reply: sent.reply };
}

/** The detected keys whose values, over the rows a read showed, include `value` -- the only way a model can tell hashed-path columns apart. */
function columnHolding(rows: Row[], packet: StructurePacket, value: string): string[] {
  return packet.fields.filter((field) => rows.some((row) => row[field.key] === value)).map((field) => field.key);
}

/** The column a model takes for the price: the one holding the price as written, or failing that the one labelled a currency amount. */
function priceColumn(rows: Row[], packet: StructurePacket): { key: string | undefined; asWritten: boolean } {
  const exact = columnHolding(rows, packet, EXPECTED[0]!.price!);
  if (exact.length === 1) return { key: exact[0], asWritten: true };
  return { key: packet.fields.find((field) => field.label.endsWith("(currency amount)"))?.key, asWritten: false };
}

/** The columns the instruction names, found by the values a full read showed. Price is reported separately (`priceColumn`). */
function instructionColumns(rows: Row[], packet: StructurePacket): { title: string; store: string; rating: string; ad: string } {
  const one = (what: string, keys: string[]): string => {
    expect(keys, `exactly one detected column holds the ${what}: ${keys.join(", ")}`).toHaveLength(1);
    return keys[0]!;
  };
  const adKeys = packet.fields.filter((field) => field.coverage < 1 && rows.some((row) => row[field.key] === "Ad") && rows.every((row) => row[field.key] === null || row[field.key] === "Ad")).map((field) => field.key);
  return {
    title: one("title", columnHolding(rows, packet, EXPECTED[0]!.title!)),
    store: one("store", columnHolding(rows, packet, EXPECTED[0]!.store!)),
    rating: one("rating", columnHolding(rows, packet, EXPECTED[0]!.rating!)),
    ad: one('ad mark ("Ad")', adKeys)
  };
}

/** Every detected column, this page only: what a model reads first to see what each column holds. */
async function readEveryColumn(reader: Reader, packet: StructurePacket): Promise<Row[]> {
  const { rows } = await readList(reader, { handle: packet.extraction, paginate: false, minItems: 0 });
  return rows;
}

/** The rows projected onto the instruction's four columns, under the instruction's names. */
function answer(rows: Row[]): Row[] {
  return rows.map((row) => Object.fromEntries(COLUMNS.filter((column) => column in row).map((column) => [column, row[column] ?? null])));
}

function expectedWithout(...left: Column[]): Row[] {
  return EXPECTED.map((record) => Object.fromEntries(COLUMNS.filter((column) => !left.includes(column)).map((column) => [column, record[column] ?? null])));
}

async function cardsOnPage(page: Page): Promise<number> {
  // A card is a child of the results grid with a title link in it; skeletons have none.
  return await page.locator('main section a[target="_blank"] [title]').count();
}

/**
 * Waits, as an observer, for the template's first ten cards to replace their
 * skeletons (600 ms after load). Rows that are not about that race wait for it
 * before detecting; the row that is about it does not.
 */
async function firstCardsDrawn(page: Page): Promise<void> {
  await expect.poll(() => cardsOnPage(page), { timeout: 5_000 }).toBeGreaterThanOrEqual(10);
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

test.describe("crossborder-marketplace-spain-hubs, the site's own filters", () => {
  test("the content script's own actions reach the narrowed results, and the read reaches their lazy tail by itself", async ({ openHarness }) => {
    test.setTimeout(180_000);
    const harness = await openHarness(SCENARIO);
    const walked = await walkFilteredRoute(harness);
    // The region picker's Spain is an <option> in a closed panel of a shadow
    // root: the snapshot does not list it, so a click aimed by name finds only
    // the sidebar's.
    expect(walked.spainCandidates, "only the sidebar's Spain is a clickable \"Spain\"").toHaveLength(1);
    expect(walked.spainCandidates[0]).toMatch(/aside/u);
    expect(walked.trafficScreen, "the third results load is the traffic screen (route.ts:65)").toBe(true);
    expect(new URL(harness.page.url()).searchParams.get("freeShipping")).toBe("y");

    // Ten cards are drawn from the template; the rest are skeletons until scrolled to.
    await expect.poll(() => cardsOnPage(harness.page), { timeout: 5_000 }).toBe(10);
    const read = reader(harness, []);
    const packet = await detect(read);
    expect(packet.pagination, "narrowed, the results fit on one page and show no pager").toBe("none");
    const rows = await readEveryColumn(read, packet);
    expect(rows, "the read revealed the lazy tail itself: 16 organic results and 3 ads").toHaveLength(19);
    expect(await cardsOnPage(harness.page)).toBe(19);
  });

  test("a detection made the moment the narrowed results load names the results, not the sidebar", async ({ openHarness }) => {
    test.fail(true, "G3: a detection within 600 ms of load names the sidebar's filter groups (content/extraction/detect-structure.ts:118-120)");
    test.setTimeout(180_000);
    const harness = await openHarness(SCENARIO);
    await walkFilteredRoute(harness);
    // No wait: the grid is nineteen skeletons for 600 ms after load, and a
    // build's detect can come that soon after the click that loaded it.
    const read = reader(harness, []);
    const packet = await detect(read);
    const rows = await readEveryColumn(read, packet);
    expect(packet.itemCount, `GAP G3: detected ${packet.itemCount} items under ${JSON.stringify(packet.fields.map((field) => field.label))}. detect-structure.ts:118-120 counts any run as settled and waits only while the page has none, so the sidebar's five filter groups answer while the results are skeletons`).toBeGreaterThanOrEqual(10);
    expect(rows.length).toBe(19);
  });

  test("a read built from the detection and the instruction's conditions keeps the thirteen, ads out, in Best Match order (title, store, rating)", async ({ openHarness }) => {
    test.setTimeout(180_000);
    const harness = await openHarness(SCENARIO);
    await walkFilteredRoute(harness);
    await firstCardsDrawn(harness.page);
    const read = reader(harness, []);
    const packet = await detect(read);
    const rows = await readEveryColumn(read, packet);
    const keys = instructionColumns(rows, packet);

    // The site's "4★ & up" is a 4.0 band (results.ts:91): without the rating
    // condition the 4.1, 4.3 and 4.4 cards stay in.
    const banded = await readList(read, { handle: packet.extraction, fields: { title: keys.title, store: keys.store, rating: keys.rating }, where: [{ field: keys.ad, is: "absent" }], paginate: false, minItems: 0 });
    expect(banded.rows, "the filter's band keeps the 4.1/4.3/4.4 near-misses").toHaveLength(16);

    // "rated 4.5 stars or higher" over the rating the card writes, which every
    // narrowed card has; the star-fill width is never offered as a column
    // (infer-fields.ts reads only `data-*` attributes off the item).
    const kept = await readList(read, {
      handle: packet.extraction,
      fields: { title: keys.title, store: keys.store, rating: keys.rating },
      where: [{ field: keys.ad, is: "absent" }, { field: "rating", atLeast: 4.5 }],
      paginate: false,
      minItems: 13
    });
    expect(kept.reply.status, JSON.stringify(kept.reply.validation)).toBe("succeeded");
    expect(answer(kept.rows), "#2 and #5 share a title and stay two rows: their stores differ").toEqual(expectedWithout("price"));
    // The saved request carries its conditions resolved into column reads.
    expect(kept.request.where?.map((condition) => ({ is: condition.is, atLeast: condition.atLeast, read: typeof condition.read }))).toEqual([
      { is: "absent", atLeast: undefined, read: "object" },
      { is: undefined, atLeast: 4.5, read: "object" }
    ]);
  });

  test("the four-column answer equals spainHubRecords(): the price as the results write it (16,49 €)", async ({ openHarness }) => {
    test.fail(true, "G1: the price is drawn in four sibling spans and no detected column holds it whole (content/extraction/infer-fields.ts:385)");
    test.setTimeout(180_000);
    const harness = await openHarness(SCENARIO);
    await walkFilteredRoute(harness);
    await firstCardsDrawn(harness.page);
    const read = reader(harness, []);
    const packet = await detect(read);
    const rows = await readEveryColumn(read, packet);
    const keys = instructionColumns(rows, packet);
    const price = priceColumn(rows, packet);
    expect(price.key, "some detected column could be taken for the price").toBeTruthy();
    const kept = await readList(read, {
      handle: packet.extraction,
      fields: { title: keys.title, store: keys.store, price: price.key!, rating: keys.rating },
      where: [{ field: keys.ad, is: "absent" }, { field: "rating", atLeast: 4.5 }],
      paginate: false,
      minItems: 0
    });
    expect.soft(price.asWritten, "GAP G1: no detected column holds the price as the card writes it. The card draws it in four sibling spans, and infer-fields.ts:385 offers only text leaves, so the proposal has its pieces (\"16\", \",49\", \"€\") and the one column labelled (currency amount) is the struck-through original price").toBe(true);
    expect(answer(kept.rows)).toEqual(EXPECTED);
  });
});

test.describe("crossborder-marketplace-spain-hubs, every page of the unfiltered search", () => {
  /** Search, detect on page 1, find the columns, and resolve the instruction's conditions into the literal request a Flow saves (this page only). */
  async function unfilteredPageOne(harness: ContentHarness, checkpoints: Checkpoint[]): Promise<{ read: Reader; packet: StructurePacket; request: WebAutomationExtractListRequest; pageOne: Row[] }> {
    await arriveAndSearch(harness);
    await declineNotifications(harness);
    await firstCardsDrawn(harness.page);
    const read = reader(harness, checkpoints);
    const packet = await detect(read);
    const rows = await readEveryColumn(read, packet);
    const keys = instructionColumns(rows, packet);
    const origin = columnHolding(rows, packet, "Ships from Spain");
    const shipping = columnHolding(rows, packet, "Free shipping");
    expect(origin, "one column holds the origin badge").toHaveLength(1);
    expect(shipping, "one column holds the shipping note").toHaveLength(1);
    const pageOne = await readList(read, {
      handle: packet.extraction,
      fields: { title: keys.title, store: keys.store, rating: keys.rating },
      where: [
        { field: keys.ad, is: "absent" },
        { field: origin[0]!, equals: "Ships from Spain" },
        { field: shipping[0]!, equals: "Free shipping" },
        { field: "rating", atLeast: 4.5 }
      ],
      paginate: false,
      minItems: 0
    });
    return { read, packet, request: pageOne.request, pageOne: pageOne.rows };
  }

  test("page 1 read by the instruction's conditions alone (no filters) keeps exactly the thirteen's page-1 rows, ads and near-misses out", async ({ openHarness }) => {
    test.setTimeout(180_000);
    const harness = await openHarness(SCENARIO);
    const { pageOne } = await unfilteredPageOne(harness, []);
    // Page 1 holds organic results 1-17 of Best Match (results.ts:29-32), six
    // of which are among the thirteen (listings.ts:49-65; #7 is the 18th).
    expect(pageOne.length, "page 1 holds the first six of the thirteen").toBe(6);
    expect(answer(pageOne)).toEqual(expectedWithout("price").slice(0, 6));
  });

  test("the detection proposes the numbered pager (links 1-3), not the dead Next div", async ({ openHarness }) => {
    test.fail(true, "G4: the numbered pager is not detected (content/extraction/detect-pagination.ts:98,110-123; item-selector.ts:90)");
    test.setTimeout(180_000);
    const harness = await openHarness(SCENARIO);
    await arriveAndSearch(harness);
    await declineNotifications(harness);
    await firstCardsDrawn(harness.page);
    const packet = await detect(reader(harness, []));
    expect(packet.pagination, "GAP G4: the pager's current page \"1\" carries one more class than \"2\" and \"3\", so detect-pagination.ts:110-123 splits the digits into two templates, and detect-pagination.ts:98 asks for `<ancestor> > a...` though the links sit inside the pager div, with item-selector.ts:90 taking the first control's classes rather than the shared ones: no candidate names the run and the list is proposed as one page").toBe("numbered_pages");
  });

  test("named as a fixed detection would name it, the pager is read across three documents, the person passing the traffic screen, each of the thirteen once", async ({ openHarness }) => {
    test.fail(true, "G5: with no aria-current the page control is picked by position, and from page 2 Previous shares the number links' class (content/extraction/pagination.ts:525-527)");
    test.setTimeout(240_000);
    const harness = await openHarness(SCENARIO);
    const checkpoints = await catchCheckpoints(harness.page);
    const { request } = await unfilteredPageOne(harness, checkpoints);
    // Every numbered link of the pager: on page 1 that is "1", "2", "3"; from
    // page 2 on it is "‹ Previous", "1", "2", "3", because Previous becomes a
    // link of the same template. No class here is read off the page by the
    // product; it is the selector the proposed G4 fix would emit.
    const c = marketClasses(MARKET_SEED, "baseline");
    const pages = `.${c.pager} > a.${c.pagerItem}`;
    const action: BrowserActionCommand = {
      commandId: nextId("numbered"),
      actionType: "web.dom.extract_list",
      timeoutMs: 90_000,
      extractList: { ...request, paginate: { mode: "numbered", pages, maxPages: 3 } }
    };
    const reply = await acrossDocuments(harness, action, checkpoints);
    const trail = { checkpoints: checkpoints.map((checkpoint) => ({ pagesRead: checkpoint.pagesRead, records: checkpoint.records.length })), extraction: reply.extraction, endedOn: harness.page.url() };
    expect(reply.status, JSON.stringify(reply.validation)).toBe("succeeded");
    expect(reply.extraction?.pagesRead, JSON.stringify(trail)).toBe(3);
    expect(new URL(harness.page.url()).searchParams.get("page"), `GAP G5: the read ends on a page other than 3: ${JSON.stringify(trail)}. With no aria-current, pagination.ts:525-527 takes the control at index pagesRead, which from page 2 on -- Previous now a link of the same template -- is the link to the page being read, so "page 3" is page 2 again`).toBe("3");
    // Pages 2 and 3 open repeating #6 and #11 (results.ts:63): read once each.
    expect(answer((reply.extracted ?? []) as Row[])).toEqual(expectedWithout("price"));
  });
});

test.describe("crossborder-marketplace-spain-hubs-list-layout, the Flow built on the grid read on the list", () => {
  test("the literal request the grid build saved reads the thirteen on the list layout armed after the build", async ({ openHarness }) => {
    test.fail(true, "G2: detected field paths are anchored through the card body by position (content/extraction/infer-fields.ts:486-566)");
    test.setTimeout(240_000);
    const harness = await openHarness(SCENARIO);
    await walkFilteredRoute(harness);
    await firstCardsDrawn(harness.page);
    const read = reader(harness, []);
    const packet = await detect(read);
    const rows = await readEveryColumn(read, packet);
    const keys = instructionColumns(rows, packet);
    const saved = await readList(read, {
      handle: packet.extraction,
      fields: { title: keys.title, store: keys.store, rating: keys.rating },
      where: [{ field: keys.ad, is: "absent" }, { field: "rating", atLeast: 4.5 }],
      paginate: false,
      minItems: 13
    });
    expect(answer(saved.rows), "the grid build reads the thirteen").toEqual(expectedWithout("price"));

    // The variant is armed after the build (`live-tasks.ts:51`), which starts
    // the visit over; playback walks the same nodes and replays the saved
    // literal request -- no handle, no detection.
    const armed = await fetch(`${harness.lab.origin}/api/${SCENARIO}/set-mode`, {
      method: "POST",
      headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
      body: JSON.stringify({ mode: "list-layout" })
    });
    expect(armed.ok).toBe(true);
    await harness.page.goto(harness.url);
    await contentReady(harness.page);
    await walkFilteredRoute(harness);
    const replay = await run(harness, { actionType: "web.dom.extract_list", timeoutMs: 30_000, extractList: saved.request }, "replay");
    expect(replay.status, `GAP G2 if failed: ${JSON.stringify(replay.validation)}`).toBe("succeeded");
    expect(answer((replay.extracted ?? []) as Row[]), "GAP G2: the saved field paths name the card's children by their place under the card body (infer-fields.ts:516-566), and the list layout moves price and store into an aside and the rating row up a place").toEqual(expectedWithout("price"));
  });

  test("fix proof (G1+G2): fields named by the element's own class anywhere in the card read all four columns on the grid and on the list layout", async ({ openHarness }) => {
    test.setTimeout(240_000);
    const harness = await openHarness(SCENARIO);
    await walkFilteredRoute(harness);
    await firstCardsDrawn(harness.page);
    // What detection would emit with both fixes: the price div whose four
    // spans together state a currency amount (G1), and every field anchored by
    // the one element in the card that carries its class rather than by its
    // path under the card body (G2). The class names are the build's own; the
    // item selector is the one the grid build detected.
    const c = marketClasses(MARKET_SEED, "baseline");
    const read = reader(harness, []);
    await detect(read);
    const detectedItem = (read.dispatched.find((entry) => entry.reply.structure !== undefined)?.reply.structure as { proposal: { item: string } }).proposal.item;
    const request: WebAutomationExtractListRequest = {
      item: detectedItem,
      fields: {
        title: { kind: "text", selector: `:scope div.${c.cardTitle}`, required: true },
        store: { kind: "text", selector: `:scope div.${c.storeName}`, required: true },
        price: { kind: "text", selector: `:scope div.${c.price}`, required: true },
        rating: { kind: "text", selector: `:scope span.${c.ratingValue}`, required: false }
      },
      where: [{ read: { kind: "text", selector: `:scope span.${c.adTag}` }, is: "absent" }, { field: "rating", atLeast: 4.5 }],
      minItems: 13
    };
    const onGrid = await run(harness, { actionType: "web.dom.extract_list", timeoutMs: 30_000, extractList: request }, "grid");
    expect(onGrid.status, JSON.stringify(onGrid.validation)).toBe("succeeded");
    expect(answer((onGrid.extracted ?? []) as Row[]), "the grid").toEqual(EXPECTED);

    const armed = await fetch(`${harness.lab.origin}/api/${SCENARIO}/set-mode`, {
      method: "POST",
      headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
      body: JSON.stringify({ mode: "list-layout" })
    });
    expect(armed.ok).toBe(true);
    await harness.page.goto(harness.url);
    await contentReady(harness.page);
    await walkFilteredRoute(harness);
    const onList = await run(harness, { actionType: "web.dom.extract_list", timeoutMs: 30_000, extractList: request }, "list");
    expect(onList.status, JSON.stringify(onList.validation)).toBe("succeeded");
    expect(answer((onList.extracted ?? []) as Row[]), "the list layout").toEqual(EXPECTED);
  });
});
