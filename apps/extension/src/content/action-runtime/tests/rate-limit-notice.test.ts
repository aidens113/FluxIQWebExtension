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

// A page too busy to carry the press out, saying so beside the control rather
// than over the page: crossborder's store coupon turns its button to "…", asks
// the server, and on the first claim writes "Network busy, please try again"
// under it and collects nothing (t174-w32).

const COUPON = "Store coupon €3 off orders over €20 Get coupons";
const COUPON_BUSY = `${COUPON} Network busy, please try again`;

/**
 * A page with no layers whose pressed control's region reads `region(call)` at
 * each look (call 0 is the look at the press), and whose control reads
 * `label(elapsed)` once the press is made.
 */
function regionPage(region: (call: number) => string, label: (elapsedMs: number) => string = () => "Get coupons"): RateLimitProbe {
  let call = 0;
  let pressedAt: number | undefined;
  return {
    layers: () => [],
    textOf: () => "",
    regionTexts: () => [region(call++)],
    labelOf: () => {
      if (pressedAt === undefined) {
        pressedAt = Date.now();
        return "Get coupons";
      }
      return label(Date.now() - pressedAt);
    }
  };
}

test("a busy line the press brought into the control's own region is a refusal that names no wait", async () => {
  const watch = watchRateLimitNotice(pressedElement(), regionPage((call) => (call === 0 ? COUPON : COUPON_BUSY)));
  const found = await watch.settle(200);
  assert.equal(found?.busy, true);
  assert.equal(found?.retryAfterMs, undefined, "Core's backoff decides when to press again");
  assert.deepEqual(Object.keys(found ?? {}).sort(), ["afterMs", "busy"], "nothing the page wrote leaves the watch");
});

test("a busy line already beside the control at the press, and never cleared, is not this press's answer", async () => {
  const watch = watchRateLimitNotice(pressedElement(), regionPage(() => COUPON_BUSY));
  assert.equal(await watch.settle(150), undefined);
});

test("a busy line the press cleared and the page then wrote again is this press's answer", async () => {
  // The coupon empties its error line on the press, then writes it again when the claim fails again.
  const watch = watchRateLimitNotice(pressedElement(), regionPage((call) => (call === 1 ? COUPON : COUPON_BUSY)));
  const found = await watch.settle(300);
  assert.equal(found?.busy, true);
});

test("a failure that is not the page being busy is no refusal, so the press stands on its own post-condition", async () => {
  const failed = "Something went wrong. We could not save this item. Try again";
  const watch = watchRateLimitNotice(pressedElement(), regionPage((call) => (call === 0 ? "Save for later" : `Save for later ${failed}`)));
  assert.equal(await watch.settle(150), undefined);
});

test("while the pressed control shows it is working, the watch reads past its window and finds the refusal painted when the work ends", async () => {
  // The coupon shows "…" for its 800 ms wait and the request; the line comes with the button's own words.
  const busyUntilMs = 450;
  let working = true;
  const watch = watchRateLimitNotice(
    pressedElement(),
    regionPage(
      () => (working ? COUPON.replace("Get coupons", "…") : COUPON_BUSY),
      (elapsed) => {
        working = elapsed < busyUntilMs;
        return working ? "…" : "Get coupons";
      }
    )
  );
  const began = Date.now();
  const found = await watch.settle(100);
  assert.equal(found?.busy, true, "the refusal after the window was found");
  assert.ok(Date.now() - began >= busyUntilMs - 50, "the watch read on past its 100 ms window");
});

test("a control that stops working with no refusal ends the watch then, and one that never stops is followed for at most 3 s", async () => {
  const done = watchRateLimitNotice(pressedElement(), regionPage(() => COUPON, (elapsed) => (elapsed < 200 ? "…" : "Collected")));
  const doneBegan = Date.now();
  assert.equal(await done.settle(100), undefined);
  assert.ok(Date.now() - doneBegan < 1_000, "ended when the control stopped working");

  const stuck = watchRateLimitNotice(pressedElement(), regionPage(() => COUPON, () => "…"));
  const stuckBegan = Date.now();
  assert.equal(await stuck.settle(100), undefined);
  const waited = Date.now() - stuckBegan;
  assert.ok(waited >= 2_700 && waited < 4_000, `followed to the busy limit, not past it (${waited} ms)`);
});

test("a control whose label never had words is not read as working", async () => {
  // An icon-only button ("×", "♥") that stays wordless is not a press still in progress.
  let first = true;
  const probe: RateLimitProbe = { layers: () => [], textOf: () => "", regionTexts: () => [""], labelOf: () => (first ? ((first = false), "♥") : "♥") };
  const began = Date.now();
  assert.equal(await watchRateLimitNotice(pressedElement(), probe).settle(100), undefined);
  assert.ok(Date.now() - began < 600);
});
