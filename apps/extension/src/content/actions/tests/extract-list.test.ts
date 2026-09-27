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

test("a filtered read reports what its conditions did, in counts, and how many items they left out", async () => {
  const outcome: ListExtractionOutcome = {
    records: [{ name: "Lamp", price: "$49.00", sku: "L-1" }],
    pagesRead: 1,
    truncated: false,
    timedOut: false,
    missingFields: [],
    filtered: 3,
    conditions: { applied: 4, kept: 1, rejected: [2, 1], unfiltered: false }
  };
  const { deps, calls } = dependencies(outcome);
  await extractListAction(COMMAND, deps, 1);

  const [call] = calls;
  assert.equal(call?.builder, "success");
  if (call?.builder !== "success") return;
  const summary = {
    recordCount: 1,
    pagesRead: 1,
    truncated: false,
    missingFields: [],
    fieldNames: ["name", "price", "sku"],
    conditions: { applied: 4, kept: 1, rejected: [2, 1], unfiltered: false }
  };
  assert.deepEqual(call.evidence?.extraction, summary);
  // The counts survive the domain's wire copy, which is what puts them in front
  // of the judgement and the repair rather than only in the page.
  assert.deepEqual(wireSummary(call.validation, call.evidence), summary);
  assert.equal(call.validation.status, "passed");
  assert.match(call.validation.status === "passed" ? call.validation.actual : "", /1 record from 1 page, 3 items left out by where/u);
});

test("a read its conditions emptied says so, names the condition that did it, and still carries the rows", async () => {
  // The 2026-09-24 failure, as the verb now reports it: the conditions rejected
  // every item, so the read answered with the rows they rejected rather than
  // with none (`run-mug3tnti-9ab80b85` answered with none, and nothing could
  // tell that from a page that held nothing).
  const outcome: ListExtractionOutcome = {
    records: [{ name: "Lamp", price: "$49.00", sku: "L-1" }, { name: "Mug", price: "$8.00", sku: "M-1" }],
    pagesRead: 1,
    truncated: false,
    timedOut: false,
    missingFields: [],
    filtered: 2,
    conditions: { applied: 2, kept: 0, rejected: [0, 2], unfiltered: true }
  };
  const { deps, calls } = dependencies(outcome);
  await extractListAction(COMMAND, deps, 1);

  const [call] = calls;
  assert.equal(call?.builder, "success");
  if (call?.builder !== "success") return;
  // The rows are there, so a too-wide answer is what the judgement sees rather
  // than an empty table it would read as legitimate.
  assert.equal(call.evidence?.extracted, outcome.records);
  const wire = wireSummary(call.validation, call.evidence) as { conditions?: unknown };
  assert.deepEqual(wire.conditions, { applied: 2, kept: 0, rejected: [0, 2], unfiltered: true });
  // And the prose says which condition emptied it, so a repair can act rather
  // than guess among the conditions the model wrote.
  const actual = call.validation.status === "passed" ? call.validation.actual : "";
  assert.match(actual, /where kept none of the 2 items/u);
  assert.match(actual, /returned unfiltered; where\[1\] rejected every one/u);
  assert.match(actual, /narrow the conditions rather than trusting these rows/u);
});

test("a read emptied by its conditions together says that no one condition did it", async () => {
  const outcome: ListExtractionOutcome = {
    records: [{ name: "Lamp", price: "$49.00", sku: "L-1" }],
    pagesRead: 1,
    truncated: false,
    timedOut: false,
    missingFields: [],
    filtered: 2,
    conditions: { applied: 2, kept: 0, rejected: [1, 1], unfiltered: true }
  };
  const { deps, calls } = dependencies(outcome);
  await extractListAction(COMMAND, deps, 1);

  const [call] = calls;
  assert.equal(call?.builder, "success");
  if (call?.builder !== "success") return;
  assert.match(
    call.validation.status === "passed" ? call.validation.actual : "",
    /no one condition rejected them all, so it was the conditions together/u
  );
});

