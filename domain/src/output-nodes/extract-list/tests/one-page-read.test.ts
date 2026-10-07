// A Flow's list read reads one page (read-list redesign S4, contract C3).
//
// Pages are the Flow's: a Next page step and a repeat go through them, and the
// run's dataset collects what each pass read. So what used to work over every
// page one read followed -- `dedupe`, `sort`, `maxItems`, `minItems` -- now
// works over every row the run collects, and leaves the page request for the
// record output's `process`. A read that still says it goes through pages by
// itself is refused before anything runs, never quietly cut to one page.

import assert from "node:assert/strict";
import test from "node:test";
import { parseAutomationStudioRecordOutput } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS, webAutomationExtractListRequestValue } from "../../../actions/extraction";
import { webAutomationExtractListAloneRowsAsked, webAutomationExtractListDispatch } from "../dispatch";

const read = {
  item: "li.job",
  fields: { title: ".title", company: ".company", posted: ".posted", url: "a@href" },
  where: [{ field: "title", contains: "engineer" }]
};

const ordered = {
  ...read,
  dedupe: { by: ["title", "company"] },
  sort: [{ field: "posted", order: "desc", as: "date" }],
  maxItems: 25,
  minItems: 3
};

const authored = {
  datasetId: "roles",
  label: "Roles",
  writeMode: "append",
  schema: {
    schemaVersion: "0.1",
    fields: [
      { id: "title", label: "Title", valueType: "string", required: true },
      { id: "company", label: "Company", valueType: "string", required: true },
      { id: "posted", label: "Posted", valueType: "string", required: true },
      { id: "url", label: "Link", valueType: "url", required: true }
    ]
  }
};

function sent(parameters: JsonObject): { payload: JsonObject; extractList: JsonObject; recordOutput: JsonObject } {
  const dispatch = webAutomationExtractListDispatch(parameters);
  assert.equal(dispatch.ok, true, JSON.stringify(dispatch));
  if (!dispatch.ok) throw new Error("unreachable");
  const sentParameters = dispatch.payload.parameters as JsonObject;
  return { payload: dispatch.payload, extractList: sentParameters.extractList as JsonObject, recordOutput: dispatch.payload.recordOutput as JsonObject };
}

const RETIRED_MESSAGE = "This step used to go through pages by itself; the Flow now needs a Next page step and a repeat.";

test("a read that goes through more than one page by itself is refused before anything runs", () => {
  for (const paginate of [
    { next: "a.next", maxPages: 5 },
    { mode: "loadMore", control: "button.more", maxPages: 2 },
    { mode: "numbered", pages: "a.page", maxPages: 3 },
    { mode: "scroll", maxScrolls: 4 },
    { mode: "scroll", maxScrolls: 1 },
    // The run the tolerant reader was written for: unreadable, and still more than one page.
    { next: null, maxPages: 5 }
  ]) {
    for (const recordOutput of [undefined, authored]) {
      const dispatch = webAutomationExtractListDispatch({ extractList: { ...read, paginate }, ...(recordOutput ? { recordOutput } : {}) } as JsonObject);
      assert.equal(dispatch.ok, false, JSON.stringify(paginate));
      if (dispatch.ok) continue;
      assert.equal(dispatch.result.status, "failed");
      assert.equal(dispatch.result.route, "failed");
      assert.deepEqual(dispatch.result.effects, []);
      assert.equal(dispatch.result.failure?.code, "web.extract_list.paginate_retired");
      assert.equal(dispatch.result.failure?.stage, "dispatch");
      assert.equal(dispatch.result.failure?.retryable, false);
      assert.deepEqual(dispatch.result.outputs, { error: { code: "web.extract_list.paginate_retired" } });
      assert.equal(dispatch.result.message, RETIRED_MESSAGE);
    }
  }
});

test("a one-page paginate, which is what the picker records, is dropped: it reads the same one page", () => {
  for (const paginate of [{ next: "a.next", maxPages: 1 }, { mode: "loadMore", control: "button.more", maxPages: 1 }, { mode: "numbered", pages: "a.page", maxPages: 1 }]) {
    const { extractList, payload } = sent({ extractList: { ...read, paginate } });
    assert.equal(Object.hasOwn(extractList, "paginate"), false, JSON.stringify(paginate));
    // One page is never scaled: the node's default is the page's own wait.
    assert.equal(payload.timeoutMs, WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS);
    assert.equal((payload.parameters as JsonObject).timeoutMs, WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS);
  }
});

test("dedupe, sort, maxItems and minItems leave the page and land in the derived output's process", () => {
  const { extractList, recordOutput } = sent({ extractList: ordered });
  for (const key of ["dedupe", "sort", "maxItems", "minItems"]) assert.equal(Object.hasOwn(extractList, key), false, key);
  assert.deepEqual(extractList.where, read.where);
  assert.deepEqual(recordOutput.process, {
    dedupe: { by: ["title", "company"] },
    sort: [{ field: "posted", order: "desc", as: "date" }],
    limit: 25,
    minRows: 3
  });
  // The collection's limit is processing's, not the capture's.
  assert.equal(recordOutput.maxRecords, 1_000);
  // Core's own parser takes the whole output, process and all.
  const parsed = parseAutomationStudioRecordOutput(recordOutput);
  assert.equal(parsed.ok, true, JSON.stringify(parsed));
  if (parsed.ok) assert.deepEqual(parsed.output.process, recordOutput.process);
});

test("and in the reconciled output, beside what its author wrote", () => {
  const { extractList, recordOutput } = sent({ extractList: ordered, recordOutput: authored });
  for (const key of ["dedupe", "sort", "maxItems", "minItems"]) assert.equal(Object.hasOwn(extractList, key), false, key);
  assert.equal(recordOutput.datasetId, "roles");
  assert.deepEqual(recordOutput.process, {
    dedupe: { by: ["title", "company"] },
    sort: [{ field: "posted", order: "desc", as: "date" }],
    limit: 25,
    minRows: 3
  });
});

