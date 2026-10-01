// T1 coverage of served-status.ts: the status a landed document says it was
// served with, and the unread answer a caller tells apart from a status.
//
// `chrome.scripting` is stubbed, so this proves the addressing and the reading
// of the injection's result, not that a real document keeps `responseStatus`;
// only a loaded extension proves that.

import assert from "node:assert/strict";
import { test } from "node:test";
import { servedStatus } from "../served-status";

type Injection = { target: Record<string, unknown> };

async function withScripting<T>(answer: (injection: Injection) => Promise<unknown[]>, run: (targets: unknown[]) => Promise<T>): Promise<T> {
  const targets: unknown[] = [];
  (globalThis as { chrome?: unknown }).chrome = {
    scripting: {
      executeScript: (injection: Injection) => {
        targets.push(injection.target);
        return answer(injection);
      }
    }
  };
  try {
    return await run(targets);
  } finally {
    delete (globalThis as { chrome?: unknown }).chrome;
  }
}

test("a document named by its id answers the status it was served with", async () => {
  await withScripting(() => Promise.resolve([{ frameId: 0, result: 404 }]), async (targets) => {
    assert.deepEqual(await servedStatus(7, "doc-1"), { status: 404 });
    assert.deepEqual(targets, [{ tabId: 7, documentIds: ["doc-1"] }]);
  });
});

test("with no document id, the tab's top frame is asked", async () => {
  await withScripting(() => Promise.resolve([{ frameId: 0, result: 200 }]), async (targets) => {
    assert.deepEqual(await servedStatus(7, undefined), { status: 200 });
    assert.deepEqual(targets, [{ tabId: 7, frameIds: [0] }]);
  });
});

test("a document that keeps no status, as in Firefox, is unread, not a status", async () => {
  for (const result of [undefined, 0, 404.5, "404"]) {
    const served = await withScripting(() => Promise.resolve([{ frameId: 0, result }]), () => servedStatus(7, "doc-1"));
    assert.deepEqual(served, { unread: "the document keeps no response status" }, `result ${String(result)}`);
  }
});

test("an injection the browser refuses is unread, and says why", async () => {
  const served = await withScripting(() => Promise.reject(new Error("No document with id doc-1")), () => servedStatus(7, "doc-1"));
  assert.deepEqual(served, { unread: "the document could not be asked: No document with id doc-1" });
});
