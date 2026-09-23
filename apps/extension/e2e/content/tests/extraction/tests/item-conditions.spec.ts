// Which items of a detected list become records: `extractList`'s `where`
// (contract C5), against the two campaign sites whose results pages carry
// advertisements among their results.
//
// The defect these rows close was measured live in task t092 and is a contract
// gap rather than a bug. A detected run is every element rendered from one
// template, and a results page renders its advertisements from the same
// template as its results, so the everything store's search for Plus wireless
// earbuds is one run of twenty: sixteen results and four sponsored cards. The
// model could say which **columns** to keep and not which **items**, so
// "collect every product on the first page of results, leaving out sponsored
// placements" read all twenty -- right columns, wrong row set, and a positional
// match against the expected table failed on every row.
//
// Two halves are proved here, and they are different claims:
//
// - **the page half**: a request carrying `where` reads only the items every
//   condition holds for, whether the condition names a column the record keeps
//   (`field`) or one it does not (`read`), and a numeric bound reads the number
//   out of a value the page wrote for a person;
// - **the model's half**: the columns a detection proposes now include the mark
//   that tells an advertisement from a result -- on the everything store the
//   card's own `data-ad-id`, on the bigbox retailer a tag only its promoted
//   tiles carry -- and a `where` written in the vocabulary the model was shown
//   (a detected column key) resolves into a request the page runs.
//
// The second half goes through the real evidence runtime with the decisions
// scripted rather than asked of a provider: every observation, every
// resolution and every read is the real one, and no model is attached.
//
// These rows assert behaviour and counts, never a field key: which key a
// column lands under is derived from page structure and would change with the
// site's markup, while "the read leaves out exactly the advertisements" is the
// claim that matters.

import type { JsonObject } from "fluxiq/core";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_RUN_NODE_TOOL_ID,
  type WebLlmEvidenceGateway
} from "@fluxiq-web-extension/domain";
import type {
  WebAutomationExtractField,
  WebAutomationExtractListRequest,
  WebAutomationStructureDetection
} from "@fluxiq-web-extension/domain/client";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

/** The Plus-only wireless-earbud search: the live instruction task's own page. */
const STORE_SEARCH = "/scenarios/everything-store/s?k=wireless+earbuds&rh=plus";
/** The paper-towel search the bigbox retailer's own live task runs, whose ads sit at the second, seventh and eleventh tiles. */
const BIGBOX_SEARCH = "/scenarios/bigbox-retail/search?q=paper+towels";

/** The node the model runs to read a list, as the catalog names it. */
const EXTRACT_LIST_NODE = "web.output.dom-extract_list";

const BASE = { projectId: "project.item-conditions", flowId: "flow.item-conditions", maxEvidenceBytes: 24_000 } as const;

type Detected = Extract<WebAutomationStructureDetection, { ok: true }>;
type StructurePacket = { extraction: string; itemCount: number; fields: Array<{ key: string; label: string; coverage: number }> };
type Record_ = Record<string, unknown>;

/**
 * Opens a fixture page, passing a browser check when one stands. The store's
 * check is the first thing a session meets and is not what these rows are
 * about; its button unlocks after a moment and passing it reloads onto what was
 * asked for. The wait is a poll rather than `page.waitForFunction`, because the
 * store serves a Content Security Policy without `unsafe-eval`, as a real store
 * does, and `waitForFunction` compiles a string in the page.
 */
async function open(harness: ContentHarness, path: string): Promise<void> {
  const url = new URL(path, harness.lab.origin).href;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await harness.page.goto(url, { waitUntil: "load" }).catch(() => undefined);
    const blocked = await harness.page.locator("[data-continue]").count().catch(() => 1);
    if (!blocked) {
      // The results are swapped in from a template after the page loads.
      await harness.page.waitForTimeout(1_500);
      return;
    }
    await harness.page.waitForTimeout(1_700);
    await harness.page.locator("[data-continue]").click().catch(() => undefined);
    await harness.page.waitForTimeout(2_000);
  }
  throw new Error("The fixture kept answering with its browser check.");
}

async function detect(harness: ContentHarness): Promise<Detected> {
  const reply = await harness.runAction({ commandId: `detect-${Date.now()}`, actionType: "web.dom.capture_snapshot", detectStructure: {} });
  const structure = reply.structure as WebAutomationStructureDetection;
  expect(structure.ok, `a structure was detected: ${JSON.stringify(structure)}`).toBe(true);
  if (!structure.ok) throw new Error("No structure detected.");
  return structure;
}

