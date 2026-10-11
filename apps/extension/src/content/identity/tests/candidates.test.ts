// Which elements Level 2 weighs: the controls a page dressed as interactive,
// and of the recorded tag those it made pressable without saying so (t436).
//
// The crossborder item page binds its option chips in script: plain `<div>`s
// with no role, no tabindex and no `onclick`. `CANDIDATE_SELECTOR` admitted
// none of them, so a saved chip whose exact lookup missed was reported as "0
// controls of the same family" beside six (`reports/r4a-4-saved-chip-not-
// found.md`). The snapshot already reads two signs on such an element -- a
// pointer of its own, and a press listener the page world saw -- and calls it
// clickable; enumeration now reads the same two. The page is the hand-built
// document of `../../tests/stub-dom.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { el, installStubDocument, listenForPress, stubDocument, type StubElement } from "../../tests/stub-dom";
import { collectTargetCandidates } from "../candidates";

function page(t: Parameters<typeof installStubDocument>[0], ...content: StubElement[]): void {
  const document = stubDocument();
  document.append(el("html", {}, el("body", {}, el("main", {}, ...content))));
  installStubDocument(t, document);
}

const texts = (pool: ReturnType<typeof collectTargetCandidates>): string[] => pool.candidates.map((candidate) => candidate.element.textContent ?? "");

test("a div the page gave a pointer of its own, or bound a press listener to, is weighed; plain text and an inherited pointer are not", (t) => {
  const inner = el("div", {}, "inside");
  const outer = el("div", { style: "cursor:pointer" }, inner);
  page(t,
    el("div", {}, "Specification:"),
    el("div", { style: "cursor:pointer" }, "4-in-1"),
    outer,
    listenForPress(el("div", {}, "Not now")),
    el("div", { role: "button" }, "Accept"),
    el("button", {}, "Add to cart"));
  const pool = collectTargetCandidates({ tagName: "div" });
  assert.deepEqual(texts(pool), ["Accept", "4-in-1", "inside", "Not now"], "the dressed control first, then the pressable ones, each once");
  const weighed = pool.candidates.map((candidate) => candidate.element as unknown);
  assert.ok(weighed.includes(outer) && !weighed.includes(inner), "the pointer is the outer div's own; the inner one only inherits it");
  assert.equal(pool.truncated, false);
});

test("a family named by role alone is not widened: only the recorded tag's pressable elements join it", (t) => {
  page(t, el("div", { style: "cursor:pointer" }, "4-in-1"), el("div", { role: "button" }, "Accept"));
  assert.deepEqual(texts(collectTargetCandidates({ role: "button" })), ["Accept"]);
});

test("the pressable elements count toward the same caps, and a pool they fill says it was cut short", (t) => {
  const chips = Array.from({ length: 70 }, (_, index) => el("div", { style: "cursor:pointer" }, `option ${index}`));
  page(t, ...chips);
  const pool = collectTargetCandidates({ tagName: "div" });
  assert.equal(pool.candidates.length, 60);
  assert.equal(pool.truncated, true);
});

test("a page holding exactly the cap of pressable elements is reported complete", (t) => {
  page(t, ...Array.from({ length: 60 }, (_, index) => el("div", { style: "cursor:pointer" }, `option ${index}`)));
  const pool = collectTargetCandidates({ tagName: "div" });
  assert.equal(pool.candidates.length, 60);
  assert.equal(pool.truncated, false);
});

test("the admit gate is asked of the pressable elements as of the rest", (t) => {
  page(t, el("div", { style: "cursor:pointer" }, "China"), el("div", { style: "cursor:pointer" }, "Spain"));
  const pool = collectTargetCandidates({ tagName: "div" }, [document], (element) => element.textContent === "Spain");
  assert.deepEqual(texts(pool), ["Spain"]);
});
