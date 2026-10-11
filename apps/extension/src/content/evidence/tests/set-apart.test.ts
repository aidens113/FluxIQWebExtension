// Which option of a run of like options the page drew apart from the rest, on
// hand-built siblings (t229). What only a real page proves -- that the
// crossborder item page's chosen swatch is the one marked -- is the content
// harness's (`e2e/content/tests/evidence/tests/page-view-controls.spec.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import { setApartClasses, setApartFromLikeSiblings } from "../set-apart";

type Fake = { tagName: string; classList: string[] & { contains(name: string): boolean }; parentElement: { children: Fake[] } | null };

/** Siblings of `tag`, each with the classes given, under one parent. */
function run(tag: string, ...classes: string[][]): Fake[] {
  const parent = { children: [] as Fake[] };
  for (const names of classes) {
    const list = Object.assign([...names], { contains: (name: string) => names.includes(name) });
    parent.children.push({ tagName: tag.toUpperCase(), classList: list, parentElement: parent });
  }
  return parent.children;
}

const apart = (members: Fake[]): boolean[] => members.map((member) => setApartFromLikeSiblings(member as unknown as Element));
const stateClasses = (members: Fake[]): string[][] => members.map((member) => setApartClasses(member as unknown as Element));

test("the one chip carrying a class few of its like siblings carry is set apart", () => {
  assert.deepEqual(apart(run("div", ["chip"], ["chip", "on"], ["chip"], ["chip"])), [false, true, false, false]);
  assert.deepEqual(apart(run("div", ["chip"], ["chip", "on"])), [false, true], "two options, one chosen");
});

test("a refused option is left out of the run, so the chosen one is still the one set apart", () => {
  const members = run("div", ["chip"], ["chip", "on"], ["chip", "off"], ["chip"]);
  const globals = globalThis as unknown as Record<string, unknown>;
  globals.getComputedStyle = (element: Fake) => ({ cursor: element.classList.contains("off") ? "not-allowed" : "pointer" });
  try {
    assert.deepEqual(apart(members), [false, true, false, false]);
  } finally {
    delete globals.getComputedStyle;
  }
});

test("two members drawn apart mark neither: a banner's ghost and primary buttons", () => {
  assert.deepEqual(apart(run("div", ["btn", "ghost"], ["btn"], ["btn", "primary"])), [false, false, false]);
});

test("a run in which every member has a class of its own marks none, and an element with no like sibling is not set apart", () => {
  assert.deepEqual(apart(run("li", ["row", "row-1"], ["row", "row-2"], ["row", "row-3"])), [false, false, false]);
  assert.deepEqual(apart(run("div", ["ship-to"], ["account"], ["account"])), [false, false, false]);
  assert.deepEqual(apart(run("div", [], [])), [false, false], "no class, nothing to tell apart by");
});

// The classes that set the one member apart are its state (t436): a saved
// fingerprint leaves them out, so the chip saved while chosen is not described
// as "whichever chip is chosen" on a later visit.
test("the classes that set the one member apart are named, and only for that member", () => {
  assert.deepEqual(stateClasses(run("div", ["chip"], ["chip", "on"], ["chip"])), [[], ["on"], []]);
  assert.deepEqual(stateClasses(run("div", ["chip", "x"], ["chip", "on", "x"], ["chip", "x"], ["chip", "x"])), [[], ["on"], [], []]);
});

test("no class is named where no member, or more than one, is set apart", () => {
  assert.deepEqual(stateClasses(run("div", ["btn", "ghost"], ["btn"], ["btn", "primary"])), [[], [], []], "a banner's two drawn buttons keep their classes");
  assert.deepEqual(stateClasses(run("li", ["row", "row-1"], ["row", "row-2"], ["row", "row-3"])), [[], [], []]);
  assert.deepEqual(stateClasses(run("div", ["chip"], ["chip"], ["chip"])), [[], [], []]);
  assert.deepEqual(stateClasses(run("div", ["chip", "on"])), [[]], "an option with no like sibling");
});

test("the cursors are not asked unless a like sibling lacks one of the element's classes", () => {
  const members = run("div", ["card", "tile"], ["card", "tile"], ["card", "tile"]);
  const globals = globalThis as unknown as Record<string, unknown>;
  let asked = 0;
  globals.getComputedStyle = () => {
    asked += 1;
    return { cursor: "pointer" };
  };
  try {
    assert.deepEqual(stateClasses(members), [[], [], []]);
    assert.equal(asked, 0, "a run of identical members is settled without reading a style");
  } finally {
    delete globals.getComputedStyle;
  }
});