/** The detection as the literal request its handle stands for, reading only the page it is on. */
function requestFrom(structure: Detected): WebAutomationExtractListRequest {
  const fields = structure.proposal.fields.filter((field) => field.spec.handling !== "exclude");
  return {
    item: structure.proposal.item,
    fields: Object.fromEntries(fields.map((field) => [field.key, field.spec as WebAutomationExtractField]))
  };
}

/** The proposed field whose label is exactly `label`, which is page structure and never a value. */
function fieldLabelled(structure: Detected, label: string): { key: string; coverage: number; spec: WebAutomationExtractField } {
  const found = structure.proposal.fields.find((field) => field.label === label);
  expect(found, `the detection proposes a column labelled ${label}: ${structure.proposal.fields.map((field) => field.label).join(" | ")}`).toBeTruthy();
  if (!found) throw new Error(`no column labelled ${label}`);
  return { key: found.key, coverage: found.coverage, spec: found.spec as WebAutomationExtractField };
}

async function read(harness: ContentHarness, request: WebAutomationExtractListRequest, id: string): Promise<{ count: number; records: Record_[]; actual: string }> {
  const reply = await harness.runAction({ commandId: id, actionType: "web.dom.extract_list", extractList: request });
  expect(reply.status, JSON.stringify(reply.validation)).toBe("succeeded");
  return {
    count: reply.extraction?.recordCount ?? -1,
    records: (reply.extracted ?? []) as Record_[],
    // `actual` is the read's own account of itself; a validation that was
    // skipped has a reason instead, and says nothing about the rows.
    actual: reply.validation !== undefined && "actual" in reply.validation ? reply.validation.actual : ""
  };
}

test("a where condition on the store's own ad mark reads the results and leaves the sponsored cards out", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("everything-store");
  await open(harness, STORE_SEARCH);

  const structure = await detect(harness);
  const request = requestFrom(structure);
  // The mark is the card's own `data-ad-id`, which the store's author wrote on
  // the container: a column below full coverage, proposed as a field like any
  // other, and the one part of the markup that says what the card *is*.
  const mark = fieldLabelled(structure, "data-ad-id");
  expect(mark.coverage, "the ad mark is on some cards and not others").toBeLessThan(1);

  const all = await read(harness, request, "extract-all");

  // What the page holds, read off it directly, so the assertions below are
  // against the store rather than against themselves -- and read *after* the
  // first extraction, because a read completes the page it is on: the store
  // draws twelve of its sixteen results and loads the rest when the end of the
  // list is revealed, which the read now does for itself (task t096).
  const shown = await page.evaluate(() => ({
    total: document.querySelectorAll('[data-component="search-result"][data-sku]').length,
    sponsored: document.querySelectorAll("[data-component=\"search-result\"][data-ad-id]").length
  }));
  expect(shown.sponsored, "the store interleaves sponsored cards with its results").toBeGreaterThan(0);
  expect(all.count, "an unfiltered read is every item of the run").toBe(shown.total);

  const results = await read(harness, { ...request, where: [{ field: mark.key, is: "absent" }] }, "extract-results");
  expect(results.count).toBe(shown.total - shown.sponsored);
  expect(results.records.every((record) => record[mark.key] === null), "no record kept carries the ad mark").toBe(true);
  // The read says what it left out, so sixteen rows read from a page of twenty
  // can be told from sixteen items found.
  expect(results.actual).toContain(`${shown.sponsored} items left out by where`);

  // And the other way round, which is the same condition read the other way.
  const ads = await read(harness, { ...request, where: [{ field: mark.key, is: "present" }] }, "extract-ads");
  expect(ads.count).toBe(shown.sponsored);

  // A condition may test a column the table does not keep, which is the usual
  // case: a table of products wants no ad-mark column in it.
  const { [mark.key]: _dropped, ...columns } = request.fields;
  const without = await read(harness, { item: request.item, fields: columns, where: [{ read: mark.spec, is: "absent" }] }, "extract-read-form");
  expect(without.count).toBe(shown.total - shown.sponsored);
  expect(without.records.every((record) => !Object.hasOwn(record, mark.key)), "the tested column is not a column of the table").toBe(true);
});

