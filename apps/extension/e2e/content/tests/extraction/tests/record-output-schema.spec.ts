// What the rows a real page yields are stored under: the everything store's
// search results, read through the dispatch a replayed Flow node takes, and put
// through Core's own record validation.
//
// The defect this closes cost a whole live run. On 2026-09-23 a Flow built from
// an instruction replayed every step, reached the right page, read exactly the
// sixteen rows the task expected -- and stored none of them. Core reported
// `core.result.every_record_refused`: "16 rows were refused, 0 stored, across 1
// record set" (`test-runs/run-mueqynzb-ac54aab9`). Nothing was wrong with the
// extraction. The schema the rows were validated against was.
//
// Core's Flow Bootstrap shows a model this node's `recordOutput` parameter with
// the whole record-set contract and a worked example, and lists `number` among
// the value types it may choose. A model asked for "a table with columns name,
// price, rating and url" writes one and types price and rating as numbers,
// which a page can never produce: `web.dom.extract_list` reads text.
//
// These rows prove both halves against the store itself rather than a fixture
// built to pass: the authored schema refuses every row the page produced, and
// the same node dispatched through `webAutomationExtractListDispatch` stores
// every one of them. No model is attached; the plan is written here.

import {
  webAutomationExtractListDispatch,
  type WebAutomationExtractField,
  type WebAutomationExtractListRequest,
  type WebAutomationStructureDetection
} from "@fluxiq-web-extension/domain/client";
import { parseAutomationStudioRecordOutput, validateAutomationStudioRecords } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

/** The Plus-only wireless-earbud search: the live instruction task's own page. */
const SEARCH = "/scenarios/everything-store/s?k=wireless+earbuds&rh=plus";

type Detected = Extract<WebAutomationStructureDetection, { ok: true }>;
type Record_ = Record<string, unknown>;

/** Opens the search, passing the store's browser check when it stands. */
async function openSearch(harness: ContentHarness): Promise<void> {
  const url = new URL(SEARCH, harness.lab.origin).href;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await harness.page.goto(url, { waitUntil: "load" }).catch(() => undefined);
    const blocked = await harness.page.locator("[data-continue]").count().catch(() => 1);
    if (!blocked) {
      await harness.page.waitForTimeout(1_500);
      return;
    }
    await harness.page.waitForTimeout(1_700);
    await harness.page.locator("[data-continue]").click().catch(() => undefined);
    await harness.page.waitForTimeout(2_000);
  }
  throw new Error("The store kept answering with its browser check.");
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
  return { item: structure.proposal.item, fields: Object.fromEntries(fields.map((field) => [field.key, field.spec as WebAutomationExtractField])) };
}

/** The rows Core would keep for this record output, and the codes it refused the rest with. */
function keptByCore(recordOutput: unknown, records: readonly Record_[]) {
  const parsed = parseAutomationStudioRecordOutput(recordOutput);
  expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
  if (!parsed.ok) throw new Error("the record output did not parse");
  return validateAutomationStudioRecords(records, parsed.output.schema, { maxRecords: parsed.output.maxRecords });
}

