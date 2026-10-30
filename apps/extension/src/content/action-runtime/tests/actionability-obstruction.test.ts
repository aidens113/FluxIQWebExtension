// A covered refusal, and a failure behind a layer, report the layer as an
// `obstruction` (CC7, interface I2 of the heavy-lifting plan): its generic kind,
// a stable id, its name, and the ways out it offers, each with an intent
// computed from structure and the press guard -- `dismiss` (closes the layer,
// acts on nothing), `accept` (answers it in the page's favour: Core never presses
// it) or `neutral` -- and, for a rate limit (CC8), the kind with a wait only when
// the page stated one.
//
// The pages are a library catalogue's: a hold button covered by a newsletter
// offer, a consent sheet, a "too fast" notice. The runner is Node, so the layers
// are the hand-built trees of `../interference/tests/fake-layer.ts`; what a real
// page proves is the content harness's.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { layerId, layerObstruction } from "../interference";
import { obstructionBehind, rateLimitObstruction } from "../obstruction";
import { h, place, withPage, zonedView, type FakeElement } from "../interference/tests/fake-layer";
import type { BrowserActionCommand, DomSnapshot } from "../../types";

/** The reading-list offer: a close glyph, a decline, a subscribe, and a plain "Browse the archive". */
function newsletterOffer(title = "Reading list newsletter") {
  const close = h("div", { role: "button", tabindex: "0", "aria-label": "Close" }, "✕");
  const later = h("button", { type: "button" }, "Maybe later");
  const subscribe = h("button", { type: "button" }, "Subscribe me");
  const browse = h("button", { type: "button" }, "Browse the archive");
  const offer = h("div", { role: "dialog", "aria-modal": "true", "aria-label": title }, [
    h("div", {}, [h("h2", {}, title), close]),
    h("p", {}, "New titles in your inbox every week."),
    h("div", {}, [later, subscribe, browse])
  ]);
  place(offer, { position: "fixed", box: { x: 300, y: 100, width: 600, height: 400 } });
  return { offer, close, later, subscribe, browse };
}

/** A catalogue page whose "Place a hold" button sits under `layer`. */
function catalogue(layer: FakeElement) {
  const hold = place(h("button", { type: "button" }, "Place a hold"), { box: { x: 500, y: 250, width: 120, height: 32 } });
  const main = h("main", {}, [h("h1", {}, "Garden catalogue"), hold]);
  const body = h("body", {}, [main, layer]);
  return { body, hold, view: zonedView([layer], main) };
}

test("a target covered by an offer reports the layer, its kind and id and name, and its ways out best first", () => {
  const { offer } = newsletterOffer();
  const { body, hold, view } = catalogue(offer);
  const obstruction = withPage(body, () => obstructionBehind("covered", { x: 560, y: 266 }, hold), view);
  assert.ok(obstruction);
  assert.equal(obstruction.kind, "other", "no classifier names a newsletter offer");
  assert.match(obstruction.id ?? "", /^layer:[0-9a-f]{8}$/u);
  assert.equal(obstruction.name, "Reading list newsletter");
  // Dismissals first (the close glyph, the decline), then what the client cannot tell, then what answers the offer.
  assert.deepEqual(obstruction.dismiss.map((way) => way.intent), ["dismiss", "dismiss", "neutral", "accept"]);
});

test("a control whose press acts is reported as accept, so Core is never offered it to press", () => {
  const { offer } = newsletterOffer();
  const { body, hold, view } = catalogue(offer);
  const obstruction = withPage(body, () => obstructionBehind("covered", { x: 560, y: 266 }, hold), view);
  const accepts = obstruction?.dismiss.filter((way) => way.intent === "accept") ?? [];
  assert.equal(accepts.length, 1, "Subscribe me is the one control that answers the offer in its favour");
});

/** A consent sheet: Accept all, Reject all. */
function consentSheet() {
  const accept = h("button", { type: "button" }, "Accept all");
  const reject = h("button", { type: "button" }, "Reject all");
  const sheet = h("div", { role: "dialog", "aria-modal": "true", "aria-label": "Cookie settings" }, [
    h("p", {}, "We use cookies to remember your reading lists and to measure traffic."),
    h("div", {}, [accept, reject])
  ]);
  place(sheet, { position: "fixed", box: { x: 0, y: 500, width: 1280, height: 220 } });
  return { sheet, accept, reject };
}