test("the whole first page of results is sixteen rows once the store has loaded it, and the four advertisements are not among them", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("everything-store");
  await open(harness, STORE_SEARCH);
  // The store draws twelve results and loads the rest when the bottom of the
  // list scrolls into view, so the full first page is only there after it has.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2_000);
  const shown = await page.evaluate(() => ({
    total: document.querySelectorAll('[data-component="search-result"][data-sku]').length,
    sponsored: document.querySelectorAll("[data-component=\"search-result\"][data-ad-id]").length
  }));
  expect(shown, "the loaded first page is sixteen results and four sponsored cards").toEqual({ total: 20, sponsored: 4 });

  const structure = await detect(harness);
  const request = requestFrom(structure);
  const mark = fieldLabelled(structure, "data-ad-id");
  const results = await read(harness, { ...request, where: [{ field: mark.key, is: "absent" }], minItems: 16 }, "extract-loaded");
  expect(results.count).toBe(16);
  // `minItems` counts the rows the answer has, not the items the page drew.
  expect(results.actual).toContain("16 records");
});

test("a numeric bound reads the number out of a value the page wrote for a person", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("everything-store");
  await open(harness, STORE_SEARCH);
  const structure = await detect(harness);
  const request = requestFrom(structure);
  const mark = fieldLabelled(structure, "data-ad-id");
  const organic = { ...request, where: [{ field: mark.key, is: "absent" as const }] };

  // The rating the store draws for the eye: a number, beside a star icon whose
  // own text is a hidden sentence, so the value reads "4.5" or "4.5 out of 5".
  const ratingKey = Object.keys(request.fields).find((key) => /css-14idg5p|rating/u.test(String(JSON.stringify(request.fields[key]))));
  expect(ratingKey, `a rating column was proposed: ${Object.keys(request.fields).join(", ")}`).toBeTruthy();
  if (!ratingKey) throw new Error("no rating column");

  const every = await read(harness, organic, "bound-every");
  const ratings = every.records.map((record) => Number(String(record[ratingKey] ?? "").match(/-?\d[\d,]*(?:\.\d+)?/u)?.[0] ?? Number.NaN));
  const wanted = ratings.filter((rating) => rating >= 4.5).length;
  expect(wanted, "the search shows cards on both sides of the bound").toBeGreaterThan(0);
  expect(wanted, "the search shows cards on both sides of the bound").toBeLessThan(every.count);

  const bounded = await read(harness, { ...organic, where: [...organic.where, { field: ratingKey, atLeast: 4.5 }], minItems: 0 }, "bound-read");
  expect(bounded.count).toBe(wanted);
});

