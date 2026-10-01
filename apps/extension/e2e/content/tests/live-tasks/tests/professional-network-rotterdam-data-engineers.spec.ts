// Can the product read the live task `professional-network-rotterdam-data-engineers`
// from the real scenario site, with no Lab and no model? (t194-w27)
//
// The task's expected dataset is `peopleRecords(ROTTERDAM_ENGINEERS)`: 23 people
// over three pages. These rows walk the whole node chain a correct Flow has
// (report `t194-w18-stage1-four-tasks.md`, "Stage 1 --
// professional-network-rotterdam-data-engineers") with the content script's own
// verbs, against targets the content script's own snapshot names, and then read
// the list two ways: with the request the scenario's recording uses, and with
// only what `web.dom.capture_snapshot` + `detectStructure` proposes, resolved
// through the domain's evidence runtime with the decisions scripted rather than
// asked of a model.
//
// `page.*` only waits or observes. Every press, keystroke, check and read is a
// `harness.runAction`. A press that loads a new document destroys the page
// script the harness talks to, so its reply can be lost: `actAndLoad` says
// when it was, and waits for the content script to announce itself in the new
// document (the harness's init script re-injects it into every document).
//
// The two gaps these rows traced (report `t194-w27-rotterdam-fixture.md`) are
// fixed, and no row is marked `test.fail`: G1, a script Next that leads back to
// its own page, is swapped for the pager's next number (t194-w30); G2, a plan's
// page bound dropped when its mode is not the detected one, is kept (t194-w32).

import type { Page } from "@playwright/test";
import type { JsonObject, JsonValue } from "fluxiq/core";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_RUN_NODE_TOOL_ID,
  type WebLlmEvidenceGateway
} from "@fluxiq-web-extension/domain";
import type { WebAutomationStructureDetection } from "@fluxiq-web-extension/domain/client";
import { peopleRecords, ROTTERDAM_ENGINEERS, ROTTERDAM_NL } from "../../../../../../scenario-lab/src/scenarios/professional-network/index.js";
import type { BrowserActionCommand, BrowserActionResult, DomElementDescriptor } from "../../../../../src/shared/protocol.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

const EXPECTED = peopleRecords(ROTTERDAM_ENGINEERS);
const ORGANIC = 'li[data-urn^="urn:gl:member:"]';
const EXTRACT_LIST_NODE = "web.output.dom-extract_list";
const BASE = { projectId: "project.w27", flowId: "flow.w27", maxEvidenceBytes: 24_000 } as const;
const FILTERED_PATH = `/scenarios/professional-network/search/results/people/?keywords=${encodeURIComponent(ROTTERDAM_ENGINEERS.keywords)}&network=${encodeURIComponent('["S"]')}&geoUrn=${encodeURIComponent(JSON.stringify([ROTTERDAM_NL]))}&origin=FACETED_SEARCH`;

type Row = Record<string, unknown>;
type Detected = Extract<WebAutomationStructureDetection, { ok: true }>;
type StructurePacket = { extraction: string; itemCount: number; pagination: string; fields: Array<{ key: string; label: string; kind: string; coverage: number }> };

let commandCount = 0;

function log(line: string, value?: unknown): void {
  console.log(`[w27] ${line}${value === undefined ? "" : ` ${JSON.stringify(value)}`}`);
}

/** What a reply says, short enough to read in the list reporter. */
function summary(reply: BrowserActionResult | undefined): unknown {
  if (!reply) return "reply lost to the document load";
  return { status: reply.status, message: reply.message, validation: reply.validation, failure: reply.failure?.code };
}

async function run(harness: ContentHarness, command: Omit<BrowserActionCommand, "commandId">): Promise<BrowserActionResult> {
  return await harness.runAction({ commandId: `w27.${++commandCount}`, timeoutMs: 15_000, ...command } as BrowserActionCommand);
}

/** The content script's own snapshot of the page: the elements a Flow can name. */
async function elements(harness: ContentHarness): Promise<DomElementDescriptor[]> {
  return (await harness.capture()).interactiveElements;
}

