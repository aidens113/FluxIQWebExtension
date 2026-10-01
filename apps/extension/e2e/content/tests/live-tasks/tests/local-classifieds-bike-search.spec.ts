// Live task `local-classifieds-bike-search`, with no Lab and no model: can the
// product's own browser actions and list read produce the task's expected
// dataset from the real scenario site (task t194, brief w24)?
//
// Every step a Flow would take is the content script's own action, aimed the
// way a model's handle is aimed: the snapshot's descriptor for the control, its
// selector and identity, and the shadow host chain the binding keeps beside it
// (domain `plan-resolution/element-identity.ts`). `page.*` only waits and
// observes. The answer is the scenario's own (`bikeRecords()`), never copied.
//
// What the rows found on 2026-10-01 (report
// `docs/working/language-driven-flow-loop-plan/reports/t194-w24-bikes-fixture.md`):
//
// - The chain works -- cookie wall, category link, the timed notification, the
//   radius picker's select and its double Apply inside the shadow root, the
//   price boxes with Enter, the folded condition boxes, the scripted sort and
//   the robot pause it trips -- except one press: a click on the picker's chip
//   opens the panel and then closes it again, because the ignored-press watch
//   cannot see a change inside a shadow root and presses a second time
//   (`content/action-runtime/ignored-press/page-press-listener.ts`). The chain
//   below falls back to Enter on the chip so the rest can be measured.
// - Every read stops at 9 of 12 rows: the third batch fails once, the feed puts
//   a bare-span "Try again" under it, and neither the one-page read's reveal
//   (`content/extraction/list-wait.ts`) nor a scroll-paged read
//   (`content/extraction/pagination.ts`) ever presses it; `load-retry.ts` would
//   not count a bare focusable span as pressable either.
// - Once that batch is retried, the detected proposal plus the instruction's
//   conditions reads exactly the answer: adverts out, the batch repeat once,
//   "Results outside your search" left out, the current price and not the
//   struck one.
//
// A row marked `test.fail` asserts the correct answer and fails for its named
// gap; once the gap's fix lands it passes unexpectedly and the marker comes off.

