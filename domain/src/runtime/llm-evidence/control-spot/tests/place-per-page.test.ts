// A stateful control's place belongs to the page it is on (L1 reset
// settlement; t772, rerun round 6 debug `run-mvrj7qgf-a44a1427`, cause 1).
// The place token hashes the page's address with the control's role, so the
// same-role control on two different pages -- two catalogue entries, each with
// its own Reserve button, in no row -- gets two different places, while one
// page read twice keeps one. FluxIQ Core must never assume that two items'
// controls share a place token: a looped pass on another item than the one its
// step's receipt was read on is witnessed at its own place
// (Core `flow-bootstrap/site-reset/ledger.ts`, `stamped`). The site is a
// library catalogue.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webControlPlace, webResetResource } from "..";
import { sanitizeWebLlmSnapshotWithBindings, type WebLlmSnapshotBinding } from "../../sanitize";

/** A binding of `elements` at `url`, read from tab 1's top frame of one session. */
function page(elements: JsonObject[], url: string): WebLlmSnapshotBinding {
  const binding = sanitizeWebLlmSnapshotWithBindings({ url, title: "Catalogue", interactiveElements: elements });
  binding.resetResource = webResetResource("session", "tab:1:frame:0")!;
  return binding;
}

/** The handle of the element `selector` addresses on `binding`. */
function handleOf(binding: WebLlmSnapshotBinding, selector: string): string {
  const handle = [...binding.selectors].find(([, written]) => written === selector)?.[0];
  assert.ok(handle, `no element at ${selector}`);
  return handle;
}

const reserve = (state: "false" | "true"): JsonObject => ({ tagName: "button", implicitRole: "button", selector: "#reserve", accessibleName: state === "true" ? "Cancel reservation" : "Reserve", attributes: { "aria-pressed": state } });
const placeOf = (url: string, state: "false" | "true" = "false") => {
  const binding = page([reserve(state)], url);
  return webControlPlace(binding, handleOf(binding, "#reserve"));
};

test("the same-role control on two different pages gets two different places", () => {
  const first = placeOf("https://catalogue.test/entries/1/");
  const second = placeOf("https://catalogue.test/entries/2/");
  assert.ok(first && second);
  assert.notEqual(first, second);
});

test("one page's control keeps its place across reads and across its own press", () => {
  const url = "https://catalogue.test/entries/1/";
  assert.equal(placeOf(url), placeOf(url));
  assert.equal(placeOf(url, "true"), placeOf(url, "false"));
});