const textOf = (element: DomElementDescriptor): string => (element.visibleText ?? element.text ?? "").trim();
const nameOf = (element: DomElementDescriptor): string => (element.accessibleName ?? element.label ?? "").trim();
const shown = (element: DomElementDescriptor): boolean => element.bounds !== undefined && element.bounds.width > 0 && element.bounds.height > 0;

/** The one rendered element the snapshot lists that `matches`; fails naming what it did list when there is not exactly one. */
async function snapshotTarget(harness: ContentHarness, what: string, matches: (element: DomElementDescriptor) => boolean): Promise<DomElementDescriptor> {
  const all = await elements(harness);
  const found = all.filter((element) => shown(element) && matches(element));
  if (found.length !== 1) {
    const listed = all.filter(shown).map((element) => `${element.tagName}:${textOf(element).slice(0, 40)}|${nameOf(element).slice(0, 40)}`);
    const matched = found.map((element) => `${element.tagName}@${element.selector}`);
    throw new Error(`The snapshot lists ${found.length} rendered elements for ${what}: ${matched.join(" ; ")}. It listed: ${listed.join(" ; ")}`);
  }
  log(`target ${what}`, { selector: found[0]!.selector, tag: found[0]!.tagName, text: textOf(found[0]!), name: nameOf(found[0]!), hasClickHandler: found[0]!.hasClickHandler });
  return found[0]!;
}

async function contentReady(page: Page): Promise<void> {
  await expect.poll(async () => await page.evaluate(() => {
    const stub = (window as unknown as Record<string, { sent: Array<{ type?: string }> } | undefined>).__fluxiqContentHarness;
    return stub?.sent.some((message) => message.type === "fluxiq.contentReady") ?? false;
  }).catch(() => false), { timeout: 15_000 }).toBe(true);
}

/**
 * Runs a press that loads a new document and waits for the content script in
 * it. The reply is returned when the old document answered before it died, and
 * `undefined` when the load destroyed the page script first.
 */
async function actAndLoad(harness: ContentHarness, command: Omit<BrowserActionCommand, "commandId">, landsOn: RegExp): Promise<BrowserActionResult | undefined> {
  let reply: BrowserActionResult | undefined;
  try {
    reply = await run(harness, command);
  } catch (error) {
    if (!/destroyed|navigat|closed|Target page/iu.test(String(error))) throw error;
    reply = undefined;
  }
  log(`${command.actionType} -> ${landsOn}`, summary(reply));
  await harness.page.waitForURL(landsOn, { timeout: 15_000 });
  await harness.page.waitForLoadState("load");
  await contentReady(harness.page);
  return reply;
}

async function act(harness: ContentHarness, command: Omit<BrowserActionCommand, "commandId">, what: string): Promise<BrowserActionResult> {
  const reply = await run(harness, command);
  log(`${command.actionType} ${what}`, summary(reply));
  return reply;
}

/** The feed's three arrivals, answered in the order the manifest's ARRIVE does, each through the snapshot and a click. */
async function answerArrivals(harness: ContentHarness): Promise<void> {
  const page = harness.page;
  await page.locator('div:text-is("Not now")').waitFor({ state: "visible", timeout: 15_000 });
  const notNow = await snapshotTarget(harness, '"Not now"', (element) => textOf(element) === "Not now");
  expect((await act(harness, { actionType: "web.dom.click", selector: notNow.selector }, '"Not now"')).status).toBe("succeeded");
  await page.getByRole("button", { name: "Close your conversation with Priya Nair" }).waitFor({ state: "visible", timeout: 15_000 });
  const close = await snapshotTarget(harness, "the conversation close", (element) => element.tagName.toLowerCase() === "button" && (nameOf(element) === "Close your conversation with Priya Nair" || textOf(element) === "Close your conversation with Priya Nair"));
  expect((await act(harness, { actionType: "web.dom.click", selector: close.selector }, "conversation close")).status).toBe("succeeded");
  // Not a result card's own "Accept" (a received invitation): the banner is in no list.
  const accept = await snapshotTarget(harness, "cookie Accept", (element) => element.tagName.toLowerCase() === "button" && textOf(element) === "Accept" && !element.selector.includes(" > li"));
  expect((await act(harness, { actionType: "web.dom.click", selector: accept.selector }, "cookie Accept")).status).toBe("succeeded");
  await expect(page.getByText("Guildline and 3rd parties use essential", { exact: false })).toHaveCount(0);
}

