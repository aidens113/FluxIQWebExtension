// What a build has seen a page change by itself (t496, `../names.ts`).
//
// Two captures are compared only when nothing can have come between them: no act
// since the first, one document (location and `navigation.timeOrigin`), both of the
// whole page. And only a pair in which the page put something up by itself counts:
// a banner swapping its link does; a notice an act raised fading out does not, so
// the next act that raises it still keeps it as its effect.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationRouteSelfChanges } from "../../../../route-state";
import type { WebLlmSnapshotBinding } from "../../../sanitize";
import { createWebLlmSelfChangingNames } from "..";

const PAGE = "https://recipes.test/";
const OTHER = "https://recipes.test/recipes";
const NAV = ["All recipes", "Search", "Sign in"];

function capture(controls: readonly string[], options: { location?: string; document?: number; truncated?: true } = {}): WebLlmSnapshotBinding {
  const location = options.location ?? PAGE;
  const routeState: JsonObject = { page: { location, path: new URL(location).pathname, controls: controls.join(" | ") } };
  const evidence: JsonObject = { location, navigation: { timeOrigin: options.document ?? 1 } };
  if (options.truncated) evidence.truncated = true;
  return { evidence, selectors: new Map(), records: new Map(), routeState } as unknown as WebLlmSnapshotBinding;
}

/** The hashes the effect is made of, for these names. */
function hashes(...names: string[]): string[] {
  return webAutomationRouteSelfChanges({ page: {} }, { page: { controls: names.join(" | ") } }).appeared;
}

test("a banner that turns between two captures of one document, with nothing done, is the page changing by itself", () => {
  const names = createWebLlmSelfChangingNames();
  names.captured(capture([...NAV, "Read this week's pick"]));
  names.captured(capture([...NAV, "Browse the archive"]));
  assert.deepEqual([...names.of(PAGE)].sort(), hashes("Read this week's pick", "Browse the archive").sort());
  assert.equal(names.of(OTHER).size, 0, "another page has seen nothing");
});

test("a notice that only went away is not the page changing by itself", () => {
  const names = createWebLlmSelfChangingNames();
  names.captured(capture([...NAV, "Saved to your box", "View box"]));
  names.captured(capture(NAV));
  assert.equal(names.of(PAGE).size, 0);
});

test("captures with an act between them, of two documents, of two pages, or cut short are never compared", () => {
  const acted = createWebLlmSelfChangingNames();
  acted.captured(capture([...NAV, "Units: imperial"]));
  acted.acting();
  acted.captured(capture([...NAV, "Units: metric"]));
  assert.equal(acted.of(PAGE).size, 0, "an act came between");

  const reloaded = createWebLlmSelfChangingNames();
  reloaded.captured(capture([...NAV, "Units: imperial"], { document: 1 }));
  reloaded.captured(capture([...NAV, "Units: metric"], { document: 2 }));
  assert.equal(reloaded.of(PAGE).size, 0, "a new document: a reload, or a run Core made from the start");

  const moved = createWebLlmSelfChangingNames();
  moved.captured(capture([...NAV, "Read this week's pick"], { location: OTHER }));
  moved.captured(capture([...NAV, "Browse the archive"]));
  assert.equal(moved.of(PAGE).size + moved.of(OTHER).size, 0, "another page");

  const short = createWebLlmSelfChangingNames();
  short.captured(capture([...NAV, "Read this week's pick"]));
  short.captured(capture(["Browse the archive"], { truncated: true }));
  short.captured(capture([...NAV, "Meet the cooks"]));
  assert.equal(short.of(PAGE).size, 0, "a capture cut short says nothing of what is missing, and ends the chain");
});

test("what a page was seen changing is kept across its documents", () => {
  const names = createWebLlmSelfChangingNames();
  names.captured(capture([...NAV, "Read this week's pick"], { document: 1 }));
  names.captured(capture([...NAV, "Browse the archive"], { document: 1 }));
  names.acting();
  names.captured(capture([...NAV, "Read this week's pick"], { document: 2 }));
  names.captured(capture([...NAV, "Read this week's pick"], { document: 2 }));
  assert.deepEqual([...names.of(PAGE)].sort(), hashes("Read this week's pick", "Browse the archive").sort());
});