test("a consent sheet is an overlay: declining is a dismissal, accepting is accept", () => {
  const { sheet } = consentSheet();
  const { body, view } = catalogue(sheet);
  const obstruction = withPage(body, () => layerObstruction(sheet), view);
  assert.equal(obstruction?.kind, "overlay");
  assert.deepEqual(obstruction?.dismiss.map((way) => way.intent), ["dismiss", "accept"]);
});

test("the id is the layer's structure: it survives a changed count in the words and tells two layers apart", () => {
  const first = newsletterOffer("Newsletter, 12 places left").offer;
  const second = newsletterOffer("Newsletter, 9 places left").offer;
  const consent = consentSheet().sheet;
  const ids = [first, second, consent].map((layer) => withPage(catalogue(layer).body, () => layerId(layer)));
  assert.equal(ids[0], ids[1], "digits are not structure");
  assert.notEqual(ids[0], ids[2]);
});

test("a hidden target behind a declared modal is reported with the modal; a cover that is no layer reports nothing", () => {
  const { offer } = newsletterOffer();
  const { body, hold, view } = catalogue(offer);
  assert.equal(withPage(body, () => obstructionBehind("hidden", undefined, hold), view)?.name, "Reading list newsletter");
  assert.equal(withPage(h("body", {}, [hold]), () => obstructionBehind("covered", { x: 560, y: 266 }, hold), zonedView([], hold)), undefined);
  assert.equal(withPage(body, () => obstructionBehind("disabled", { x: 560, y: 266 }, hold), view), undefined, "a disabled control is the control's own state");
});

test("a rate-limit notice over the page reports its kind, its wait when it stated one, and OK as its way out", () => {
  const ok = h("div", { role: "button", tabindex: "0" }, "OK");
  const tryAgain = h("div", { role: "button", tabindex: "0" }, "Try again");
  const notice = h("div", { role: "alertdialog", "aria-modal": "true", "aria-label": "Too many requests" }, [
    h("p", {}, "You're going too fast. You can try again in 4 seconds."),
    h("div", {}, [ok, tryAgain])
  ]);
  const { body } = catalogue(notice);
  const stated = withPage(body, () => rateLimitObstruction(4_500));
  assert.equal(stated.kind, "rate_limit");
  assert.equal(stated.retryAfterMs, 4_500);
  assert.deepEqual(stated.dismiss.map((way) => way.intent), ["dismiss", "accept"]);
  const unstated = withPage(body, () => rateLimitObstruction());
  assert.equal(Object.hasOwn(unstated, "retryAfterMs"), false, "no wait the page did not state");
  assert.equal(unstated.id, stated.id);
});

/** The page globals a result needs on its way out, put back when the test ends (`results.test.ts` says why). */
async function installResultPage(t: TestContext): Promise<typeof import("../results")> {
  const scope = globalThis as unknown as Record<string, unknown>;
  const before = { document: scope.document, location: scope.location, window: scope.window };
  const view: Record<string, unknown> = { innerWidth: 1280, innerHeight: 800, addEventListener: () => undefined };
  view.top = view;
  scope.window = view;
  scope.document = { title: "Catalogue", body: null, querySelector: () => null, querySelectorAll: () => [], addEventListener: () => undefined };
  scope.location = { href: "http://127.0.0.1:4000/scenarios/library" };
  t.after(() => {
    scope.document = before.document;
    scope.location = before.location;
    scope.window = before.window;
  });
  return await import("../results");
}

const CLICK = { commandId: "c1", actionType: "web.dom.click" } as BrowserActionCommand;

test("a rate-limited press fails with a rate_limit obstruction, its wait only when the notice named one", async (t) => {
  const { actionRateLimited } = await installResultPage(t);
  const named = actionRateLimited(CLICK, Date.now(), { afterMs: 120, retryAfterMs: 3_500 }, { snapshot: {} as DomSnapshot });
  assert.equal(named.failure?.code, "web.action.rate_limited");
  assert.deepEqual(named.obstruction, { kind: "rate_limit", retryAfterMs: 3_500, dismiss: [] });
  const silent = actionRateLimited(CLICK, Date.now(), { afterMs: 120, busy: true }, { snapshot: {} as DomSnapshot });
  assert.deepEqual(silent.obstruction, { kind: "rate_limit", dismiss: [] });
});
