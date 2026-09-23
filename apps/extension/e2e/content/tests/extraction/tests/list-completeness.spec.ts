// A read returns the whole list and only the rows the instruction asked for,
// against the everything store's own search results (task t096).
//
// Two things were measured on the 2026-09-23 campaign and both are here:
//
// - **present is not complete.** The store draws twelve of its sixteen
//   first-page results and fetches the rest from a sentinel under the twelfth,
//   so a read that waited for the list to be there and stop changing settled on
//   twelve and reported them as the page (`run-mudwci8d-de88aa32`, twelve rows
//   where sixteen were expected). Nothing was arriving and nothing was going
//   to: the page was waiting to be scrolled. The growth settle could only ever
//   have picked those four up if the Flow scrolled first, and no live Flow has
//   carried a scroll node before its extraction, so the read reveals the end of
//   its list itself. The row below proves it with **nothing in the test
//   touching the page**: the scroll, if it happens, is the read's;
// - **a filter written over a column the plan renamed reaches the page.** A
//   plan keeps `{yourKey: "detectedKey"}` and then says what it wants of
//   `yourKey`, which named no detected column and was refused. The row below
//   goes through the real evidence runtime with the decisions scripted rather
//   than asked of a provider: every observation, resolution and read is the
//   real one, and no model is attached.
//
// These rows assert counts and behaviour, never a field key: which key a column
// lands under is derived from page structure and would change with the store's
// markup.

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
/** Every card of the results run, sponsored and organic alike; the read is what tells them apart. */
const CARDS = '[data-component="search-result"][data-sku]';
/** The node the model runs to read a list, as the catalog names it. */
const EXTRACT_LIST_NODE = "web.output.dom-extract_list";
const BASE = { projectId: "project.list-completeness", flowId: "flow.list-completeness", maxEvidenceBytes: 24_000 } as const;

type Detected = Extract<WebAutomationStructureDetection, { ok: true }>;
type StructurePacket = { extraction: string; itemCount: number; fields: Array<{ key: string; label: string; coverage: number }> };
type Row = Record<string, unknown>;

/**
 * Opens the search, passing the store's browser check when it stands, and
 * waits out the results hydration. It never scrolls: what these rows measure is
 * whether the read reaches the end of the list by itself.
 */
async function open(harness: ContentHarness): Promise<void> {
  const url = new URL(STORE_SEARCH, harness.lab.origin).href;
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
  return {
    item: structure.proposal.item,
    fields: Object.fromEntries(fields.map((field) => [field.key, field.spec as WebAutomationExtractField]))
  };
}

/** The proposed field whose label is exactly `label`, which is page structure and never a value. */
function fieldLabelled(structure: Detected, label: string): { key: string; coverage: number } {
  const found = structure.proposal.fields.find((field) => field.label === label);
  expect(found, `the detection proposes a column labelled ${label}: ${structure.proposal.fields.map((field) => field.label).join(" | ")}`).toBeTruthy();
  if (!found) throw new Error(`no column labelled ${label}`);
  return { key: found.key, coverage: found.coverage };
}

/** The first number written in a value, as `item-filter.ts` reads one for a bound. */
function numberIn(value: unknown): number {
  return Number(String(value ?? "").match(/-?\d[\d,]*(?:\.\d+)?/u)?.[0]?.replaceAll(",", "") ?? Number.NaN);
}

async function cardCount(harness: ContentHarness): Promise<number> {
  return await harness.page.evaluate((selector) => document.querySelectorAll(selector).length, CARDS);
}

test("a one-page read reaches the results the store loads only when the end of its list is scrolled to", async ({ openHarness }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("everything-store");
  await open(harness);

  // What the store has drawn for a page nobody scrolled: twelve results and the
  // three advertisements among them. The other four results and the last
  // advertisement are behind the sentinel under the twelfth card.
  const drawn = await cardCount(harness);
  expect(drawn, "the store draws part of its first page and loads the rest on scroll").toBe(15);

  const structure = await detect(harness);
  const request = requestFrom(structure);
  const mark = fieldLabelled(structure, "data-ad-id");
  expect(mark.coverage, "the ad mark is on some cards and not others").toBeLessThan(1);

  // The read the instruction asks for: every product on the first page, leaving
  // out the sponsored placements. Sixteen, not twelve -- and the test has not
  // touched the page, so every scroll that happened was the read's own.
  const reply = await harness.runAction({
    commandId: "complete-organic",
    actionType: "web.dom.extract_list",
    extractList: { ...request, where: [{ field: mark.key, is: "absent" }], minItems: 16 }
  });
  expect(reply.status, JSON.stringify(reply.validation)).toBe("succeeded");
  expect(reply.extraction?.recordCount, "the whole first page of results").toBe(16);
  expect(reply.validation?.status, JSON.stringify(reply.validation)).toBe("passed");
  const rows = (reply.extracted ?? []) as Row[];
  expect(rows.every((row) => row[mark.key] === null), "no row kept carries the ad mark").toBe(true);

  // And the page itself now holds what it was hiding, which is where those four
  // rows came from: the read revealed the end of the list, nothing else did.
  expect(await cardCount(harness), "the store loaded the rest of its first page").toBe(20);
});