test("three rows short of a column do not destroy the forty that have it: the read passes and states the gap", async () => {
  // The measured defect. Before 2026-09-26 every string-grammar field was
  // required, so `missingFields: ["rating"]` failed the verb, Core saw
  // `output_not_observed`, and forty good rows were stored as nothing. Nothing is
  // required now unless the author said so, so the rows come back -- and the read
  // has to say what is missing from them, or a wide answer with a hole reads as a
  // complete one.
  const rows = Array.from({ length: 43 }, (_, index) => ({
    name: `Item ${index}`,
    price: "$49.00",
    sku: index < 40 ? `S-${index}` : null
  }));
  const outcome: ListExtractionOutcome = {
    records: rows,
    pagesRead: 1,
    truncated: false,
    timedOut: false,
    listPresence: "appeared",
    itemsSeen: 43,
    blankFields: ["sku"],
    incompleteRecords: 3,
    emptyRecords: 0,
    missingFields: [],
    filtered: 0
  };
  const { deps, calls } = dependencies(outcome);
  await extractListAction(COMMAND, deps, 1);

  const [call] = calls;
  assert.equal(call?.builder, "success");
  if (call?.builder !== "success") return;
  assert.equal(call.validation.status, "passed", "a column some rows had nothing in is not a shortfall");
  // Every row is returned, the blank cells included.
  assert.equal((call.evidence?.extracted as unknown[]).length, 43);
  const actual = call.validation.status === "passed" ? call.validation.actual : "";
  assert.match(actual, /^43 records from 1 page; 3 records short of a declared field, blank in sku$/u);
  // Counts and declared keys only: no page text rides out on the phrase.
  assert.ok(!actual.includes("Item 0"), actual);
});

test("an explicitly required field still means what it says", async () => {
  // The default moved; the capability did not. A Flow that writes
  // `required: true` still fails the post-condition when a record lacks the
  // field, and the gap is stated beside the shortfall rather than instead of it.
  const request: WebAutomationExtractListRequest = {
    item: ".row",
    fields: { name: ".name", sku: { kind: "text", selector: ".sku", required: true } }
  };
  const outcome: ListExtractionOutcome = {
    records: [{ name: "Lamp" }, { name: "Mug", sku: "M-1" }],
    pagesRead: 1,
    truncated: false,
    timedOut: false,
    listPresence: "appeared",
    itemsSeen: 2,
    blankFields: [],
    incompleteRecords: 1,
    emptyRecords: 0,
    missingFields: ["sku"],
    filtered: 0
  };
  const { deps, calls } = dependencies(outcome);
  await extractListAction({ ...COMMAND, extractList: request }, deps, 1);

  const [call] = calls;
  assert.equal(call?.builder, "success");
  if (call?.builder !== "success") return;
  assert.equal(call.validation.status, "failed");
  const actual = call.validation.status === "failed" ? call.validation.actual : "";
  assert.match(actual, /required fields missing from some records: sku/u);
  assert.match(actual, /1 record short of a declared field/u);
});

