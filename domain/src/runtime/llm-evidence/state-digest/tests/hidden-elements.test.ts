// A search captures hidden elements as well; a look does not (t223). Both are
// captures of one page, so both must report the same state digest and the same
// route state, or a search would read to Core as the page having changed.

import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";
import { webLlmSnapshotStates } from "../snapshot-states";

const rendered = [
  { tagName: "main", selector: "main" },
  { tagName: "button", selector: "#add", visibleText: "Add to cart", parent: 0 },
  { tagName: "a", selector: "#next", visibleText: "Next page", href: "/page/2", parent: 0 }
];

const withHidden = [
  rendered[0],
  { tagName: "div", selector: "#menu", hidden: true, parent: 0 },
  { tagName: "button", selector: "#secret-offer", visibleText: "Claim offer", hidden: true, parent: 1 },
  rendered[1],
  { tagName: "input", selector: "#trap", hidden: true, label: "Search in", parent: 0 },
  rendered[2]
];

function states(elements: unknown[], viewport?: unknown) {
  return webLlmSnapshotStates(sanitizeWebLlmSnapshotWithBindings({ url: "https://shop.test/results", title: "Results", viewport, interactiveElements: elements }));
}

test("a binding with hidden elements digests equal to the same binding without them", () => {
  assert.equal(states(withHidden).stateDigest, states(rendered).stateDigest);
});

test("a binding with hidden elements has the same route state as the same binding without them", () => {
  const searched = states(withHidden).routeState;
  assert.deepEqual(searched, states(rendered).routeState);
  assert.doesNotMatch(JSON.stringify(searched), /Claim offer/u, "a hidden control is not one of the page's controls");
});

test("a hidden element that is not there changes nothing, but a rendered one still does", () => {
  const grown = [...rendered, { tagName: "button", selector: "#more", visibleText: "Show more", parent: 0 }];
  assert.notEqual(states(grown).stateDigest, states(rendered).stateDigest);
});

test("where the window is scrolled is not the state of the page", () => {
  const top = states(rendered, { width: 1280, height: 720, scrollX: 0, scrollY: 0 });
  const scrolled = states(rendered, { width: 1280, height: 720, scrollX: 0, scrollY: 2000 });
  assert.equal(scrolled.stateDigest, top.stateDigest);
});
