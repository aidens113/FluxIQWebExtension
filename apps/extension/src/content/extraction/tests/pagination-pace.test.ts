// Coverage of the page's side of the page-load pace in pagination.ts: before a
// load it asks the worker, waits what the answer says -- never past the read's
// deadline, never longer than the cap -- and a page with no pace behind it
// waits nothing. Following a control on a live page is proven by the content
// harness; what is proven here is the question asked and the wait taken.

import assert from "node:assert/strict";
import test from "node:test";
import { awaitPageLoadTurn } from "../pagination";

/** Runs `body` with whatever `chrome` it installs taken away again afterwards, since every test file shares one process. */
async function withOwnChrome(body: () => Promise<void>): Promise<void> {
  const global = globalThis as { chrome?: unknown };
  const before = global.chrome;
  try {
    await body();
  } finally {
    global.chrome = before;
  }
}

function installRuntime(sendMessage: (message: unknown) => Promise<unknown>): unknown[] {
  const sent: unknown[] = [];
  (globalThis as { chrome?: unknown }).chrome = { runtime: { sendMessage: (message: unknown) => { sent.push(message); return sendMessage(message); } } };
  return sent;
}

function recordPauses(): { pauses: number[]; pause: (ms: number) => Promise<void> } {
  const pauses: number[] = [];
  return { pauses, pause: (ms) => { pauses.push(ms); return Promise.resolve(); } };
}

test("the page asks the worker's pace before a load and waits the time it is given", () => withOwnChrome(async () => {
  const sent = installRuntime(() => Promise.resolve({ ok: true, waitMs: 2_500 }));
  const { pauses, pause } = recordPauses();
  assert.equal(await awaitPageLoadTurn(undefined, pause), 2_500);
  assert.deepEqual(sent, [{ type: "fluxiq.pageLoad.pace", kind: "load" }], "it sends no address and no text");
  assert.deepEqual(pauses, [2_500]);
}));

test("the wait stops at the read's deadline and at the cap", () => withOwnChrome(async () => {
  installRuntime(() => Promise.resolve({ ok: true, waitMs: 9_000 }));
  const { pauses, pause } = recordPauses();
  const waited = await awaitPageLoadTurn(Date.now() + 1_000, pause);
  assert.ok(waited > 0 && waited <= 1_000, `waited ${waited} ms`);
  installRuntime(() => Promise.resolve({ ok: true, waitMs: 10 * 60_000 }));
  assert.equal(await awaitPageLoadTurn(undefined, pause), 30_000);
  assert.equal(pauses.length, 2);
}));

test("a page with no pace behind it loads at once", () => withOwnChrome(async () => {
  const { pauses, pause } = recordPauses();
  // The worker's general handler answering a message it does not know.
  installRuntime(() => Promise.resolve({ ok: false, error: "Unknown FluxIQ extension message." }));
  assert.equal(await awaitPageLoadTurn(undefined, pause), 0);
  installRuntime(() => Promise.reject(new Error("Could not establish connection. Receiving end does not exist.")));
  assert.equal(await awaitPageLoadTurn(undefined, pause), 0);
  installRuntime(() => Promise.resolve({ ok: true, waitMs: Number.NaN }));
  assert.equal(await awaitPageLoadTurn(undefined, pause), 0);
  delete (globalThis as { chrome?: unknown }).chrome;
  assert.equal(await awaitPageLoadTurn(undefined, pause), 0);
  assert.deepEqual(pauses, []);
}));
