// Coverage of the content script's own-page decision (`../check.ts`) and the
// guard at the top of its command handling (`../guard.ts`): a command that
// reaches one of FluxIQ's own documents is refused before the answer that
// would read the page runs, a framed FluxIQ document is refused while the
// ordinary page around it still answers, and a frame a command is not for
// stays silent as before.

import assert from "node:assert/strict";
import { test } from "node:test";
import { isOwnPageRefusalReply, OWN_PAGE_REFUSAL_MESSAGE } from "../../../shared/own-pages";
import { createOwnDocumentCheck, guardedCommandListener, type ContentRoute } from "../index";

const ADDRESSES = ["http://127.0.0.1:3000", "ws://127.0.0.1:4777/client"];

/** A document at `origin` whose background answers with `ADDRESSES`, counting how often it is asked. */
function documentAt(origin: string, selfOrigin: string = origin, answer: () => Promise<unknown> = async () => ({ ok: true, addresses: ADDRESSES })) {
  let asked = 0;
  const check = createOwnDocumentCheck({
    origins: () => [origin, selfOrigin],
    ask: () => {
      asked += 1;
      return answer();
    }
  });
  return { check, asked: () => asked };
}

/** A route whose answer stands for everything a command does to the page; `reads` counts the times it ran. */
function recordingRoute(routed: boolean = true) {
  const reads: unknown[] = [];
  const route = (message: unknown): ContentRoute | undefined => {
    if (!routed) return undefined;
    if ((message as { type?: string }).type === "fluxiq.ping") return { liveness: true, answer: (reply) => reply({ ok: true }) };
    return {
      answer: (reply) => {
        reads.push(message);
        reply({ read: "the page" });
      }
    };
  };
  return { route, reads };
}

/** Delivers `message` to `listener` and resolves the reply it sends, with what the listener returned. */
function deliver(listener: ReturnType<typeof guardedCommandListener>, message: unknown): Promise<{ reply: unknown; open: boolean }> {
  return new Promise((resolve) => {
    let open = false;
    open = listener(message, {}, (reply) => queueMicrotask(() => resolve({ reply, open })));
  });
}

test("the document decides by its own origin: the panel's, under any loopback name, is FluxIQ's; others are not", async () => {
  assert.equal(await documentAt("http://127.0.0.1:3000").check.verdict(), "own");
  assert.equal(await documentAt("http://localhost:3000").check.verdict(), "own");
  assert.equal(await documentAt("https://shop.example").check.verdict(), "ordinary");
  // An `about:blank` frame the panel made has no origin in its address, and inherits the panel's.
  assert.equal(await documentAt("null", "http://127.0.0.1:3000").check.verdict(), "own");
});

test("a document that cannot learn where FluxIQ's pages are is unconfirmed, never ordinary", async () => {
  assert.equal(await documentAt("https://shop.example", "https://shop.example", () => Promise.reject(new Error("no worker"))).check.verdict(), "unconfirmed");
  assert.equal(await documentAt("https://shop.example", "https://shop.example", async () => ({ ok: false })).check.verdict(), "unconfirmed");
});

test("decisions asked at once share one question; a later one asks again, so a settings change applies", async () => {
  const doc = documentAt("https://shop.example");
  await Promise.all([doc.check.verdict(), doc.check.verdict(), doc.check.verdict()]);
  assert.equal(doc.asked(), 1);
  await doc.check.verdict();
  assert.equal(doc.asked(), 2);
  assert.equal(doc.check.last(), "ordinary");
});

test("a command delivered to FluxIQ's own document is refused before anything reads the page", async () => {
  const { route, reads } = recordingRoute();
  const listener = guardedCommandListener(route, documentAt("http://127.0.0.1:3000").check);
  for (const type of ["executeAction", "captureSnapshot", "fluxiq.evaluateFacts", "recording", "fluxiq.pageChanges"]) {
    const { reply, open } = await deliver(listener, { type });
    assert.equal(open, true);
    assert.ok(isOwnPageRefusalReply(reply), JSON.stringify(reply));
    assert.ok((reply as { error: string }).error.startsWith(OWN_PAGE_REFUSAL_MESSAGE));
  }
  assert.deepEqual(reads, [], "no answer that reads or acts ran");
});

test("the ping is still answered in FluxIQ's own document, so the background does not inject again and again", async () => {
  const { route } = recordingRoute();
  const doc = documentAt("http://127.0.0.1:3000");
  const { reply } = await deliver(guardedCommandListener(route, doc.check), { type: "fluxiq.ping" });
  assert.deepEqual(reply, { ok: true });
  assert.equal(doc.asked(), 0);
});

test("a framed FluxIQ document is refused while the ordinary page around it still answers", async () => {
  const top = recordingRoute();
  const frame = recordingRoute();
  const topListener = guardedCommandListener(top.route, documentAt("https://shop.example").check);
  const frameListener = guardedCommandListener(frame.route, documentAt("http://127.0.0.1:3000").check);
  assert.deepEqual((await deliver(topListener, { type: "executeAction", frameId: 0 })).reply, { read: "the page" });
  assert.ok(isOwnPageRefusalReply((await deliver(frameListener, { type: "executeAction", frameId: 4 })).reply));
  assert.equal(top.reads.length, 1);
  assert.equal(frame.reads.length, 0);
});

test("a frame a command is not for stays silent and asks nothing", () => {
  const { route } = recordingRoute(false);
  const doc = documentAt("http://127.0.0.1:3000");
  let replied = false;
  assert.equal(guardedCommandListener(route, doc.check)({ type: "executeAction", frameId: 3 }, {}, () => { replied = true; }), false);
  assert.equal(replied, false);
  assert.equal(doc.asked(), 0);
});

test("a document whose background did not answer refuses rather than acting", async () => {
  const { route, reads } = recordingRoute();
  const listener = guardedCommandListener(route, documentAt("https://shop.example", "https://shop.example", () => Promise.reject(new Error("gone"))).check);
  const { reply } = await deliver(listener, { type: "executeAction" });
  assert.equal((reply as { refused?: string }).refused, "own_page_unconfirmed");
  assert.deepEqual(reads, []);
});