test("the model names which items it wants in the vocabulary the detection showed it, and the request that reaches the page carries it", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("everything-store");
  await open(harness, STORE_SEARCH);

  const dispatched: Array<{ actionType: string; parameters: JsonObject; recordCount: number | undefined }> = [];
  let command = 0;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.live-browser"],
    structureDetectionSessionIds: () => ["session.live-browser"],
    executeAction: async (_sessionId, request) => {
      const reply = await harness.runAction({
        commandId: `item-conditions.${++command}`,
        actionType: request.actionType,
        ...request.parameters
      } as Parameters<typeof harness.runAction>[0]);
      dispatched.push({ actionType: request.actionType, parameters: request.parameters, recordCount: reply.extraction?.recordCount });
      const payload: JsonObject = {};
      if (reply.snapshot !== undefined) payload.snapshot = JSON.parse(JSON.stringify(reply.snapshot)) as JsonObject;
      if (reply.structure !== undefined) payload.structure = JSON.parse(JSON.stringify(reply.structure)) as JsonObject;
      if (reply.extracted !== undefined) payload.records = JSON.parse(JSON.stringify(reply.extracted)) as JsonObject;
      return {
        status: reply.status,
        payload,
        ...(reply.status === "failed" && typeof reply.message === "string" ? { error: reply.message } : {})
      };
    }
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);

  const detected = await runtime.executeTool({ ...BASE, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  expect(detected.resultCode, JSON.stringify(detected.evidence)).toBe("web.structure.detected");
  const packet = detected.evidence as unknown as StructurePacket;
  // What the model is shown: keys, labels, coverage. A label is page structure
  // and may be a path, but nothing the model can read the page with, and no
  // value read inside an item (D3).
  expect(Object.keys(packet)).not.toContain("item");
  expect(JSON.stringify(packet)).not.toContain(":scope");
  expect(JSON.stringify(packet), "the packet quotes no value read inside an item").not.toContain("Sponsored");
  const mark = packet.fields.find((field) => field.label === "data-ad-id");
  expect(mark, `the packet offers the ad mark as a column: ${packet.fields.map((field) => `${field.label}@${field.coverage}`).join(" | ")}`).toBeTruthy();
  if (!mark) throw new Error("no ad-mark column in the packet");
  expect(mark.coverage).toBeLessThan(1);

  const columns = packet.fields.filter((field) => field.coverage >= 1).slice(0, 3).map((field) => field.key);
  const ran = await runtime.executeTool({
    ...BASE,
    callId: "call.read",
    toolId: WEB_LLM_RUN_NODE_TOOL_ID,
    value: {
      node: EXTRACT_LIST_NODE,
      parameters: {
        extractList: {
          handle: packet.extraction,
          fields: Object.fromEntries(columns.map((key) => [key, key])),
          where: [{ field: mark.key, is: "absent" }],
          paginate: false
        }
      },
      consequences: []
    }
  });
  expect(ran.resultCode, JSON.stringify(ran.evidence)).toBe("web.inspect.succeeded");

  // What went out is a literal request the page can run, with the condition
  // resolved into the column's own spec -- so the saved Flow needs no handle,
  // no detection and no model to read the same rows again.
  const extraction = dispatched.filter((entry) => entry.actionType === "web.dom.extract_list").at(-1);
  expect(extraction, "the node dispatched an extraction").toBeTruthy();
  const sent = extraction?.parameters.extractList as unknown as WebAutomationExtractListRequest;
  expect(sent.where?.length).toBe(1);
  expect(sent.where?.[0]?.is).toBe("absent");
  expect(sent.where?.[0]?.field, "the resolved condition carries the column, not a reference to the table's fields").toBeUndefined();
  expect(JSON.stringify(sent.where?.[0]?.read)).toContain("data-ad-id");
  expect(Object.keys(sent.fields)).toEqual(columns);

  // What the page holds, read off it after the extraction: a read completes the
  // page it is on, so the store's lazily loaded results are there by now and
  // the rows the model asked for are every card that is not an advertisement
  // (task t096).
  const shown = await page.evaluate(() => ({
    total: document.querySelectorAll('[data-component="search-result"][data-sku]').length,
    sponsored: document.querySelectorAll("[data-component=\"search-result\"][data-ad-id]").length
  }));
  expect(shown.sponsored, "the store interleaves sponsored cards with its results").toBeGreaterThan(0);
  expect(extraction?.recordCount).toBe(shown.total - shown.sponsored);

  // And the step the Flow keeps is the model's own words, handle and all, which
  // Core resolves again when the plan is validated.
  expect((ran.draft?.ranWith?.parameters as { extractList?: { handle?: string } })?.extractList?.handle).toBe(packet.extraction);
});

test("a promoted tile is left out on a site that marks it with a tag rather than an attribute", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("bigbox-retail");
  await open(harness, BIGBOX_SEARCH);
  const structure = await detect(harness);
  const request = requestFrom(structure);

  // This retailer puts its advertisements at the second, seventh and eleventh
  // tiles and marks them with a small tag and nothing else -- no attribute on
  // the container, and never on the first tile, which is what made the mark
  // invisible to a detection that read only the run's first item.
  const marks = await page.evaluate((item) => {
    const items = Array.from(document.querySelectorAll(item));
    const sponsored = items.filter((element) => Array.from(element.children).some((child) => child.textContent?.trim() === "Sponsored"));
    return { total: items.length, sponsored: sponsored.length, firstIsSponsored: sponsored.includes(items[0]!) };
  }, structure.proposal.item);
  expect(marks.sponsored, "the retailer interleaves promoted tiles with its listings").toBeGreaterThan(0);
  expect(marks.firstIsSponsored, "the first tile is not one of them").toBe(false);

  // The column that resolves in exactly the promoted tiles, found among the
  // proposal's partial columns rather than named by its class, which is hashed.
  const candidates = structure.proposal.fields.filter((field) => field.coverage > 0 && field.coverage < 1);
  const all = await read(harness, request, "bigbox-all");
  expect(all.count).toBe(marks.total);
  const markKey = candidates.map((field) => field.key).find((key) => {
    const carrying = all.records.filter((record) => record[key] !== null && record[key] !== undefined);
    return carrying.length === marks.sponsored && carrying.every((record) => record[key] === "Sponsored");
  });
  expect(markKey, `a column resolves in exactly the promoted tiles: ${candidates.map((field) => `${field.label}@${field.coverage}`).join(" | ")}`).toBeTruthy();
  if (!markKey) throw new Error("no promoted-tile column");

  const listings = await read(harness, { ...request, where: [{ field: markKey, is: "absent" }] }, "bigbox-listings");
  expect(listings.count).toBe(marks.total - marks.sponsored);
  expect(listings.records.every((record) => record[markKey] === null)).toBe(true);
});