/** A filter pill: a styled block with a tab stop and a click handler, not a button. */
async function openPill(harness: ContentHarness, label: string): Promise<void> {
  const pill = await snapshotTarget(harness, `the ${label} pill`, (element) => textOf(element) === `${label} ▾`);
  expect((await act(harness, { actionType: "web.dom.click", selector: pill.selector }, `${label} ▾`)).status).toBe("succeeded");
}

/** The open dropdown's "Show results", which loads the filtered search as a new document. */
async function showResults(harness: ContentHarness, landsOn: RegExp): Promise<void> {
  const apply = await snapshotTarget(harness, "the visible Show results", (element) => textOf(element) === "Show results");
  const reply = await actAndLoad(harness, { actionType: "web.dom.click", selector: apply.selector }, landsOn);
  if (reply) expect(reply.status).toBe("succeeded");
}

async function resultsShown(page: Page): Promise<void> {
  await page.locator(ORGANIC).first().waitFor({ state: "attached", timeout: 15_000 });
}

/** The read the scenario's own recording ends with (`manifest.ts` SEARCH_SCRIPT). */
const RECORDED_READ = {
  item: `${ORGANIC}:not([data-ad-slot])`,
  fields: {
    name: 'a[href*="/in/"] span[aria-hidden="true"]',
    headline: ":scope > div:nth-child(2) > div:nth-child(2)",
    location: ":scope > div:nth-child(2) > div:nth-child(3)"
  },
  paginate: { mode: "numbered" as const, pages: 'section[aria-label="Search results"] li > button', maxPages: 5 }
};

