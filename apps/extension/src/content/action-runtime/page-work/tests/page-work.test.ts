// The content script's questions to the page world (task speed S10, t893):
// whether the page has settled, after the frames that run its scroll and
// intersection handlers when asked; and the wait an action makes when the page
// moved its address in place since the last action. The page is a stand-in
// window answering as the page world does, a stand-in address, observer and
// frame clock.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { askPageQuiet, forgetSettledAddressForTest, settleAddressMove } from "..";

const WATCHED = "fluxiq:page-work-watched";
const BUSY = "fluxiq:page-work-busy";
const DRAINED = "fluxiq:page-work-drained";

type PageOptions = { pageWorld?: boolean; busy?: boolean; frames?: boolean; href?: string };

function page(t: TestContext, options: PageOptions = {}) {
  const globals = globalThis as Record<string, unknown>;
  const names = ["window", "document", "MutationObserver", "location", "requestAnimationFrame", "cancelAnimationFrame"] as const;
  const previous = Object.fromEntries(names.map((name) => [name, globals[name]]));
  const view = new EventTarget();
  let busy = options.busy ?? false;
  if (options.pageWorld !== false) {
    view.addEventListener(WATCHED, (event) => event.preventDefault());
    view.addEventListener(BUSY, (event) => { if (busy) event.preventDefault(); });
  }
  class ObserverStandin {
    observe(): void {}
    disconnect(): void {}
  }
  const location = { href: options.href ?? "https://kerbfind.test/search/?query=dining+table" };
  let framesDrawn = 0;
  const frameClock = options.frames === false ? {} : {
    requestAnimationFrame: (callback: () => void) => setTimeout(() => { framesDrawn += 1;
      callback(); }, 16) as unknown as number,
    cancelAnimationFrame: (id: number) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>)
  };
  Object.assign(globals, { window: view, document: {}, MutationObserver: ObserverStandin, location, requestAnimationFrame: undefined, cancelAnimationFrame: undefined, ...frameClock });
  forgetSettledAddressForTest();
  t.after(() => {
    Object.assign(globals, previous);
    forgetSettledAddressForTest();
  });
  return {
    location,
    frames: () => framesDrawn,
    drain: () => { busy = false;
      view.dispatchEvent(new Event(DRAINED)); }
  };
}

const after = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("an idle page is quiet at once, and after two frames when the caller waits for its handlers", async (t) => {
  const p = page(t);
  assert.equal(await askPageQuiet(Date.now() + 1_000).settled, true);
  assert.equal(p.frames(), 0, "asked at once");
  assert.equal(await askPageQuiet(Date.now() + 1_000, { afterFrames: true }).settled, true);
  assert.equal(p.frames(), 2, "two frames drawn first");
});

test("a page still at work is quiet only once its work drains", async (t) => {
  const p = page(t, { busy: true });
  let settled: boolean | undefined;
  const quiet = askPageQuiet(Date.now() + 1_000);
  void quiet.settled.then((value) => { settled = value; });
  await after(40);
  assert.equal(settled, undefined, "work is outstanding");
  p.drain();
  assert.equal(await quiet.settled, true);
});

test("no page world counting answers false, and the caller's window decides", async (t) => {
  page(t, { pageWorld: false });
  assert.equal(await askPageQuiet(Date.now() + 1_000).settled, false);
});

test("a hidden page, which draws no frames, answers false when the caller waits for its handlers", async (t) => {
  page(t, { frames: false });
  assert.equal(await askPageQuiet(Date.now() + 1_000, { afterFrames: true }).settled, false);
});

test("a page still at work at the caller's end, or no longer asked, answers false then", async (t) => {
  page(t, { busy: true });
  const startedAt = Date.now();
  assert.equal(await askPageQuiet(Date.now() + 60).settled, false, "its end came first");
  assert.ok(Date.now() - startedAt < 500);
  const stopped = askPageQuiet(Date.now() + 1_000);
  stopped.stop();
  assert.equal(await stopped.settled, false, "the caller stopped asking");
});

test("an action on an unmoved address waits for nothing, a page busy or not", async (t) => {
  page(t, { busy: true });
  assert.equal(await settleAddressMove(), "unmoved", "the first action notes its address");
  const startedAt = Date.now();
  assert.equal(await settleAddressMove(), "unmoved");
  assert.ok(Date.now() - startedAt < 20, "the busy page is not waited on: nothing moved");
});

test("the sort: an action after the address moved in place waits for the page's redraw, and the next one does not", async (t) => {
  const p = page(t, { busy: true });
  assert.equal(await settleAddressMove(), "unmoved");
  // local-classifieds' sort: the address rewritten, the old results cleared, the new ones requested.
  p.location.href = "https://kerbfind.test/search/?query=dining+table&sortBy=price_ascend";
  let outcome: string | undefined;
  const settling = settleAddressMove().then((value) => { outcome = value; });
  await after(60);
  assert.equal(outcome, undefined, "the results are still being drawn");
  p.drain();
  await settling;
  assert.equal(outcome, "settled");
  const startedAt = Date.now();
  assert.equal(await settleAddressMove(), "unmoved", "the page settled at this address");
  assert.ok(Date.now() - startedAt < 20);
});

test("with no page world, a moved address must stand still the old second", async (t) => {
  const p = page(t, { pageWorld: false });
  assert.equal(await settleAddressMove(), "unmoved");
  p.location.href = "https://kerbfind.test/search/?radius=5";
  const startedAt = Date.now();
  setTimeout(() => { p.location.href = "https://kerbfind.test/search/?radius=5&page=1"; }, 300);
  assert.equal(await settleAddressMove(), "still");
  assert.ok(Date.now() - startedAt >= 1_950, `a move within the second starts it again (${Date.now() - startedAt} ms)`);
});

test("a wait that runs out proves nothing: the next action asks again", async (t) => {
  const p = page(t, { busy: true });
  assert.equal(await settleAddressMove(), "unmoved");
  p.location.href = "https://kerbfind.test/search/?radius=5";
  assert.equal(await settleAddressMove(80), "deadline");
  p.drain();
  assert.equal(await settleAddressMove(1_000), "settled");
});
