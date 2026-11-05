// The controls line writes the heading a control fell under where it changes
// (t869, `./../control-mark.ts`), and nothing the route signature, a step's
// effect or a page's own changes compare by reads it.
//
// The proofs: a heading is written once in front of the first control it
// covers and again only where it changes; a name is never cut or changed; a
// heading that only repeats its control's own words is not written; and the
// signature and the effect of a page read the same with the headings as
// without, so a heading neither makes an unchanged page read as changed nor a
// changed page as unchanged.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmEvidenceElement, WebLlmPageEvidence } from "../../llm-evidence";
import { webAutomationRouteSignature, webAutomationRouteState } from "..";
import { webRouteControlName, webRouteMarkedControl } from "../control-mark";
import { webRoutePageFeatures } from "../page-features";

function evidence(elements: readonly Partial<WebLlmEvidenceElement>[]): WebLlmPageEvidence {
  return {
    location: "https://shop.test/search?q=table",
    title: "Search",
    elements: elements.map((element, index) => ({ target: `t${index + 1}`, tag: "a", href: `/p/${index}`, ...element }))
  } as unknown as WebLlmPageEvidence;
}

function page(elements: readonly Partial<WebLlmEvidenceElement>[]) {
  return webAutomationRouteState(evidence(elements));
}

function line(elements: readonly Partial<WebLlmEvidenceElement>[]): unknown {
  return (page(elements).page as Record<string, unknown>).controls;
}

const WITH = [
  { name: "Home" },
  { name: "£350 Dining table", heading: "Results" },
  { name: "£90 Side table", heading: "Results" },
  { name: "£30 Small table", heading: "Results outside your search" },
  { name: "£55 White table", heading: "Results outside your search" }
];
const WITHOUT = WITH.map(({ name }) => ({ name }));

test("a heading is written in front of the first control it covers and again only where it changes", () => {
  assert.equal(line(WITH), "Home | [Results] £350 Dining table | £90 Side table | [Results outside your search] £30 Small table | £55 White table");
});

test("a page with no heading reads exactly as it did", () => {
  assert.equal(line(WITHOUT), "Home | £350 Dining table | £90 Side table | £30 Small table | £55 White table");
});

test("a control seen twice is written once, and the heading goes with the first sighting", () => {
  assert.equal(line([{ name: "Next", heading: "A" }, { name: "Next", heading: "B" }, { name: "Back", heading: "B" }]), "[A] Next | [B] Back");
});

test("a heading with a list separator or a bracket in it cannot split or close the mark", () => {
  const entry = webRouteMarkedControl("Shop | Sale [new]", "Lamp");
  assert.equal(entry, "[Shop / Sale [new)] Lamp");
  assert.equal(webRouteControlName(entry), "Lamp");
});

test("the name under a mark is the name the page offered, and an unmarked entry is its own name", () => {
  assert.equal(webRouteControlName("[Results] £30 Small table"), "£30 Small table");
  assert.equal(webRouteControlName("£30 Small table"), "£30 Small table");
});

test("the route signature of a page is the same with its headings as without", () => {
  assert.deepEqual(webAutomationRouteSignature(page(WITH)), webAutomationRouteSignature(page(WITHOUT)));
  assert.deepEqual(webRoutePageFeatures(page(WITH)), webRoutePageFeatures(page(WITHOUT)));
});

test("a heading that moves a control to another group does not make an unchanged page read as changed", () => {
  const moved = WITH.map((element) => element.name === "£90 Side table" ? { ...element, heading: "Results outside your search" } : element);
  assert.deepEqual(webAutomationRouteSignature(page(moved)), webAutomationRouteSignature(page(WITH)));
});

test("a control that is new still reads as new under a heading", () => {
  const added = [...WITH, { name: "£12 Coaster", heading: "Results outside your search" }];
  assert.notDeepEqual(webAutomationRouteSignature(page(added)), webAutomationRouteSignature(page(WITH)));
  assert.equal(webRoutePageFeatures(page(added)).controlCount, webRoutePageFeatures(page(WITH)).controlCount + 1);
});

test("the controls line of the same page is the same bytes every time", () => {
  assert.equal(line(WITH), line(WITH.map((element) => ({ ...element }))));
});