test.describe("professional-network: Rotterdam data engineers, the whole chain from the feed", () => {
  test("the content script's own verbs reach the filtered search and the read returns the 23 people", async ({ openHarness }) => {
    test.setTimeout(240_000);
    const harness = await openHarness("professional-network");
    const page = harness.page;

    // 1. Arrival.
    await answerArrivals(harness);

    // 2. Global search "data engineer" + Enter, then "See all people results".
    const search = await snapshotTarget(harness, "the global search", (element) => element.tagName.toLowerCase() === "input" && (nameOf(element) === "Search" || element.attributes?.["aria-label"] === "Search"));
    const typed = await act(harness, { actionType: "web.dom.type", selector: search.selector, text: ROTTERDAM_ENGINEERS.keywords }, "global search");
    expect(typed.validation?.status).toBe("passed");
    const entered = await actAndLoad(harness, { actionType: "web.dom.keypress", selector: search.selector, key: "Enter" }, /\/search\/results\/all\//u);
    if (entered) expect(entered.status).toBe("succeeded");
    const seeAll = await snapshotTarget(harness, '"See all people results"', (element) => textOf(element) === "See all people results");
    const opened = await actAndLoad(harness, { actionType: "web.dom.click", selector: seeAll.selector }, /\/search\/results\/people\//u);
    if (opened) expect(opened.status).toBe("succeeded");
    await resultsShown(page);

    // 3. Connections -> 2nd -> Show results.
    await openPill(harness, "Connections");
    const second = await snapshotTarget(harness, "the 2nd checkbox", (element) => element.inputType === "checkbox" && (nameOf(element) === "2nd" || element.label === "2nd"));
    const checked = await act(harness, { actionType: "web.dom.check", selector: second.selector, checked: true }, "2nd");
    expect(checked.validation?.status).toBe("passed");
    await showResults(harness, /network=%5B%22S%22%5D/u);
    await resultsShown(page);

    // 4. Locations -> type "Rotterdam" -> choose the Netherlands one -> reopen -> Show results.
    await openPill(harness, "Locations");
    const field = await snapshotTarget(harness, "the location typeahead", (element) => element.tagName.toLowerCase() === "input" && element.attributes?.placeholder === "Add a location");
    const typedPlace = await act(harness, { actionType: "web.dom.type", selector: field.selector, text: "Rotterdam" }, "location typeahead");
    expect(typedPlace.validation?.status).toBe("passed");
    // The suggestions are drawn 300 ms after the last keystroke.
    // A result card's location line can read the same words, so the wait is held to the typeahead's own rows.
    await page.locator('input[placeholder="Add a location"] ~ div > div:text-is("Rotterdam, New York, United States")').waitFor({ state: "visible", timeout: 5_000 });
    const all = await elements(harness);
    log("typeahead options the snapshot lists", all.filter((element) => shown(element) && textOf(element).startsWith("Rotterdam")).map((element) => ({ text: textOf(element), tag: element.tagName, selector: element.selector, hasClickHandler: element.hasClickHandler })));
    // The suggestions sit beside the typeahead's input; a result card's location line reads the same words.
    const typeahead = field.selector.replace(/ > input$/u, " > ");
    const inTypeahead = (element: DomElementDescriptor): boolean => element.selector.startsWith(typeahead);
    const netherlands = await snapshotTarget(harness, "the Rotterdam NL option", (element) => inTypeahead(element) && textOf(element) === "Rotterdam, South Holland, Netherlands");
    await snapshotTarget(harness, "the Rotterdam NY option", (element) => inTypeahead(element) && textOf(element) === "Rotterdam, New York, United States");
    const chose = await act(harness, { actionType: "web.dom.click", selector: netherlands.selector }, "Rotterdam, South Holland, Netherlands");
    expect(chose.status).toBe("succeeded");
    // Choosing closes the dropdown and adds the place, checked, to its list.
    await expect(page.locator('input[placeholder="Add a location"]')).toBeHidden();
    await expect(page.locator(`input[type="checkbox"][value="${ROTTERDAM_NL}"]`)).toBeChecked();
    await openPill(harness, "Locations");
    await showResults(harness, /geoUrn=%5B%22106169143%22%5D/u);
    expect(new URL(page.url()).searchParams.get("network")).toBe('["S"]');
    await resultsShown(page);

    // 5. The read, with the request the recording uses.
    const reply = await act(harness, { actionType: "web.dom.extract_list", timeoutMs: 60_000, extractList: RECORDED_READ }, "recorded read");
    log("recorded read extraction", reply.extraction);
    expect(reply).toMatchObject({ status: "succeeded", extraction: { recordCount: EXPECTED.length, pagesRead: 3, truncated: false } });
    expect(reply.extracted).toEqual(EXPECTED);
    log("security checks the search answered with", await challenges(harness));
  });
});

/** How many results requests the site answered with its security check this session, from the Lab's own state. */
async function challenges(harness: ContentHarness): Promise<number> {
  return ((await harness.finalState()).state as { challenges: number }).challenges;
}

/** Opens the filtered search directly and answers what the session puts over it, through the snapshot and clicks. */
async function openFiltered(harness: ContentHarness): Promise<void> {
  await harness.page.goto(new URL(FILTERED_PATH, harness.lab.origin).href);
  await contentReady(harness.page);
  await answerArrivals(harness);
  await resultsShown(harness.page);
}

/** A gateway that sends every dispatch to the content script and keeps what each answered. */
function gatewayFor(harness: ContentHarness, dispatched: Array<{ actionType: string; parameters: JsonObject; reply: BrowserActionResult }>): WebLlmEvidenceGateway {
  return {
    eligibleSessionIds: () => ["session.live-browser"],
    structureDetectionSessionIds: () => ["session.live-browser"],
    executeAction: async (_sessionId, request) => {
      const reply = await harness.runAction({ commandId: `w27.gw.${++commandCount}`, actionType: request.actionType, ...request.parameters } as BrowserActionCommand);
      dispatched.push({ actionType: request.actionType, parameters: request.parameters, reply });
      const payload: JsonObject = {};
      if (reply.snapshot !== undefined) payload.snapshot = JSON.parse(JSON.stringify(reply.snapshot)) as JsonObject;
      if (reply.structure !== undefined) payload.structure = JSON.parse(JSON.stringify(reply.structure)) as JsonObject;
      if (reply.extracted !== undefined) payload.records = JSON.parse(JSON.stringify(reply.extracted)) as JsonObject;
      return { status: reply.status, payload, ...(reply.status === "failed" && typeof reply.message === "string" ? { error: reply.message } : {}) };
    }
  };
}

/** What one read built from the page's proposal sent and got back. */
type ProposalRead = { packet: StructurePacket; detected: Detected; mapping: Record<string, string>; request: JsonObject | undefined; reply: BrowserActionResult | undefined; resultCode: string | undefined };

/**
 * Opens the filtered search, detects its structure through the evidence
 * runtime, maps name, headline and location to the detected columns that read
 * them exactly on page 1, and runs one `web.dom.extract_list` node from the
 * handle with `paginate` as the plan writes it, leaving out what carries the
 * promoted mark or no name link, each person once.
 */
async function readFromProposal(harness: ContentHarness, paginate: JsonValue | undefined): Promise<ProposalRead> {
  await openFiltered(harness);
  const detection = await run(harness, { actionType: "web.dom.capture_snapshot", detectStructure: {} });
  const structure = detection.structure as WebAutomationStructureDetection;
  log("page proposal", structure);
  expect(structure.ok, JSON.stringify(structure)).toBe(true);
  const detected = structure as Detected;

  const dispatched: Array<{ actionType: string; parameters: JsonObject; reply: BrowserActionResult }> = [];
  const runtime = createWebAutomationLlmEvidenceRuntime(gatewayFor(harness, dispatched));
  const detectedTool = await runtime.executeTool({ ...BASE, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  expect(detectedTool.resultCode, JSON.stringify(detectedTool.evidence)).toBe("web.structure.detected");
  const packet = detectedTool.evidence as unknown as StructurePacket;
  log("packet the model is shown", { itemCount: packet.itemCount, pagination: packet.pagination, fields: packet.fields.map((field) => `${field.key} (${field.coverage})`) });

  // A first look at page 1, every column, no pagination: which column holds what.
  const look = await runtime.executeTool({
    ...BASE, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID,
    value: { node: EXTRACT_LIST_NODE, parameters: { extractList: { handle: packet.extraction, paginate: false, minItems: 0 } }, consequences: [] }
  });
  expect(look.resultCode, JSON.stringify(look.evidence)).toBe("web.inspect.succeeded");
  const rows = (dispatched.filter((entry) => entry.actionType === "web.dom.extract_list").at(-1)?.reply.extracted ?? []) as Row[];
  const columnFor = (wanted: "name" | "headline" | "location"): string | undefined => packet.fields.find((field) => rows.some((row) => row[field.key] === EXPECTED[0]![wanted]))?.key;
  const mapping = { name: columnFor("name") ?? "", headline: columnFor("headline") ?? "", location: columnFor("location") ?? "" };
  log("scripted column decisions", mapping);
  expect(mapping.name && mapping.headline && mapping.location, "a detected column reads each of name, headline and location exactly").toBeTruthy();
  const promoted = packet.fields.find((field) => field.label === "data-ad-slot");
  expect(promoted, "the promoted cards' mark is a detected column").toBeTruthy();

  const read = await runtime.executeTool({
    ...BASE, callId: "call.read", toolId: WEB_LLM_RUN_NODE_TOOL_ID,
    value: {
      node: EXTRACT_LIST_NODE,
      parameters: {
        extractList: {
          handle: packet.extraction,
          fields: mapping,
          // The promoted profiles carry the mark; the product ad and the
          // "people also searched" module carry no profile link, so no name.
          where: [{ field: promoted!.key, is: "absent" }, { field: "name", is: "present" }],
          dedupe: { by: ["name"] },
          ...(paginate === undefined ? {} : { paginate })
        }
      },
      consequences: []
    }
  });
  const sent = dispatched.filter((entry) => entry.actionType === "web.dom.extract_list").at(-1);
  log("resolved request sent to the page", sent?.parameters.extractList);
  log("read result", { resultCode: read.resultCode, status: sent?.reply.status, extraction: sent?.reply.extraction, message: sent?.reply.message });
  log("rows", (sent?.reply.extracted as Row[] | undefined)?.map((row) => row.name));
  log("security checks the search answered with", await challenges(harness));
  return { packet, detected, mapping, request: sent?.parameters.extractList as JsonObject | undefined, reply: sent?.reply, resultCode: read.resultCode };
}

test.describe("professional-network: what the page proposes for the people results", () => {
  test("the proposal: the run, its columns and its pagination", async ({ openHarness }) => {
    test.setTimeout(120_000);
    const harness = await openHarness("professional-network");
    await openFiltered(harness);
    const detection = await run(harness, { actionType: "web.dom.capture_snapshot", detectStructure: {} });
    const structure = detection.structure as WebAutomationStructureDetection;
    log("page proposal", structure);
    expect(structure.ok, JSON.stringify(structure)).toBe(true);
    const proposal = (structure as Detected).proposal;
    const matched = await harness.page.evaluate((selector) => [...document.querySelectorAll(selector)].map((element) => element.getAttribute("data-urn") ?? "(no urn)"), proposal.item);
    log("the proposal's item selector matches", matched);
    // Page 1 of the run: ten results, the product ad after the third and the
    // promoted profile after the seventh -- one template, so one run.
    expect(matched).toHaveLength(12);
    expect(matched.filter((urn) => urn.startsWith("urn:gl:sponsored:"))).toHaveLength(1);
    expect(proposal.fields.map((field) => field.label)).toContain("data-ad-slot");
    // The pager offers Previous, the numbers 1-3 and a Next; the proposal names the Next.
    expect(proposal.pagination).toMatchObject({ mode: "next", maxPages: 1 });
    const followed = await harness.page.evaluate((selector) => document.querySelector(selector)?.textContent?.trim(), (proposal.pagination as { next: string }).next);
    expect(followed).toBe("Next");
  });

  test("a read built only from the proposal, asking for every page, returns the 23 people", async ({ openHarness }) => {
    // Gap G1, observed 2026-10-01: 20 people, pagesRead 3, paginationStop
    // page_repeated, truncated false. The proposal names the pager's Next
    // (detect-pagination.ts:94-95 prefers Next over the numbered run), and
    // Guildline's Next is a script button that goes from page 2 to page 2;
    // followNext swaps a Next for the pager's following number only when the
    // Next is a link to this very page (pagination.ts:376), so page 3 is never
    // reached. Flips to passing when that is fixed.
    test.setTimeout(240_000);
    const harness = await openHarness("professional-network");
    const result = await readFromProposal(harness, { maxPages: 5 });
    expect(result.resultCode).toBe("web.inspect.succeeded");
    expect(result.reply?.extracted).toEqual(EXPECTED);
  });

  test("a plan that names the numbered pager it sees keeps the page bound it asked for", async ({ openHarness }) => {
    // Gap G2, observed and fixed 2026-10-01 (t194-w32): the resolved request
    // carried maxPages 1 and the read returned page 1 alone, truncated. A plan
    // whose paginate named a mode other than the detected one kept the
    // detected bound, which is always 1 (detect-pagination.ts:84); the plan's
    // own bound now holds whatever its mode (plan-resolution/extraction/slot.ts,
    // keptPagination).
    test.setTimeout(240_000);
    const harness = await openHarness("professional-network");
    const result = await readFromProposal(harness, { mode: "numbered", maxPages: 5 });
    expect((result.request?.paginate as { maxPages?: number } | undefined)?.maxPages).toBe(5);
  });
});

/** The results endpoint the page's own script fetches, for the filtered search's first page. */
const FRAGMENT_PATH = FILTERED_PATH.replace("/people/?", "/people/fragment?") + "&page=1";

test.describe("professional-network: the search's own defences", () => {
  // The site answers a third results request inside three seconds with a
  // security check that clears itself after five (`search/rate-limit.ts`). A
  // read paced by the harness alone did not meet it in the rows above, so the
  // limiter is primed here with three requests of the page's own endpoint
  // just before the read: that arranges the fixture, it acts for no one.
  test("a read whose page 2 is answered with the security check waits it out and returns the 23 people", async ({ openHarness }) => {
    test.setTimeout(240_000);
    const harness = await openHarness("professional-network");
    await openFiltered(harness);
    const before = await challenges(harness);
    await harness.page.evaluate(async (path) => {
      for (let index = 0; index < 3; index += 1) await fetch(path, { headers: { accept: "application/json" } });
    }, FRAGMENT_PATH);
    const reply = await act(harness, { actionType: "web.dom.extract_list", timeoutMs: 60_000, extractList: RECORDED_READ }, "recorded read behind the check");
    log("read behind the check", reply.extraction);
    const met = (await challenges(harness)) - before;
    log("security checks met by the read and the primer", met);
    expect(met, "the read's page 2 request was answered with the check").toBeGreaterThan(0);
    expect(reply).toMatchObject({ status: "succeeded", extraction: { recordCount: EXPECTED.length, pagesRead: 3, truncated: false } });
    expect(reply.extracted).toEqual(EXPECTED);
  });
});

async function armUpsell(harness: ContentHarness): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/set-mode`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify({ mode: "premium-upsell" })
  });
  expect(response.ok, `arming premium-upsell answered ${response.status}`).toBe(true);
}

test.describe("professional-network: the premium-upsell variant (professional-network-rotterdam-data-engineers-upsell)", () => {
  test("the offer is closed by its No thanks through the snapshot and a click, and the read returns the 23 people", async ({ openHarness }) => {
    test.setTimeout(240_000);
    const harness = await openHarness("professional-network");
    await armUpsell(harness);
    await harness.page.goto(new URL(FILTERED_PATH, harness.lab.origin).href);
    await contentReady(harness.page);
    const page = harness.page;
    await page.getByText("Start free trial", { exact: true }).waitFor({ state: "visible", timeout: 15_000 });
    const noThanks = await snapshotTarget(harness, '"No thanks"', (element) => element.tagName.toLowerCase() === "div" && textOf(element) === "No thanks");
    expect((await act(harness, { actionType: "web.dom.click", selector: noThanks.selector }, '"No thanks"')).status).toBe("succeeded");
    await expect(page.getByText("Start free trial", { exact: true })).toBeHidden();
    await answerArrivals(harness);
    const reply = await act(harness, { actionType: "web.dom.extract_list", timeoutMs: 60_000, extractList: RECORDED_READ }, "recorded read after the offer");
    expect(reply).toMatchObject({ status: "succeeded", extraction: { recordCount: EXPECTED.length, pagesRead: 3, truncated: false } });
    expect(reply.extracted).toEqual(EXPECTED);
  });

  test("what a read does with the offer still open over the results", async ({ openHarness }) => {
    test.setTimeout(240_000);
    const harness = await openHarness("professional-network");
    await armUpsell(harness);
    await harness.page.goto(new URL(FILTERED_PATH, harness.lab.origin).href);
    await contentReady(harness.page);
    await harness.page.getByText("Start free trial", { exact: true }).waitFor({ state: "visible", timeout: 15_000 });
    const reply = await act(harness, { actionType: "web.dom.extract_list", timeoutMs: 60_000, extractList: RECORDED_READ }, "recorded read under the offer");
    log("read under the offer", { extraction: reply.extraction, rows: (reply.extracted as Row[] | undefined)?.length });
    // The read presses the pager's buttons with element.click(), which no
    // scrim intercepts, so it reads every page under an aria-modal offer that
    // stays open: a Flow that never met the offer still returns the dataset.
    expect(reply).toMatchObject({ status: "succeeded", extraction: { recordCount: EXPECTED.length, pagesRead: 3 } });
    expect(reply.extracted).toEqual(EXPECTED);
    await expect(harness.page.getByText("Start free trial", { exact: true })).toBeVisible();
  });
});
