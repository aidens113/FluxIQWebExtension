// T1 coverage of the rate-limit notice watch (`rate-limit-notice.ts`): which
// layer a press's answer is, what it is read as, the wait taken from it, and
// when the watch gives up early.
//
// The page is faked at the two things the watch reads -- the layers painted
// over it and a layer's own words -- so each row states an observation and
// checks the verdict. The words are social-network-feed's own notice, as its
// `requests-script.ts` draws it and `interference/layer-text.ts` reads it: one
// space before every text node, so the countdown in its own `<span>` stays a
// separate word.

import assert from "node:assert/strict";
import test from "node:test";
import { watchRateLimitNotice, type RateLimitProbe } from "../rate-limit-notice";

/** social-network-feed's notice, read as `boundedLayerText` reads it. */
const FEED_NOTICE = "You're going too fast It looks like you were misusing this feature by going too fast. You've been temporarily blocked from using it. You can try again in 12 seconds. OK";

type FakeLayer = { name: string };

/** A page whose painted layers are `before` until the press and `after` from it on, with each layer's words. */
function page(options: { before?: FakeLayer[]; after: () => FakeLayer[]; words: Record<string, string> }): RateLimitProbe {
  let pressed = false;
  return {
    layers: () => {
      const layers = pressed ? options.after() : (options.before ?? []);
      pressed = true;
      return layers as unknown as Element[];
    },
    textOf: (layer) => options.words[(layer as unknown as FakeLayer).name] ?? ""
  };
}

function pressedElement(connected = true): Element & { isConnected: boolean } {
  return { isConnected: connected, ownerDocument: undefined } as unknown as Element & { isConnected: boolean };
}

test("the feed's own going-too-fast notice, opened by the press, is the press's answer, with the wait it named plus a margin", async () => {
  const notice = { name: "notice" };
  const watch = watchRateLimitNotice(pressedElement(), page({ after: () => [notice], words: { notice: FEED_NOTICE } }));
  const found = await watch.settle(500);
  assert.equal(found?.retryAfterMs, 12_500);
  assert.equal(typeof found?.afterMs, "number");
  assert.deepEqual(Object.keys(found ?? {}).sort(), ["afterMs", "retryAfterMs"], "nothing the notice wrote leaves the watch");
});

test("a notice that was already over the page before the press is not this press's answer", async () => {
  const notice = { name: "notice" };
  const watch = watchRateLimitNotice(pressedElement(), page({ before: [notice], after: () => [notice], words: { notice: FEED_NOTICE } }));
  assert.equal(await watch.settle(30), undefined);
});

test("a dialog the press opened that is not about going too fast is no refusal", async () => {
  const words = {
    invite: "Priya Nair invited you to the Riverside Allotment Society. OK",
    payment: "Your payment could not be processed. Try again.",
    saved: "Saved. You can try again later if the list looks out of date."
  };
  for (const name of Object.keys(words)) {
    const watch = watchRateLimitNotice(pressedElement(), page({ after: () => [{ name }], words }));
    assert.equal(await watch.settle(30), undefined, name);
  }
});

test("each phrase of the closed list is a refusal, and a wait in minutes is held to a minute", async () => {
  const rows: Array<[string, number | undefined]> = [
    ["Slow down! Please wait 30 seconds before posting again. Got it", 30_500],
    ["Too many attempts. Try again in 1 minute.", 60_000],
    ["You're doing that too fast. OK", undefined],
    ["You have been temporarily blocked from using this feature. OK", undefined],
    ["Rate limit reached. Retry in 5 s.", 5_500],
    ["Too many requests. Try again in 0 seconds.", 500]
  ];
  for (const [text, retryAfterMs] of rows) {
    const watch = watchRateLimitNotice(pressedElement(), page({ after: () => [{ name: "n" }], words: { n: text } }));
    const found = await watch.settle(30);
    assert.notEqual(found, undefined, text);
    assert.equal(found?.retryAfterMs, retryAfterMs, text);
  }
});

test("a notice painted after the press but inside the window is still found", async () => {
  const notice = { name: "notice" };
  const shownAt = Date.now() + 150;
  const watch = watchRateLimitNotice(pressedElement(), page({ after: () => (Date.now() >= shownAt ? [notice] : []), words: { notice: FEED_NOTICE } }));
  const found = await watch.settle(1_000);
  assert.equal(found?.retryAfterMs, 12_500);
});

test("a notice first seen without its wait is watched until the wait can be read", async () => {
  const notice = { name: "notice" };
  const readableAt = Date.now() + 150;
  const probe: RateLimitProbe = {
    layers: (() => {
      let pressed = false;
      return () => {
        const layers = pressed ? [notice] : [];
        pressed = true;
        return layers as unknown as Element[];
      };
    })(),
    textOf: () => (Date.now() >= readableAt ? FEED_NOTICE : "You're going too fast It looks like you were misusing this feature by going too fast. OK")
  };
  const found = await watchRateLimitNotice(pressedElement(), probe).settle(1_000);
  assert.equal(found?.retryAfterMs, 12_500);
});

test("a notice whose wait never becomes readable is still the answer when the window closes", async () => {
  const watch = watchRateLimitNotice(pressedElement(), page({ after: () => [{ name: "n" }], words: { n: "You're doing that too fast. OK" } }));
  const found = await watch.settle(120);
  assert.notEqual(found, undefined);
  assert.equal(found?.retryAfterMs, undefined);
});

test("a press whose control left the document was answered otherwise, so the window is not waited out", async () => {
  const pressed = pressedElement();
  const watch = watchRateLimitNotice(pressed, page({ after: () => [], words: {} }));
  pressed.isConnected = false;
  const began = Date.now();
  assert.equal(await watch.settle(5_000), undefined);
  assert.ok(Date.now() - began < 1_000, "the watch ended at once rather than at its deadline");
});

test("the document starting to leave ends the watch at once, so a submit that navigates still sends its result", async () => {
  const listeners = new Map<string, () => void>();
  const view = {
    addEventListener: (type: string, listener: () => void) => listeners.set(type, listener),
    removeEventListener: (type: string) => listeners.delete(type)
  };
  const pressed = { isConnected: true, ownerDocument: { defaultView: view } } as unknown as Element;
  const watch = watchRateLimitNotice(pressed, page({ after: () => [], words: {} }));
  const began = Date.now();
  const settled = watch.settle(5_000);
  listeners.get("beforeunload")?.();
  assert.equal(await settled, undefined);
  assert.ok(Date.now() - began < 1_000, "the watch ended when the document began to leave");
  assert.equal(listeners.size, 0, "every listener it added is removed");
});
