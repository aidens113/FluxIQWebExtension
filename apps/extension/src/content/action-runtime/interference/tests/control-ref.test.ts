// The durable target of a pressed way out (CC7, interface I1): the parameters a
// transient `web.dom.click` runs with at run time, `{ selector, element }`, with no handle.
//
// Held here, end to end on a library catalogue: the control a dismissal pressed
// on one visit is described (`controlRefOf`); read back by the domain the way a
// click step reads its parameters (`outputTargetFromPayload`); and resolved
// against a FRESH page view -- another document built from the same markup,
// with other content before it -- to the same control, and to no other. A
// different layer's "Maybe later" is not it.
//
// The runner is Node, so the pages are the hand-built documents of
// `../../../tests/stub-dom.ts`; resolution against a real page is the content
// harness's.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { outputTargetFromPayload, webAutomationActionFromGatewayCommand } from "@fluxiq-web-extension/domain/client";
import type { JsonObject } from "fluxiq/core";
import { el, installStubDocument, stubDocument, type StubElement } from "../../../tests/stub-dom";
import type { BrowserActionCommand } from "../../../types";
import { resolveTarget } from "../../resolve-target";
import { controlRefOf } from "../obstruction";

type Catalogue = { later: Element; dialog: Element };

/** The catalogue with the reading-list offer up. `before` is whatever else the visit has drawn ahead of it. */
function installCatalogue(t: TestContext, before: StubElement[] = [], other = false): Catalogue {
  const document = stubDocument();
  const later = el("button", { type: "button" }, "Maybe later");
  const offer = el("div", { role: "dialog", "aria-modal": "true", "aria-label": "Reading list newsletter" },
    el("h2", {}, "Reading list newsletter"),
    el("p", {}, "New titles in your inbox every week."),
    el("div", {}, later, el("button", { type: "button" }, "Subscribe me")));
  const second = other
    ? el("div", { role: "dialog", "aria-modal": "true", "aria-label": "Cookie settings" }, el("p", {}, "We use cookies."), el("button", { type: "button" }, "Maybe later"))
    : undefined;
  document.append(el("html", {}, el("body", {}, el("main", {}, el("h1", {}, "Garden catalogue"), ...before), offer, ...(second ? [second] : []))));
  installStubDocument(t, document);
  return { later: later as unknown as Element, dialog: offer as unknown as Element };
}

/** The click a Flow's transient node would be: `controlRef` as its parameters, run as the domain runs a click step (no `target` around them). */
function clickOn(controlRef: Record<string, unknown>): BrowserActionCommand {
  const parameters = structuredClone(controlRef) as JsonObject;
  const target = outputTargetFromPayload(parameters);
  assert.ok(target, "the click step reads the controlRef parameters as a target");
  const command = webAutomationActionFromGatewayCommand({ commandId: "cmd-way-out", actionType: "web.dom.click", parameters, target });
  assert.equal("status" in command, false, "the command is dispatched");
  return command as unknown as BrowserActionCommand;
}

test("the control pressed is described by identity alone: its address, role, name, text and the layer it sat in", (t) => {
  const { later } = installCatalogue(t);
  const ref = controlRefOf(later);
  assert.ok(ref);
  assert.equal(typeof ref.selector, "string");
  const element = ref.element as Record<string, unknown>;
  assert.equal(element.tagName, "button");
  assert.equal(element.accessibleName, "Maybe later");
  assert.equal(element.visibleText, "Maybe later");
  assert.equal((element.context as Record<string, unknown> | undefined)?.dialog, "Reading list newsletter");
  // No handle, no box, no value: nothing that is gone with the view or says where the control was drawn.
  assert.deepEqual(Object.keys(ref).sort(), ["element", "selector"]);
  assert.equal(Object.hasOwn(element, "bounds"), false);
  assert.ok(JSON.stringify(ref).length < 2_000);
});

test("a fresh page view resolves the controlRef to the same control of the same layer", (t) => {
  const ref = controlRefOf(installCatalogue(t).later);
  assert.ok(ref);
  // Another visit: other content ahead of the offer, the same offer.
  const fresh = installCatalogue(t, [el("p", {}, "3 new titles this week")]);
  const resolved = resolveTarget(clickOn(ref));
  assert.equal(resolved.element, fresh.later);
});

test("it does not resolve to another layer's control with the same words", (t) => {
  const ref = controlRefOf(installCatalogue(t).later);
  assert.ok(ref);
  const fresh = installCatalogue(t, [], true);
  const resolved = resolveTarget(clickOn(ref));
  assert.equal(resolved.element, fresh.later, "the offer's own, not the cookie sheet's");
});
