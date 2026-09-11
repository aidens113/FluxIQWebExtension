import assert from "node:assert/strict";
import test from "node:test";
import { readExtensionRecordingLog } from "../extension-recording-log.js";

test("tallies recorded kinds, marks evidence entries, skips other activity, and never copies labels or details", async () => {
  const pages: unknown[][] = [[
    { kind: "dom.click", label: "Click", detail: "Submit secret order" },
    { kind: "dom.input", label: "Input changed", detail: "Name" },
    { kind: "dom.input", label: "Input changed", detail: "Notes" },
    { kind: "dom.mutation", label: "Evidence: DOM changed", detail: "3 added, 0 removed" },
    { kind: "recording", label: "Recording started", detail: "http://127.0.0.1:4100/private" },
    { kind: "tab", label: "Recording active tab" },
  ]];
  const requests: unknown[] = [];
  const tally = await readExtensionRecordingLog(async (message) => { requests.push(message); return { ok: true, log: { items: pages.shift() ?? [], page: 1, pageSize: 100, total: 6 } }; });
  assert.deepEqual(tally, { "dom.click": 1, "dom.input": 2, "evidence:dom.mutation": 1 });
  assert.deepEqual(requests, [{ type: "fluxiq.getRecordingLog", page: 1, pageSize: 100 }]);
  assert.equal(JSON.stringify(tally).includes("secret"), false);
});

test("reads further pages while a page is full, and tolerates a malformed response", async () => {
  const full = Array.from({ length: 100 }, () => ({ kind: "dom.click", label: "Click" }));
  const responses: unknown[] = [{ log: { items: full } }, { log: { items: [{ kind: "dom.change", label: "Field changed" }] } }];
  assert.deepEqual(await readExtensionRecordingLog(async () => responses.shift()), { "dom.click": 100, "dom.change": 1 });
  assert.deepEqual(await readExtensionRecordingLog(async () => ({ ok: false })), {});
});