test("a read that says nothing of them sends no process, so Core's whole-row default applies", () => {
  assert.equal(Object.hasOwn(sent({ extractList: read }).recordOutput, "process"), false);
  assert.equal(Object.hasOwn(sent({ extractList: read, recordOutput: authored }).recordOutput, "process"), false);
  // An off dedupe and an empty sort are the example's off values, not a key.
  assert.equal(Object.hasOwn(sent({ extractList: { ...read, dedupe: false, sort: [] } }).recordOutput, "process"), false);
});

test("a minimum of zero stays on the page too, since an absent list is then an answer", () => {
  const { extractList, recordOutput } = sent({ extractList: { ...read, minItems: 0 } });
  assert.equal(extractList.minItems, 0);
  assert.deepEqual(recordOutput.process, { minRows: 0 });
});

test("an authored process is kept, and the read's own members win where both say", () => {
  const { recordOutput } = sent({ extractList: { ...read, maxItems: 10 }, recordOutput: { ...authored, process: { limit: 50, minRows: 2 } } });
  assert.deepEqual(recordOutput.process, { limit: 10, minRows: 2 });
});

test("an authored process Core refuses fails the node before the page is read, with Core's issue codes", () => {
  for (const [process, issue, reads] of [
    [{ limit: 0 }, "record_output.process_invalid_limit", [read]],
    [{ sort: [{ field: "salary", order: "desc" }] }, "record_output.process_unknown_field", [read]],
    [{ dedupe: true }, "record_output.process_invalid_dedupe", [read]],
    // A read's own member replaces the author's where both say, so only a
    // `process` that is not one at all is refused beside a read that says all four.
    ["first 10", "record_output.process_not_object", [read, ordered]]
  ] as const) {
    for (const extractList of reads) {
      const dispatch = webAutomationExtractListDispatch({ extractList, recordOutput: { ...authored, process } } as JsonObject);
      assert.equal(dispatch.ok, false, JSON.stringify(process));
      if (dispatch.ok) continue;
      assert.equal(dispatch.result.failure?.code, "record_output.invalid");
      assert.equal(dispatch.result.failure?.stage, "dispatch");
      assert.deepEqual(dispatch.result.effects, []);
      assert.ok(((dispatch.result.outputs?.error as JsonObject).issues as string[]).includes(issue), JSON.stringify(dispatch.result.outputs));
    }
  }
});

test("'list each once' writes no process dedupe, so Core's whole-row identity applies", () => {
  // The page's own read of `true` is the whole record, so it agrees in exploration too.
  assert.deepEqual(webAutomationExtractListRequestValue({ ...read, dedupe: true })?.dedupe, { by: ["title", "company", "posted", "url"] });
  for (const recordOutput of [undefined, authored]) {
    for (const dedupe of [true, { by: ["url", "posted", "company", "title"] }]) {
      const { recordOutput: output } = sent({ extractList: { ...read, dedupe, maxItems: 5 }, ...(recordOutput ? { recordOutput } : {}) } as JsonObject);
      assert.deepEqual(output.process, { limit: 5 }, JSON.stringify(dedupe));
    }
    // It clears an authored dedupe too: the read's own member wins.
    const { recordOutput: output } = sent({ extractList: { ...read, dedupe: true }, recordOutput: { ...authored, process: { dedupe: { by: ["url"] }, minRows: 2 } } });
    assert.deepEqual(output.process, { minRows: 2 });
  }
});

test("an explicit dedupe naming a subset is kept as written", () => {
  for (const recordOutput of [undefined, authored]) {
    const { recordOutput: output } = sent({ extractList: { ...read, dedupe: { by: ["url"] } }, ...(recordOutput ? { recordOutput } : {}) } as JsonObject);
    assert.deepEqual(output.process, { dedupe: { by: ["url"] } });
    assert.equal(parseAutomationStudioRecordOutput(output).ok, true);
  }
});

test("'each once' over a narrowed read still narrows: the whole-row dedupe pins no helper column", () => {
  const declared = { ...authored, schema: { ...authored.schema, fields: authored.schema.fields.filter((field) => field.id !== "company") } };
  const { extractList, recordOutput } = sent({ extractList: { ...read, dedupe: true }, recordOutput: declared });
  assert.equal(Object.hasOwn(extractList.fields as JsonObject, "company"), false);
  assert.equal(Object.hasOwn(recordOutput, "process"), false);
});

test("a Flow's read asks the page for the rows it kept, possibly none", () => {
  assert.equal(sent({ extractList: read }).extractList.answer, "kept");
  assert.equal(sent({ extractList: ordered, recordOutput: authored }).extractList.answer, "kept");
  // The Flow's own parameters are not changed: the request is the dispatch's.
  const node = { extractList: read };
  sent(node);
  assert.equal(Object.hasOwn(node.extractList, "answer"), false);
});

test("the replay asks the same way, and leaves a value that is not a read alone", () => {
  const node = { extractList: read };
  const asked = webAutomationExtractListAloneRowsAsked(node);
  assert.equal((asked.extractList as JsonObject).answer, "kept");
  assert.equal(Object.hasOwn(node.extractList, "answer"), false);
  const unfiltered = { extractList: { item: "li.job", fields: { title: ".title" } } };
  assert.deepEqual(webAutomationExtractListAloneRowsAsked(unfiltered), { extractList: { ...unfiltered.extractList, answer: "kept" } });
  assert.deepEqual(webAutomationExtractListAloneRowsAsked({ extractList: "not a read" }), { extractList: "not a read" });
});
