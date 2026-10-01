// T1 coverage of which shadow roots a press's answer is watched in
// (`scope-roots.ts`): every root the scope's walk crossed on its way up from
// the control, closed ones included, and every open root beneath the scope.
// The page is the extraction tests' fake shadow DOM, which, as a browser,
// never lets `querySelectorAll` or `parentElement` cross a shadow boundary.

import assert from "node:assert/strict";
import test from "node:test";
import { fakeShadowDom } from "../../../extraction/tests/fake-shadow-dom";
import { scopeRoots } from "../scope-roots";
import { pressScope } from "../press-scope";

const { el, shadow } = fakeShadowDom();

const rootOf = (host: Element): Node => (host as unknown as { shadowRoot: Node }).shadowRoot;

test("a chip inside a picker's shadow root: the scope walks out to the aside, and the root it crossed is watched", () => {
  // local-classifieds' `kf-location`: the chip and its panel are both inside
  // the root, and the press's whole answer is the panel's `hidden` flipping.
  const chip = el("button", { "aria-expanded": "false" }, "Kelford");
  const panel = el("div", { hidden: "" });
  const picker = shadow(el("kf-location"), el("div", { class: "row" }, chip), panel);
  const aside = el("aside", {}, el("div", {}, picker));
  el("body", {}, el("main", {}, aside));
  const scope = pressScope(chip);
  assert.equal(scope, aside, "the scope is the aside around the host, as before");
  assert.deepEqual(scopeRoots(chip, scope), [rootOf(picker)]);
});

test("a control in a root nested inside another root: both roots it crossed are watched, innermost first", () => {
  const button = el("button");
  const inner = shadow(el("kf-inner"), button);
  const outer = shadow(el("kf-outer"), el("div", {}, inner));
  const form = el("form", {}, outer);
  el("body", {}, form);
  const scope = pressScope(button);
  assert.equal(scope, form);
  assert.deepEqual(scopeRoots(button, scope), [rootOf(inner), rootOf(outer)]);
});

test("a closed root the control sits in is still watched: the control was handed over from inside it", () => {
  const button = el("button");
  const host = shadow(el("kf-closed"), button);
  const root = rootOf(host);
  (host as unknown as { shadowRoot: null }).shadowRoot = null;
  const section = el("section", {}, host);
  el("body", {}, section);
  assert.deepEqual(scopeRoots(button, pressScope(button)), [root]);
});

test("a light control whose answer lands in a component beside it: every open root beneath the scope is watched, nested ones too", () => {
  const button = el("button");
  const nested = shadow(el("kf-badge"), el("span"));
  const results = shadow(el("kf-results"), el("ul", {}, nested));
  const section = el("section", {}, el("div", {}, button), results);
  el("body", {}, section);
  const scope = pressScope(button);
  assert.equal(scope, section);
  assert.deepEqual(scopeRoots(button, scope), [rootOf(results), rootOf(nested)]);
});

test("a control that is itself a host: its own root is watched", () => {
  const button = shadow(el("kf-button"), el("span", {}, "Apply"));
  const form = el("form", {}, button);
  el("body", {}, form);
  assert.deepEqual(scopeRoots(button, pressScope(button)), [rootOf(button)]);
});

test("a root both crossed and beneath the scope is watched once", () => {
  const button = el("button");
  const picker = shadow(el("kf-picker"), button);
  const aside = el("aside", {}, picker);
  el("body", {}, aside);
  // The root is crossed on the way up and, being open, found again beneath the aside.
  assert.deepEqual(scopeRoots(button, pressScope(button)), [rootOf(picker)]);
});

test("a control with no shadow root anywhere in its scope watches no root, and a root outside the scope is never watched", () => {
  const button = el("button");
  const section = el("section", {}, el("div", {}, button));
  const elsewhere = shadow(el("kf-chat"), el("div"));
  el("body", {}, section, elsewhere);
  assert.deepEqual(scopeRoots(button, pressScope(button)), []);
});
