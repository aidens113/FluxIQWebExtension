// T1 coverage of the extract-list verb's account of its own read (C2): the
// summary rides beside the records, names the declared field keys with
// excluded fields left out (D12), and survives the domain's wire copy, which
// drops a whole summary whose missing fields are not among its field names.
//
// The verb takes every page capability as an injected dependency, so this runs
// in Node with no DOM. Reading real pages, and the summary on a real reply, are
// proven by `e2e/content/tests/extract-list.spec.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationActionResultPayload } from "@fluxiq-web-extension/domain/client";
import { extractListAction } from "../extract-list";
import type { ActionResultEvidence } from "../../action-runtime";
import type { ListExtractionOutcome } from "../../extraction";
import type { ContentActionDependencies } from "../types";
import type { BrowserActionCommand, BrowserActionResult, BrowserActionValidation, WebAutomationExtractListRequest } from "../../types";

type Recorded =
  | { builder: "success" | "timedOut"; validation: BrowserActionValidation; evidence: ActionResultEvidence | undefined }
  | { builder: "failure"; error: unknown };

/** Four declared fields: two in the string grammar, one included spec, and one excluded spec that is never read. */
const REQUEST: WebAutomationExtractListRequest = {
  item: ".row",
  fields: {
    name: ".name",
    notes: { kind: "text", selector: ".notes", handling: "exclude" },
    price: { kind: "text", selector: ".price", handling: "include" },
    sku: ".sku"
  }
};

const COMMAND: BrowserActionCommand = { commandId: "cmd-extract-list", actionType: "web.dom.extract_list", extractList: REQUEST };

/** Dependencies whose list capability answers with `read` and whose result builders record what they were handed. */
function dependencies(read: ListExtractionOutcome | Error): { deps: ContentActionDependencies; calls: Recorded[] } {
  const calls: Recorded[] = [];
  const built = (status: BrowserActionResult["status"]): BrowserActionResult => ({
    commandId: COMMAND.commandId,
    actionType: COMMAND.actionType,
    status,
    validation: { status: "none", reason: "evidence-only" },
    startedAt: 1,
    finishedAt: 2
  });
  const provided: Partial<ContentActionDependencies> = {
    extractList: async () => {
      if (read instanceof Error) throw read;
      return read;
    },
    captureSnapshot: () => ({
      url: "https://example.test/",
      title: "Example",
      viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 },
      interactiveElements: []
    }),
    success: (_action, _startedAt, _message, validation, evidence) => {
      calls.push({ builder: "success", validation, evidence });
      return built("succeeded");
    },
    timedOut: (_action, _startedAt, _message, validation, evidence) => {
      calls.push({ builder: "timedOut", validation, evidence });
      return built("timed_out");
    },
    failure: (_action, error) => {
      calls.push({ builder: "failure", error });
      return built("failed");
    }
  };
  const deps = new Proxy(provided as ContentActionDependencies, {
    get(target, property: string | symbol) {
      const found = (target as unknown as Record<string | symbol, unknown>)[property];
      if (found !== undefined || typeof property === "symbol") return found;
      return () => {
        throw new Error(`the extract-list verb reached an unexpected capability: ${property}`);
      };
    }
  });
  return { deps, calls };
}

/** The summary as the domain copies it onto the wire. */
function wireSummary(validation: BrowserActionValidation, evidence: ActionResultEvidence | undefined): unknown {
  return webAutomationActionResultPayload({
    commandId: COMMAND.commandId,
    actionType: COMMAND.actionType,
    status: "succeeded",
    validation,
    ...(evidence?.extraction ? { extraction: evidence.extraction } : {}),
    startedAt: 1,
    finishedAt: 2
  }).extraction;
}

