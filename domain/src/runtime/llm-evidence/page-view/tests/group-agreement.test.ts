// One group naming across the packet (t610): an option in an ARIA group carries
// the same `group` in the packet, in the page view, in what the state digest
// hashes and in what tells look-alikes apart. The groups are resolved once, in
// the sanitizer, by `../group-names.ts`.
//
// The page is a cafe's order form, not one of the realistic scenarios.

import assert from "node:assert/strict";
import test from "node:test";
import { webLlmElementDescription } from "../../look-alikes";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";
import { webLlmStateDigest } from "../../state-digest";
import { publishedWebLlmPage } from "../published-page";

type Raw = Record<string, unknown>;

function raw(tagName: string, selector: string, row: number, fields: Raw): Raw {
  const bounds = { x: 20, y: 100 + row * 24, width: 220, height: 20 };
  return { tagName, selector, documentBounds: bounds, bounds, isVisibleOnViewport: true, context: { landmark: "main" }, ...fields };
}

function radio(selector: string, row: number, words: string, parent: number): Raw {
  return raw("input", selector, row, { inputType: "radio", accessibleName: words, checked: false, parent });
}

function sanitized() {
  return sanitizeWebLlmSnapshotWithBindings({
    url: "https://cafe.test/order",
    title: "Order a coffee",
    viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0, documentWidth: 1280, documentHeight: 720, devicePixelRatio: 1 },
    interactiveElements: [
      /* t1 */ raw("span", "#shot-label", 0, { visibleText: "Extra shot", attributes: { id: "shot-label" } }),
      /* t2 */ raw("div", "#shot", 1, { role: "radiogroup", accessibleName: "Extra shot", attributes: { role: "radiogroup", "aria-labelledby": "shot-label" }, ownText: "" }),
      /* t3 */ radio("#shot-none", 1, "None", 1),
      /* t4 */ radio("#shot-one", 2, "One", 1),
      /* t5 */ raw("div", "#syrup", 3, { role: "radiogroup", accessibleName: "Syrup", attributes: { role: "radiogroup", "aria-label": "Syrup" }, ownText: "" }),
      /* t6 */ radio("#syrup-none", 4, "None", 4),
      /* t7 */ radio("#syrup-vanilla", 5, "Vanilla", 4)
    ]
  });
}

test("an ARIA-grouped option's packet group is the group its view line ends with", () => {
  const { evidence } = sanitized();
  const groupOf = (target: string) => evidence.elements.find((element) => element.target === target)?.group;
  assert.deepEqual(["t3", "t4", "t6", "t7"].map(groupOf), ["Extra shot", "Extra shot", "Syrup", "Syrup"]);
  assert.equal(groupOf("t1"), undefined, "the label is outside the group it names");
  const page = publishedWebLlmPage(evidence).page.split("\n");
  for (const target of ["t3", "t4", "t6", "t7"]) {
    const line = page.find((candidate) => candidate.startsWith(`${target} `));
    assert.ok(line?.endsWith(` group="${groupOf(target)}"`), `${target}: ${line}`);
  }
});

test("two alike options in different ARIA groups are told apart by their group, not by a count", () => {
  const { evidence } = sanitized();
  const [shotNone, syrupNone] = ["t3", "t6"].map((target) => evidence.elements.find((element) => element.target === target)!);
  assert.notEqual(webLlmElementDescription(shotNone!), webLlmElementDescription(syrupNone!));
  assert.equal(shotNone!.alike, undefined);
  assert.equal(syrupNone!.alike, undefined);
});

test("the state digest hashes the packet's group", () => {
  const { evidence } = sanitized();
  const digest = webLlmStateDigest(evidence);
  assert.equal(webLlmStateDigest(sanitized().evidence), digest, "the same page digests the same");
  const regrouped = structuredClone(evidence);
  regrouped.elements.find((element) => element.target === "t6")!.group = "Extra shot";
  assert.notEqual(webLlmStateDigest(regrouped), digest);
});