test("the two halves of a zero read are told apart by itemsSeen, not by a duration", async () => {
  // t142's count, produced at last. The wait's `listPresence` says whether the
  // selector ever named anything; `itemsSeen` says how much, which is what
  // separates "the selector matched nothing" from "it matched the rows and every
  // field was read off the wrong element". Those are different repairs and, until
  // these counts, an identical `recordCount: 0`.
  const matchedNothing: ListExtractionOutcome = {
    records: [],
    pagesRead: 1,
    truncated: false,
    timedOut: false,
    listPresence: "never_appeared",
    itemsSeen: 0,
    blankFields: [],
    incompleteRecords: 0,
    emptyRecords: 0,
    missingFields: [],
    filtered: 0
  };
  const nothingRead: ListExtractionOutcome = {
    records: [{ name: null, price: null, sku: null }, { name: null, price: null, sku: null }],
    pagesRead: 1,
    truncated: false,
    timedOut: false,
    listPresence: "appeared",
    itemsSeen: 2,
    blankFields: ["name", "price", "sku"],
    incompleteRecords: 2,
    emptyRecords: 2,
    missingFields: [],
    filtered: 0
  };

  const first = dependencies(matchedNothing);
  await extractListAction(COMMAND, first.deps, 1);
  const firstCall = first.calls[0];
  assert.equal(firstCall?.builder, "success");
  if (firstCall?.builder !== "success") return;
  assert.deepEqual(wireSummary(firstCall.validation, firstCall.evidence), {
    recordCount: 0,
    pagesRead: 1,
    truncated: false,
    missingFields: [],
    fieldNames: ["name", "price", "sku"],
    itemsSeen: 0,
    emptyRecords: 0,
    listPresence: "never_appeared"
  });

  const second = dependencies(nothingRead);
  await extractListAction(COMMAND, second.deps, 1);
  const secondCall = second.calls[0];
  assert.equal(secondCall?.builder, "success");
  if (secondCall?.builder !== "success") return;
  assert.deepEqual(wireSummary(secondCall.validation, secondCall.evidence), {
    recordCount: 2,
    pagesRead: 1,
    truncated: false,
    missingFields: [],
    fieldNames: ["name", "price", "sku"],
    itemsSeen: 2,
    emptyRecords: 2,
    listPresence: "appeared"
  });
  // And the phrase says the second one in words, because "two records" with three
  // null columns is the answer that looks most like a working read.
  const actual = secondCall.validation.status === "passed" ? secondCall.validation.actual : "";
  assert.match(actual, /every returned record is empty, so the fields were read off the wrong element/u);
});

test("a read the capability refused reports the refusal and no summary", async () => {
  const refused = new Error("refused");
  const { deps, calls } = dependencies(refused);
  await extractListAction(COMMAND, deps, 1);

  assert.deepEqual(calls, [{ builder: "failure", error: refused }]);
});

test("a read whose item selector named nothing says the list never appeared, and still succeeds", async () => {
  // The defect `run-muhnh0s5-98a27f42` paid for six times over: the selector
  // named nothing, the wait ran out, the read answered `succeeded` with zero
  // records, and nothing in the reply told the model that from a page that had
  // nothing on it. The verb now says which of the two it was.
  const outcome: ListExtractionOutcome = {
    records: [],
    pagesRead: 1,
    truncated: false,
    timedOut: false,
    listPresence: "never_appeared",
    missingFields: [],
    filtered: 0
  };
  const { deps, calls } = dependencies(outcome);
  await extractListAction(COMMAND, deps, 1);

  const [call] = calls;
  // A fact on a successful read, not a refusal and not a failed action: the
  // builder is still `success`, as it is for a page that legitimately held
  // nothing.
  assert.equal(call?.builder, "success");
  if (call?.builder !== "success") return;
  const summary = {
    recordCount: 0,
    pagesRead: 1,
    truncated: false,
    missingFields: [],
    fieldNames: ["name", "price", "sku"],
    listPresence: "never_appeared"
  };
  assert.deepEqual(call.evidence?.extraction, summary);
  // And it survives the domain's wire copy, which is what puts it in front of
  // the build and the repair rather than only in the page.
  assert.deepEqual(wireSummary(call.validation, call.evidence), summary);
  // `minItems` defaults to 1, so zero records still fails the post-condition --
  // unchanged by this. What changed is that the phrase says why.
  assert.equal(call.validation.status, "failed");
  const actual = call.validation.status === "failed" ? call.validation.actual : "";
  assert.match(actual, /0 records from 1 page; the item selector named nothing on the page, so the list never appeared/u);
  assert.match(actual, /change the selector rather than the fields or the conditions/u);
  // Counts and closed words only: nothing the page held rides out on it.
  assert.ok(!actual.includes(".row"), `the selector itself must not be quoted back: ${actual}`);
});