test("a read that is told an empty answer is possible still returns the whole list", async ({ openHarness }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("everything-store");
  await open(harness);
  const structure = await detect(harness);

  // `minItems: 0` is the picker preview's contract and what a model wrote on the
  // first Flow built after the render wait landed. It says an empty list is a
  // valid answer; it does not say to read half of one.
  const reply = await harness.runAction({
    commandId: "complete-min-zero",
    actionType: "web.dom.extract_list",
    extractList: { ...requestFrom(structure), minItems: 0 }
  });
  expect(reply.status, JSON.stringify(reply.validation)).toBe("succeeded");
  expect(reply.extraction?.recordCount, "every card of the run, the advertisements included").toBe(20);
});

test("a bound the plan writes over a column it renamed is resolved into the column's own read and applied to the page", async ({ openHarness }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("everything-store");
  await open(harness);

  const dispatched: Array<{ actionType: string; parameters: JsonObject; recordCount: number | undefined; records: Row[] }> = [];
  let command = 0;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.live-browser"],
    structureDetectionSessionIds: () => ["session.live-browser"],
    executeAction: async (_sessionId, request) => {
      const reply = await harness.runAction({
        commandId: `list-completeness.${++command}`,
        actionType: request.actionType,
        ...request.parameters
      } as Parameters<typeof harness.runAction>[0]);
      dispatched.push({
        actionType: request.actionType,
        parameters: request.parameters,
        recordCount: reply.extraction?.recordCount,
        records: (reply.extracted ?? []) as Row[]
      });
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
  const columns = packet.fields.filter((field) => field.coverage >= 1).map((field) => field.key);

  // What the plan does first: keep the columns it wants, under its own names.
  // `column1`, `column2` ... is the shape of a rename and carries no meaning of
  // its own, which is the point -- the detected key is what the resolver knew
  // and the plan's key is what it did not.
  const renamed = Object.fromEntries(columns.map((key, index) => [`column${index + 1}`, key]));
  const read = await runtime.executeTool({
    ...BASE,
    callId: "call.read",
    toolId: WEB_LLM_RUN_NODE_TOOL_ID,
    value: { node: EXTRACT_LIST_NODE, parameters: { extractList: { handle: packet.extraction, fields: renamed, paginate: false } }, consequences: [] }
  });
  expect(read.resultCode, JSON.stringify(read.evidence)).toBe("web.inspect.succeeded");
  const every = dispatched.filter((entry) => entry.actionType === "web.dom.extract_list").at(-1);
  expect(every?.recordCount, "every card of the run").toBe(20);

  // A column of numbers the page wrote for a person, and a bound that keeps
  // some of its rows and not others: the store's own values decide both, so the
  // count below is read off the page rather than written into the test.
  const rows = every?.records ?? [];
  const measured = Object.keys(renamed).find((key) => {
    const numbers = rows.map((row) => numberIn(row[key]));
    return numbers.every((number) => Number.isFinite(number)) && new Set(numbers).size > 2;
  });
  expect(measured, `a column of numbers was kept: ${Object.keys(renamed).join(", ")}`).toBeTruthy();
  if (measured === undefined) throw new Error("no numeric column");
  const numbers = rows.map((row) => numberIn(row[measured]));
  // A value the column actually takes, above its lowest, so the bound is one
  // some of the store's own rows fail and others pass.
  const distinct = [...new Set(numbers)].sort((left, right) => left - right);
  const bound = distinct[Math.floor(distinct.length / 2)] ?? 0;
  const wanted = numbers.filter((number) => number >= bound).length;
  expect(wanted, "the bound keeps some rows and not others").toBeGreaterThan(0);
  expect(wanted, "the bound keeps some rows and not others").toBeLessThan(rows.length);

  // And now the sentence the campaign never got to write: what it wants of the
  // column, in the name it gave that column two lines above.
  const bounded = await runtime.executeTool({
    ...BASE,
    callId: "call.bounded",
    toolId: WEB_LLM_RUN_NODE_TOOL_ID,
    value: {
      node: EXTRACT_LIST_NODE,
      parameters: { extractList: { handle: packet.extraction, fields: renamed, where: [{ field: measured, atLeast: bound }], paginate: false, minItems: 0 } },
      consequences: []
    }
  });
  expect(bounded.resultCode, JSON.stringify(bounded.evidence)).toBe("web.inspect.succeeded");

  // What went out is a literal request the page can run, with the condition
  // resolved into the column's own spec: the saved Flow needs no handle, no
  // detection and no field map to read the same rows again.
  const sent = dispatched.filter((entry) => entry.actionType === "web.dom.extract_list").at(-1);
  const request = sent?.parameters.extractList as unknown as WebAutomationExtractListRequest;
  expect(request.where?.length).toBe(1);
  expect(request.where?.[0]?.atLeast).toBe(bound);
  expect(request.where?.[0]?.field, "the resolved condition carries the column, not a reference to the table's fields").toBeUndefined();
  expect(request.where?.[0]?.read, "the column the plan named under its own key").toBeTruthy();
  expect(sent?.recordCount, "the rows the bound keeps, as the store's own values say").toBe(wanted);
  expect((sent?.records ?? []).every((row) => numberIn(row[measured]) >= bound), "every row kept satisfies the bound").toBe(true);
});