test("a node whose author typed the store's price and rating as numbers still stores every row it read", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("everything-store");
  await openSearch(harness);
  const structure = await detect(harness);
  const full = requestFrom(structure);

  // Which detected column holds what, decided from the values the page put in
  // them rather than from a key, which is derived from markup and would change
  // with the store's.
  const everything = await harness.runAction({ commandId: "schema-all", actionType: "web.dom.extract_list", extractList: full });
  expect(everything.status, JSON.stringify(everything.validation)).toBe("succeeded");
  const readAll = (everything.extracted ?? []) as Record_[];
  const holding = (holds: (value: string) => boolean): string | undefined =>
    Object.keys(readAll[0] ?? {}).find((key) => readAll.every((record) => typeof record[key] === "string" && holds(record[key] as string)));
  const name = holding((value) => value.length > 20 && !value.startsWith("$") && !value.startsWith("http"));
  const price = holding((value) => /^\$[\d,]+\.\d\d$/u.test(value));
  const rating = holding((value) => /^\d(\.\d)?$/u.test(value));
  const url = structure.proposal.fields.find((field) => typeof field.spec !== "string" && field.spec.kind === "link" && field.coverage >= 1)?.key;
  for (const [column, key] of Object.entries({ name, price, rating, url })) {
    expect(key, `the detection proposes a column holding each card's ${column}`).toBeTruthy();
  }
  const mark = structure.proposal.fields.find((field) => field.label === "data-ad-id")?.key;
  expect(mark, "the store marks its sponsored cards").toBeTruthy();

  // The plan the instruction asks for: those four columns under the names it
  // used, and the sponsored placements left out.
  const chosen = [["name", name], ["price", price], ["rating", rating], ["url", url]] as const;
  const plan: WebAutomationExtractListRequest = {
    item: full.item,
    fields: Object.fromEntries(chosen.map(([as, key]) => [as, full.fields[key!] as WebAutomationExtractField])),
    where: [{ read: full.fields[mark!] as WebAutomationExtractField, is: "absent" }],
    minItems: 0
  };

  // And the record output a model writes beside it, typed as a person would.
  const authored: JsonObject = {
    datasetId: "products",
    label: "Products",
    writeMode: "append",
    schema: {
      schemaVersion: "0.1",
      fields: [
        { id: "name", label: "Name", valueType: "string", required: true },
        { id: "price", label: "Price", valueType: "number", required: true },
        { id: "rating", label: "Rating", valueType: "number", required: true },
        { id: "url", label: "URL", valueType: "url", required: true }
      ]
    }
  };

  const dispatch = webAutomationExtractListDispatch({ extractList: plan as unknown as JsonObject, recordOutput: authored });
  expect(dispatch.ok, JSON.stringify(dispatch.ok ? {} : dispatch.result)).toBe(true);
  if (!dispatch.ok) throw new Error("the node refused its own record output");
  const sent = (dispatch.payload.parameters as JsonObject).extractList as unknown as WebAutomationExtractListRequest;
  const read = await harness.runAction({ commandId: "schema-plan", actionType: "web.dom.extract_list", extractList: sent });
  expect(read.status, JSON.stringify(read.validation)).toBe("succeeded");
  const records = (read.extracted ?? []) as Record_[];

  // What the store is showing, read off it after the extraction: a read
  // completes the page it is on, so the lazily loaded results are there by now.
  const shown = await page.evaluate(() => ({
    total: document.querySelectorAll('[data-component="search-result"][data-sku]').length,
    sponsored: document.querySelectorAll('[data-component="search-result"][data-ad-id]').length
  }));
  expect(shown.sponsored, "the store interleaves sponsored cards with its results").toBeGreaterThan(0);
  expect(records.length, "the read is every result and no advertisement").toBe(shown.total - shown.sponsored);

  // The measurement: what the author wrote loses every row, and what the node
  // dispatches keeps every one.
  const byAuthor = keptByCore({ ...authored, recordsPath: "result.extracted" }, records);
  expect(byAuthor.rows.length, "the authored schema is the one that emptied the dataset").toBe(0);
  expect(byAuthor.invalidCount).toBe(records.length);
  expect(byAuthor.issues).toEqual(["records.invalid_value"]);

  const byNode = keptByCore(dispatch.payload.recordOutput, records);
  expect(byNode.issues, "no row is refused").toEqual([]);
  expect(byNode.invalidCount).toBe(0);
  expect(byNode.rows.length).toBe(records.length);
  // The dataset is still the author's, and the columns still carry their names.
  const output = dispatch.payload.recordOutput as { datasetId: string; schema: { fields: Array<{ id: string; label: string }> } };
  expect(output.datasetId).toBe("products");
  expect(output.schema.fields.map((field) => field.label)).toEqual(["Name", "Price", "Rating", "URL"]);
  expect(Object.keys(byNode.rows[0] ?? {})).toEqual(["name", "price", "rating", "url"]);
});

test("a node whose author set no record output derives one that stores every row", async ({ openHarness }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("everything-store");
  await openSearch(harness);
  const request = requestFrom(await detect(harness));

  const dispatch = webAutomationExtractListDispatch({ extractList: request as unknown as JsonObject });
  expect(dispatch.ok).toBe(true);
  if (!dispatch.ok) throw new Error("the node refused its own record output");
  const sent = (dispatch.payload.parameters as JsonObject).extractList as unknown as WebAutomationExtractListRequest;
  const read = await harness.runAction({ commandId: "schema-derived", actionType: "web.dom.extract_list", extractList: sent });
  expect(read.status, JSON.stringify(read.validation)).toBe("succeeded");
  const records = (read.extracted ?? []) as Record_[];
  expect(records.length).toBeGreaterThanOrEqual(12);

  const kept = keptByCore(dispatch.payload.recordOutput, records);
  expect(kept.issues).toEqual([]);
  expect(kept.invalidCount).toBe(0);
  expect(kept.rows.length).toBe(records.length);
});