import type { JsonObject } from "fluxiq/core";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_RUN_NODE_TOOL_ID,
  type WebLlmEvidenceGateway
} from "@fluxiq-web-extension/domain";
import type { WebAutomationExtractListRequest } from "@fluxiq-web-extension/domain/client";
import { bikeRecords } from "../../../../../../scenario-lab/src/scenarios/local-classifieds/index.js";
import type { BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

type ActionCommand = Parameters<ContentHarness["runAction"]>[0];
type Descriptor = Awaited<ReturnType<ContentHarness["capture"]>>["interactiveElements"][number];
type Row = Record<string, unknown>;
type StructurePacket = { extraction: string; itemCount: number; pagination: string; fields: Array<{ key: string; label: string; kind: string; coverage: number }> };
type Dispatched = { actionType: string; parameters: JsonObject; reply: BrowserActionResult };

const RESULTS = 'section[aria-label="Collection of Marketplace items"]';
/** The node the model runs to read a list, as the catalog names it. */
const EXTRACT_LIST_NODE = "web.output.dom-extract_list";
const BASE = { projectId: "project.bike-search", flowId: "flow.bike-search", maxEvidenceBytes: 24_000 } as const;
const PICKER = "kf-location";

/**
 * The manifest's own read of the grid (`manifest.ts` BIKE_FIELDS and the
 * `extract-bike-results` target), restated because the manifest does not export
 * it: the listing links only, so no advert, and only the first grid of the
 * results section, so nothing from "Results outside your search".
 */
const LITERAL_READ: WebAutomationExtractListRequest = {
  item: `${RESULTS} > div:first-child a[href*="/item/"]`,
  fields: { title: "div:nth-of-type(3) > span", price: "div:nth-of-type(2) > span:first-child", location: "div:nth-of-type(4) > span", url: "@href" },
  dedupe: { by: ["url"] },
  minItems: 0
};

let commands = 0;

/**
 * The snapshot descriptor a model would be shown for `name`, narrowed by
 * `accept`: the element whose accessible name it is, or, for a control the page
 * gave no name, such as the feed's bare-span "Try again", the one whose text it is.
 */
async function described(harness: ContentHarness, name: string, accept: (element: Descriptor) => boolean = () => true): Promise<Descriptor> {
  const elements = (await harness.capture()).interactiveElements.filter(accept);
  const found = elements.find((element) => element.accessibleName?.trim() === name)
    ?? elements.find((element) => element.accessibleName === undefined && element.visibleText?.trim() === name);
  if (!found) throw new Error(`The snapshot shows no element named ${JSON.stringify(name)}.`);
  return found;
}

/** The command a model's handle on `element` becomes, as `webPlanElementIdentity` builds its identity. */
function handleCommand(element: Descriptor, actionType: ActionCommand["actionType"], extra: Partial<ActionCommand> = {}): ActionCommand {
  const hosts = element.context?.shadowHosts;
  return {
    commandId: `bike-search.${++commands}`,
    actionType,
    selector: element.selector,
    element: {
      tagName: element.tagName,
      selector: element.selector,
      ...(element.role ? { role: element.role } : {}),
      ...(element.accessibleName ? { accessibleName: element.accessibleName } : {}),
      ...(element.visibleText ? { visibleText: element.visibleText } : {}),
      ...(hosts?.length ? { context: { shadowHosts: [...hosts] } } : {})
    },
    ...extra
  } as ActionCommand;
}

/** Runs one action on the control named `name` and requires it to succeed. */
async function act(harness: ContentHarness, name: string, actionType: ActionCommand["actionType"], extra: Partial<ActionCommand> = {}, accept?: (element: Descriptor) => boolean): Promise<BrowserActionResult> {
  const reply = await harness.runAction(handleCommand(await described(harness, name, accept), actionType, extra));
  expect(reply.status, `${actionType} on ${name}: ${reply.message ?? ""} ${JSON.stringify(reply.validation)}`).toBe("succeeded");
  return reply;
}

async function pickerOpen(harness: ContentHarness): Promise<boolean> {
  return await harness.page.locator(PICKER).getByRole("dialog").isVisible();
}

/** Answers the cookie wall, opens Bicycles, and answers the notification prompt the page puts up on a timer. */
async function openBicycles(harness: ContentHarness): Promise<void> {
  await act(harness, "Allow all cookies", "web.dom.click");
  await act(harness, "Bicycles", "web.dom.click", {}, (element) => element.tagName === "a");
  await harness.page.waitForURL(/\/category\/bicycles\//u);
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady"), { message: "the content script announced itself on the category page" }).toBe(true);
  await harness.page.getByRole("button", { name: "Not now" }).waitFor({ timeout: 8_000 });
  await act(harness, "Not now", "web.dom.click");
}

/**
 * Walks the Stage 1 node chain up to the read. The chip is clicked as a model
 * would; when the click leaves the panel shut (the ignored-press gap the first
 * row measures), Enter on the same handle opens it, so the rest of the chain
 * can be measured.
 */
async function searchBikes(harness: ContentHarness): Promise<void> {
  await openBicycles(harness);
  await act(harness, "Kelford · Within 20 mi", "web.dom.click");
  if (!(await pickerOpen(harness))) await act(harness, "Kelford · Within 20 mi", "web.dom.keypress", { key: "Enter" });
  expect(await pickerOpen(harness), "the radius panel is open").toBe(true);
  await act(harness, "Radius", "web.dom.select", { value: "10" }, (element) => element.tagName === "select");
  // The widget's Apply swallows its first press after the select changes.
  await act(harness, "Apply", "web.dom.click");
  if (await pickerOpen(harness)) await act(harness, "Apply", "web.dom.click");
  await harness.page.locator(PICKER).getByText("Kelford · Within 10 mi").waitFor({ timeout: 4_000 });

  await act(harness, "Min", "web.dom.type", { text: "100" }, (element) => element.tagName === "input");
  await act(harness, "Min", "web.dom.keypress", { key: "Enter" }, (element) => element.tagName === "input");
  await act(harness, "Max", "web.dom.type", { text: "400" }, (element) => element.tagName === "input");
  await act(harness, "Max", "web.dom.keypress", { key: "Enter" }, (element) => element.tagName === "input");
  // The snapshot names the folded heading with its arrow glyph: that is what a model is shown.
  await act(harness, "Item condition▾", "web.dom.click");
  for (const condition of ["New", "Used – like new", "Used – good"]) {
    await act(harness, condition, "web.dom.check", { checked: true }, (element) => element.tagName === "input");
  }
  await act(harness, "Sort by", "web.dom.click");
  await act(harness, "Price: lowest first", "web.dom.click");

  // Observed, not acted on: the filters are in the address and the cheapest bike leads the feed.
  await expect.poll(() => new URL(harness.page.url()).searchParams.get("sortBy"), { timeout: 10_000 }).toBe("price_ascend");
  const query = new URL(harness.page.url()).searchParams;
  expect(Object.fromEntries(query)).toMatchObject({ radius: "10", minPrice: "100", maxPrice: "400", itemCondition: "new,used_like_new,used_good", sortBy: "price_ascend" });
  const first = bikeRecords()[0]?.url ?? "";
  await expect.poll(() => harness.page.evaluate((results) => document.querySelector(`${results} a[href*="/item/"]`)?.getAttribute("href"), RESULTS), { timeout: 15_000 }).toBe(first);
}

/** The domain's evidence runtime over the harness, with every dispatched action kept. */
function evidenceRuntime(harness: ContentHarness, dispatched: Dispatched[]) {
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.live-browser"],
    structureDetectionSessionIds: () => ["session.live-browser"],
    executeAction: async (_sessionId, request) => {
      const reply = await harness.runAction({ commandId: `bike-search.runtime.${++commands}`, actionType: request.actionType, ...request.parameters } as ActionCommand);
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

/**
 * The read a model writes from the detected structure and the instruction:
 * the four columns it asked for, under its own names, picked by the field's
 * place in the card (title third, place fourth, the price the detection marked
 * a currency amount on every card), "leave out sponsored posts" as a condition
 * the sponsored cards fail -- they carry no title in the listing's place -- and
 * "list each bike once" as a dedupe on the link.
 */
async function readFromProposal(harness: ContentHarness): Promise<{ packet: StructurePacket; request: WebAutomationExtractListRequest; reply: BrowserActionResult }> {
  const dispatched: Dispatched[] = [];
  const runtime = evidenceRuntime(harness, dispatched);
  const detected = await runtime.executeTool({ ...BASE, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  expect(detected.resultCode, JSON.stringify(detected.evidence)).toBe("web.structure.detected");
  const packet = detected.evidence as unknown as StructurePacket;
  const field = (what: string, test: (field: StructurePacket["fields"][number]) => boolean): string => {
    const found = packet.fields.find(test);
    expect(found, `the detection proposes a ${what} column: ${packet.fields.map((entry) => `${entry.label} (${entry.coverage})`).join(" | ")}`).toBeTruthy();
    return found?.key ?? "";
  };
  const fields = {
    title: field("title", (entry) => / > div:3 > span\./u.test(entry.label) && entry.coverage < 1 && entry.coverage > 0.5),
    price: field("price", (entry) => entry.label.endsWith("(currency amount)") && entry.coverage === 1),
    location: field("location", (entry) => / > div:4 > span\./u.test(entry.label) && entry.coverage > 0.5),
    url: field("url", (entry) => entry.kind === "link")
  };
  const read = await runtime.executeTool({
    ...BASE,
    callId: "call.read",
    toolId: WEB_LLM_RUN_NODE_TOOL_ID,
    value: { node: EXTRACT_LIST_NODE, parameters: { extractList: { handle: packet.extraction, fields, where: [{ field: "title", is: "present" }], dedupe: { by: ["url"] } } }, consequences: [] }
  });
  expect(read.resultCode, JSON.stringify(read.evidence).slice(0, 2_000)).toBe("web.inspect.succeeded");
  const sent = dispatched.filter((entry) => entry.actionType === "web.dom.extract_list").at(-1);
  if (!sent) throw new Error("The runtime dispatched no web.dom.extract_list.");
  return { packet, request: sent.parameters.extractList as unknown as WebAutomationExtractListRequest, reply: sent.reply };
}

/** The rows with each link as the address's path: the judge matches an absolute link on the run's origin to the answer's path (`value-match.ts`). */
function withPaths(rows: readonly Row[], origin: string): Row[] {
  return rows.map((row) => ({ ...row, url: typeof row.url === "string" && row.url.startsWith(origin) ? row.url.slice(origin.length) : row.url }));
}

test.describe.configure({ timeout: 180_000 });

test("the radius chip inside the picker's shadow root opens with one click", async ({ openHarness }) => {
  test.fail(true, "GAP 1: the ignored-press watch cannot see a change inside a shadow root and presses again (content/action-runtime/ignored-press/page-press-listener.ts:94)");
  const harness = await openHarness("local-classifieds");
  await openBicycles(harness);
  const reply = await act(harness, "Kelford · Within 20 mi", "web.dom.click");
  // GAP 1: the press opens the panel; the ignored-press watch sees no change
  // because the change is inside the widget's shadow root, and presses again,
  // which closes it. The result says "pressed once more".
  expect(JSON.stringify(reply.validation), "the click was made once").not.toContain("pressed once more");
  expect(await pickerOpen(harness), "the radius panel is open after one click").toBe(true);
});

test("the product's own actions walk the chain to the filtered, cheapest-first results", async ({ openHarness }) => {
  const harness = await openHarness("local-classifieds");
  await searchBikes(harness);
  // The first batch as served, its advert drawn from the listing card among the listings.
  const hrefs = await harness.page.evaluate((results) => Array.from(document.querySelectorAll(`${results} > div:first-child a`)).map((link) => link.getAttribute("href") ?? ""), RESULTS);
  expect(hrefs.length, "at least the first batch of six").toBeGreaterThanOrEqual(6);
  expect(hrefs.filter((href) => href.includes("/ad/")).length, "an advert is drawn from the listing card").toBeGreaterThan(0);
});

test("a literal read of the results returns the twelve bikes", async ({ openHarness }) => {
  test.fail(true, "GAP 2: no read presses the failed batch's bare-span Try again (content/extraction/list-wait.ts:109-119, load-retry.ts:37)");
  const harness = await openHarness("local-classifieds");
  await searchBikes(harness);
  const reply = await harness.runAction({ commandId: "bike-search.literal", actionType: "web.dom.extract_list", timeoutMs: 60_000, extractList: LITERAL_READ });
  expect(reply.status, JSON.stringify(reply.validation)).toBe("succeeded");
  // GAP 2: the third batch fails once and waits on a bare-span "Try again"
  // that the read's reveal never presses, so the read ends at 9 rows.
  expect(reply.extracted, `read ${reply.extraction?.recordCount} rows; "Try again" on the page: ${await harness.page.getByText("Try again").count()}`).toEqual(bikeRecords());
});

test("a literal read that pages by scrolling returns the twelve bikes", async ({ openHarness }) => {
  test.fail(true, "GAP 2: scrollForMore stops scrolled_to_end at the failed batch (content/extraction/pagination.ts:448-461)");
  const harness = await openHarness("local-classifieds");
  await searchBikes(harness);
  const reply = await harness.runAction({
    commandId: "bike-search.scroll",
    actionType: "web.dom.extract_list",
    timeoutMs: 60_000,
    extractList: { ...LITERAL_READ, paginate: { mode: "scroll", maxScrolls: 10 } }
  });
  expect(reply.status, JSON.stringify(reply.validation)).toBe("succeeded");
  // GAP 2, scroll mode: `scrollForMore` stops as `scrolled_to_end` at the failed batch.
  expect(reply.extracted, `read ${reply.extraction?.recordCount} rows, stop ${reply.extraction?.paginationStop}`).toEqual(bikeRecords());
});

test("the detected proposal and the instruction's conditions read the twelve bikes through the evidence runtime", async ({ openHarness }) => {
  test.fail(true, "GAP 2: the one-page reveal stops at the failed batch (content/extraction/list-wait.ts:109-119)");
  const harness = await openHarness("local-classifieds");
  await searchBikes(harness);
  const { packet, request, reply } = await readFromProposal(harness);
  // What the detection offers a model for an infinite feed: no pagination,
  // and the items of the real results' grid only.
  expect(packet.pagination).toBe("none");
  expect(request.item, "the proposed item is in the first grid, the real results").toMatch(/^main > section > div:nth-of-type\(1\) > /u);
  expect(request.paginate).toBeUndefined();
  expect(reply.status, JSON.stringify(reply.validation)).toBe("succeeded");
  // GAP 2 again: the one-page reveal stops at the failed batch.
  expect(withPaths((reply.extracted ?? []) as Row[], harness.lab.origin), `read ${reply.extraction?.recordCount} rows`).toEqual(bikeRecords());
});

test("once the failed batch is retried, the proposal's read is exactly the answer", async ({ openHarness }) => {
  const harness = await openHarness("local-classifieds");
  await searchBikes(harness);
  const page = harness.page;
  // Bring the feed to its failed batch, then press its "Try again" as a model
  // shown it in the snapshot would: a bare span, named by its text only.
  const retry = page.getByText("Try again", { exact: true });
  for (let scroll = 0; scroll < 6 && !(await retry.isVisible()); scroll += 1) {
    await harness.runAction({ commandId: `bike-search.scroll.${scroll}`, actionType: "web.dom.scroll", scroll: { mode: "by", y: 2_500 } });
    await page.waitForTimeout(1_200);
  }
  await expect(retry, "the third batch failed and offered Try again").toBeVisible();
  const offered = await described(harness, "Try again");
  expect(offered.tagName, "the retry is a bare span with no role").toBe("span");
  expect(offered.role).toBeUndefined();
  await harness.runAction(handleCommand(offered, "web.dom.click"));

  const { reply } = await readFromProposal(harness);
  expect(reply.status, JSON.stringify(reply.validation)).toBe("succeeded");
  const rows = withPaths((reply.extracted ?? []) as Row[], harness.lab.origin);
  expect(rows).toEqual(bikeRecords());

  // The traps, each observed on the page the read ran on.
  await expect(page.getByText("Results outside your search"), "the feed ended in the outside results").toBeVisible();
  const outside = await page.evaluate((results) => Array.from(document.querySelectorAll(`${results} > div:not(:first-child) a[href*="/item/"]`)).map((link) => link.getAttribute("href") ?? ""), RESULTS);
  expect(outside.length, "outside listings are on the page").toBeGreaterThan(0);
  expect(rows.some((row) => outside.includes(String(row.url))), "no outside listing was read").toBe(false);
  const shown = await page.evaluate((results) => Array.from(document.querySelectorAll(`${results} > div:first-child a`)).map((link) => link.getAttribute("href") ?? ""), RESULTS);
  expect(shown.filter((href) => href.includes("/ad/")).length, "two adverts are on the page").toBe(2);
  expect(shown.length - new Set(shown).size, "one listing is on the page twice").toBe(1);
  const ridgeline = rows.find((row) => String(row.title).startsWith("Ridgeline"));
  expect(ridgeline?.price, "the current price, not the struck-through was").toBe("£240");
});