test("the summary counts the read and names the declared fields, excluded ones left out", async () => {
  const outcome: ListExtractionOutcome = {
    records: [{ name: "Lamp", price: "$49.00" }, { name: "Mug" }],
    pagesRead: 2,
    truncated: true,
    timedOut: false,
    missingFields: ["price", "sku"],
    filtered: 0
  };
  const { deps, calls } = dependencies(outcome);
  await extractListAction(COMMAND, deps, 1);

  assert.equal(calls.length, 1);
  const [call] = calls;
  assert.equal(call?.builder, "success");
  if (call?.builder !== "success") return;
  const summary = { recordCount: 2, pagesRead: 2, truncated: true, missingFields: ["price", "sku"], fieldNames: ["name", "price", "sku"] };
  assert.deepEqual(call.evidence?.extraction, summary);
  assert.equal(call.evidence?.extracted, outcome.records);
  // The validation names the same fields: an excluded column is not one a record must carry.
  assert.equal(call.validation.status === "failed" && call.validation.expected, "at least 1 record, each carrying name, price, sku");
  // Every missing field is one of the field names, so the wire copy keeps the summary whole.
  assert.deepEqual(wireSummary(call.validation, call.evidence), summary);
});

test("a string-grammar request's field names are its keys in declaration order, and a clean read misses none", async () => {
  const request: WebAutomationExtractListRequest = { item: ".row", fields: { url: "a@href", name: "", price: "column:Price" } };
  const { deps, calls } = dependencies({ records: [{ url: "/a", name: "A", price: "1" }], pagesRead: 1, truncated: false, timedOut: false, missingFields: [], filtered: 0 });
  await extractListAction({ ...COMMAND, extractList: request }, deps, 1);

  const [call] = calls;
  assert.equal(call?.builder, "success");
  if (call?.builder !== "success") return;
  const summary = { recordCount: 1, pagesRead: 1, truncated: false, missingFields: [], fieldNames: ["url", "name", "price"] };
  assert.deepEqual(call.evidence?.extraction, summary);
  assert.deepEqual(wireSummary(call.validation, call.evidence), summary);
});

test("an optional field's null rides in the records to the wire, and fails nothing", async () => {
  const request: WebAutomationExtractListRequest = { item: ".row", fields: { name: ".name", rating: { kind: "text", selector: ".rating", required: false } } };
  const records = [{ name: "Lamp", rating: null }, { name: "Mug", rating: "4.8 out of 5" }];
  const { deps, calls } = dependencies({ records, pagesRead: 1, truncated: false, timedOut: false, missingFields: [], filtered: 0 });
  await extractListAction({ ...COMMAND, extractList: request }, deps, 1);

  const [call] = calls;
  assert.equal(call?.builder, "success");
  if (call?.builder !== "success") return;
  assert.equal(call.validation.status, "passed");
  assert.deepEqual(call.evidence?.extracted, records);
  assert.deepEqual(call.evidence?.extraction?.fieldNames, ["name", "rating"]);
  const wire = webAutomationActionResultPayload({
    commandId: COMMAND.commandId,
    actionType: COMMAND.actionType,
    status: "succeeded",
    validation: call.validation,
    ...(call.evidence?.extracted === undefined ? {} : { extracted: call.evidence.extracted }),
    startedAt: 1,
    finishedAt: 2
  });
  assert.deepEqual(wire.extracted, records);
});

test("a read that ran out of time carries its summary beside the records it read", async () => {
  const outcome: ListExtractionOutcome = { records: [{ name: "Lamp", price: "$49.00", sku: "L-1" }], pagesRead: 1, truncated: false, timedOut: true, missingFields: [], filtered: 0 };
  const { deps, calls } = dependencies(outcome);
  await extractListAction(COMMAND, deps, 1);

  assert.equal(calls.length, 1);
  const [call] = calls;
  assert.equal(call?.builder, "timedOut");
  if (call?.builder !== "timedOut") return;
  assert.deepEqual(call.evidence?.extraction, { recordCount: 1, pagesRead: 1, truncated: false, missingFields: [], fieldNames: ["name", "price", "sku"] });
  assert.equal(call.evidence?.extracted, outcome.records);
});

test("a read the capability refused reports the refusal and no summary", async () => {
  const refused = new Error("refused");
  const { deps, calls } = dependencies(refused);
  await extractListAction(COMMAND, deps, 1);

  assert.deepEqual(calls, [{ builder: "failure", error: refused }]);
});