test("a read that waited and found nothing says what it waited for, how long, and what ended the wait", async () => {
  // Four live reads of `everything-store-plus-earbuds-under-50` ended at 2089,
  // 2576, 2109 and 2082 ms with zero records because the wait took two seconds
  // of page stillness for evidence that the list was not coming. Establishing
  // that took a day of matching durations against constants, because the reply
  // said only that a wait had happened. The account is so the next one is read
  // rather than reconstructed: the phrase names the same facts the wait acted on.
  const outcome: ListExtractionOutcome = {
    records: [],
    pagesRead: 1,
    truncated: false,
    timedOut: false,
    listPresence: "never_appeared",
    listWait: { presence: "never_appeared", stoppedOn: "window_elapsed", waitedMs: 10_004, waitedFor: 1 },
    missingFields: [],
    filtered: 0
  };
  const { deps, calls } = dependencies(outcome);
  await extractListAction(COMMAND, deps, 1);

  const [call] = calls;
  assert.equal(call?.builder, "success");
  if (call?.builder !== "success") return;
  const actual = call.validation.status === "failed" ? call.validation.actual : "";
  assert.match(actual, /the list never appeared, after waiting 10004ms for 1 item and stopping on the read's own render window running out/u);
  // And the same three facts as declared fields, because the phrase is what a
  // model reads and the field is what a scan counts. The presence is not repeated
  // inside `listWait`: one fact, one field.
  assert.deepEqual(wireSummary(call.validation, call.evidence), {
    recordCount: 0,
    pagesRead: 1,
    truncated: false,
    missingFields: [],
    fieldNames: ["name", "price", "sku"],
    listPresence: "never_appeared",
    listWait: { stoppedOn: "window_elapsed", waitedMs: 10_004, waitedFor: 1 }
  });
});

test("a wait that gave up on the page holding still is a distinct word, so the 2026-09-25 shape is recognisable if it ever returns", async () => {
  // `page_settled` is unreachable for a read of zero records now (see
  // `extraction/page-render.ts`), which is exactly why the phrase must be able
  // to say it: a bundle carrying this pair again would name the regression
  // rather than leaving it to be inferred from a duration.
  const outcome: ListExtractionOutcome = {
    records: [],
    pagesRead: 1,
    truncated: false,
    timedOut: false,
    listPresence: "never_appeared",
    listWait: { presence: "never_appeared", stoppedOn: "page_settled", waitedMs: 2_023, waitedFor: 1 },
    missingFields: [],
    filtered: 0
  };
  const { deps, calls } = dependencies(outcome);
  await extractListAction(COMMAND, deps, 1);

  const [call] = calls;
  assert.equal(call?.builder, "success");
  if (call?.builder !== "success") return;
  const actual = call.validation.status === "failed" ? call.validation.actual : "";
  assert.match(actual, /after waiting 2023ms for 1 item and stopping on the page holding still with the list already part drawn/u);
  // And as a field, which is the half a scan can use: the live signature that
  // took a day to establish is `stoppedOn: "page_settled"` beside
  // `recordCount: 0`, and both are now groupable on the wire.
  const wire = wireSummary(call.validation, call.evidence) as { recordCount?: unknown; listWait?: { stoppedOn?: unknown; waitedMs?: unknown } };
  assert.equal(wire.recordCount, 0);
  assert.equal(wire.listWait?.stoppedOn, "page_settled");
  assert.equal(wire.listWait?.waitedMs, 2_023);
});

test("the two ways a wait can end are told apart by a field, not by reading a duration against a constant", async () => {
  // The distinction t143 had to compute: four zero reads at 2089, 2576, 2109 and
  // 2082 ms against reads that succeeded at 255 ms and at 4.6 to 14.3 s, matched
  // by hand against a 2000 ms constant. Both stops now name themselves, and
  // nothing about which one it was has to be inferred from `waitedMs`.
  const wait = async (stoppedOn: "page_settled" | "list_present", waitedMs: number, records: ListExtractionOutcome["records"]) => {
    const outcome: ListExtractionOutcome = {
      records,
      pagesRead: 1,
      truncated: false,
      timedOut: false,
      listPresence: records.length > 0 ? "appeared" : "never_appeared",
      listWait: { presence: records.length > 0 ? "appeared" : "never_appeared", stoppedOn, waitedMs, waitedFor: 1 },
      itemsSeen: records.length,
      blankFields: [],
      incompleteRecords: 0,
      emptyRecords: 0,
      missingFields: [],
      filtered: 0
    };
    const { deps, calls } = dependencies(outcome);
    await extractListAction(COMMAND, deps, 1);
    const [call] = calls;
    assert.equal(call?.builder, "success");
    if (call?.builder !== "success") throw new Error("the verb did not answer");
    return wireSummary(call.validation, call.evidence) as { itemsSeen?: unknown; listWait?: { stoppedOn?: unknown } };
  };

  const gaveUp = await wait("page_settled", 2_023, []);
  const found = await wait("list_present", 4_024, [{ name: "Lamp", price: "$49.00", sku: "L-1" }]);
  assert.equal(gaveUp.listWait?.stoppedOn, "page_settled");
  assert.equal(found.listWait?.stoppedOn, "list_present");
  assert.notEqual(gaveUp.listWait?.stoppedOn, found.listWait?.stoppedOn);
  // Both survive the domain's copy whole, which is what puts them in front of the
  // build and the repair rather than only in the page. `itemsSeen` rides with
  // them, so the two halves of a zero read stay separable.
  assert.equal(gaveUp.itemsSeen, 0);
  assert.equal(found.itemsSeen, 1);
});

test("a continued read's item count is the whole read's, so a paginated read never understates what its selector matched", async () => {
  // The page counts items across every document (`extraction/list-reader.ts`);
  // this is the verb's side of it. `recordCount` and `pagesRead` are the whole
  // read's, so an item count that meant only the last document would read as the
  // selector having matched fewer items than it did -- and `itemsSeen` below
  // `recordCount` is exactly the shape that says "the fields were read off the
  // wrong element", which is a different repair.
  const records = Array.from({ length: 12 }, (_, index) => ({ name: `Item ${index}`, price: "$1.00", sku: `S-${index}` }));
  const outcome: ListExtractionOutcome = {
    records,
    pagesRead: 3,
    truncated: false,
    timedOut: false,
    itemsSeen: 12,
    blankFields: [],
    incompleteRecords: 0,
    emptyRecords: 0,
    missingFields: [],
    filtered: 0
  };
  const { deps, calls } = dependencies(outcome);
  await extractListAction(COMMAND, deps, 1);

  const [call] = calls;
  assert.equal(call?.builder, "success");
  if (call?.builder !== "success") return;
  const wire = wireSummary(call.validation, call.evidence) as { itemsSeen?: unknown; recordCount?: unknown; listPresence?: unknown };
  assert.equal(wire.itemsSeen, 12, "the count is the read's, not the last document's four");
  assert.equal(wire.recordCount, 12);
  // A continued read waited for its predecessor's page rather than for a list, so
  // it has no presence and no wait account to give -- and that absence must not be
  // confused with a count it could not carry.
  assert.equal("listPresence" in wire, false);
  assert.equal("listWait" in wire, false);
});

test("a page that really held nothing is a read that appeared, and reads as an empty page", async () => {
  const outcome: ListExtractionOutcome = {
    records: [],
    pagesRead: 1,
    truncated: false,
    timedOut: false,
    listPresence: "appeared",
    missingFields: [],
    filtered: 0
  };
  const { deps, calls } = dependencies(outcome);
  await extractListAction(COMMAND, deps, 1);

  const [call] = calls;
  assert.equal(call?.builder, "success");
  if (call?.builder !== "success") return;
  assert.deepEqual(call.evidence?.extraction, {
    recordCount: 0,
    pagesRead: 1,
    truncated: false,
    missingFields: [],
    fieldNames: ["name", "price", "sku"],
    listPresence: "appeared"
  });
  const actual = call.validation.status === "failed" ? call.validation.actual : "";
  assert.doesNotMatch(actual, /never appeared/u);
});

test("a read its conditions emptied is unchanged: its list appeared, and the conditions still have the phrase", async () => {
  const outcome: ListExtractionOutcome = {
    records: [{ name: "Lamp", price: "$49.00", sku: "L-1" }, { name: "Mug", price: "$8.00", sku: "M-1" }],
    pagesRead: 1,
    truncated: false,
    timedOut: false,
    listPresence: "appeared",
    missingFields: [],
    filtered: 2,
    conditions: { applied: 2, kept: 0, rejected: [0, 2], unfiltered: true }
  };
  const { deps, calls } = dependencies(outcome);
  await extractListAction(COMMAND, deps, 1);

  const [call] = calls;
  assert.equal(call?.builder, "success");
  if (call?.builder !== "success") return;
  const wire = wireSummary(call.validation, call.evidence) as { listPresence?: unknown; conditions?: unknown };
  assert.equal(wire.listPresence, "appeared");
  assert.deepEqual(wire.conditions, { applied: 2, kept: 0, rejected: [0, 2], unfiltered: true });
  // The condition phrase is the one this read needs, and the list phrase does
  // not displace it: the items were there, the conditions turned them down.
  const actual = call.validation.status === "passed" ? call.validation.actual : "";
  assert.match(actual, /where kept none of the 2 items/u);
  assert.doesNotMatch(actual, /never appeared/u);
});

/**
 * A read the page faulted under still answers, and says what it could not get.
 *
 * Until 2026-09-26 the reader's row loop had no catch at all: one recycled or
 * detached element -- what a virtualized list does to a read as a matter of
 * course -- threw out of `extractList`, the verb's own catch reported
 * `deps.failure`, and **every row already read was discarded**. That is the
 * total-instead-of-partial failure this repository has paid for repeatedly, and
 * the two rows below are the pair: the failure path is what the throw used to
 * take, and the partial path is what it takes now.
 */
test("a read whose rows the page faulted on returns the rows it got, naming the ones it skipped", async () => {
  const outcome: ListExtractionOutcome = {
    records: [{ name: "Lamp", price: "$49.00" }, { name: "Mug", price: "$9.00" }],
    pagesRead: 3,
    truncated: false,
    timedOut: false,
    missingFields: [],
    filtered: 0,
    itemFaults: 4,
    pageFault: true
  };
  const { deps, calls } = dependencies(outcome);
  await extractListAction(COMMAND, deps, 1);

  const [call] = calls;
  assert.equal(call?.builder, "success", "a faulted read must not be a failure while it has rows");
  assert.equal(call.builder === "success" ? call.evidence?.extracted : undefined, outcome.records);
  const actual = call.validation.status === "none" ? "" : call.validation.actual;
  assert.match(actual, /4 items could not be read and were skipped/u);
  assert.match(actual, /the move to the next page failed, so the read ends with the pages it has/u);
});

test("a read that faulted nowhere says nothing about faults, so the phrase is unchanged", async () => {
  const outcome: ListExtractionOutcome = {
    records: [{ name: "Lamp", price: "$49.00" }],
    pagesRead: 1,
    truncated: false,
    timedOut: false,
    missingFields: [],
    filtered: 0
  };
  const { calls, deps } = dependencies(outcome);
  await extractListAction(COMMAND, deps, 1);
  const [call] = calls;
  const actual = call?.builder === "failure" || call?.validation.status === "none" ? "" : call?.validation.actual ?? "";
  assert.doesNotMatch(actual, /could not be read|move to the next page/u);
});

test("a read that threw before it had anything is still a failure, because there is no partial answer to give", async () => {
  const { deps, calls } = dependencies(new Error("the document was replaced"));
  await extractListAction(COMMAND, deps, 1);
  assert.equal(calls[0]?.builder, "failure");
});
