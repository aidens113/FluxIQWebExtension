// Everything a model reads about this domain's nodes speaks of an element's
// handle and never asks for a selector, a locator, CSS or XPath (t432).
//
// The user's rule (2026-10-10): every saved element carries the full
// multi-signal fingerprint, and "the LLM model shouldnt have to worry about any
// of that, that's all handled by extension". The model reads each node as
// Core's catalog lists it -- by name with its description in the build's
// catalog, and whole once described (`core.describe_nodes`) -- so this builds
// that catalog from the real definitions and holds every word of it: each
// node's label and description, and each parameter it shows with its id,
// description and example. Only a node's id is exempt: `wait_for_selector`
// names a saved action, and renaming it would orphan every Flow that holds it.
// The domain's system instructions are held to the same words.

import assert from "node:assert/strict";
import test from "node:test";
import { buildAutomationStudioFlowBootstrapContext } from "fluxiq/automation-studio";
import { AutomationStudioNodeRegistry } from "fluxiq/automation-studio/nodes";
import { WEB_AUTOMATION_DOMAIN_ID } from "../..";
import { WEB_LLM_SYSTEM_INSTRUCTIONS } from "../../runtime/llm-evidence/system-instructions";
import { listWebAutomationOutputNodeDefinitions, WEB_AUTOMATION_RUNTIME_CAPABILITIES, WEB_AUTOMATION_RUNTIME_PERMISSIONS } from "..";

/** The words that name how a page finds an element, which a model is never asked for. */
const LOCATOR_WORDS = /\b(?:css|xpath|selectors?|locators?)\b/iu;

const resolution = { scope: { kind: "domain" as const, domainId: WEB_AUTOMATION_DOMAIN_ID }, runtimeCapabilities: WEB_AUTOMATION_RUNTIME_CAPABILITIES, permissions: WEB_AUTOMATION_RUNTIME_PERMISSIONS };
const definitions = listWebAutomationOutputNodeDefinitions();
const catalog = buildAutomationStudioFlowBootstrapContext({ registry: new AutomationStudioNodeRegistry(definitions), resolution }).nodeCatalog
  .filter((entry) => definitions.some((definition) => definition.id === entry.id));

test("the catalog lists every one of this domain's nodes", () => {
  assert.equal(catalog.length, definitions.length);
});

test("no node's catalog entry asks for a selector, a locator, CSS or XPath", () => {
  for (const entry of catalog) {
    const { id: _id, ...shown } = entry;
    assert.doesNotMatch(JSON.stringify(shown), LOCATOR_WORDS, entry.id);
  }
});

test("an element node shows only `target`, described as the handle the page view printed, and never the address or identity it is filled into", () => {
  const elementNodes = definitions.filter((definition) => definition.metadata?.elementTarget === true).map((definition) => definition.id);
  assert.ok(elementNodes.length >= 6, "the element nodes are found");
  for (const id of elementNodes) {
    const entry = catalog.find((candidate) => candidate.id === id)!;
    const shown = entry.parameters.map((parameter) => parameter.id);
    for (const hidden of ["selector", "element", "visualTarget"]) assert.equal(shown.includes(hidden), false, `${id} shows ${hidden}`);
    const target = entry.parameters.find((parameter) => parameter.id === "target");
    assert.match(String(target?.description), /handle the page view printed/u, id);
    assert.deepEqual(target?.example, { handle: "t5" }, id);
  }
  // The definition still declares them, so a saved Flow that holds them validates and runs; and the press declares
  // the `ensureState` Core gives a toggle step (t775), which no model is shown either.
  const click = definitions.find((definition) => definition.id === "web.output.dom-click")!;
  assert.deepEqual(click.parameters.filter((parameter) => parameter.shownToModel === false).map((parameter) => parameter.id), ["selector", "element", "visualTarget", "ensureState"]);
  assert.equal(catalog.find((entry) => entry.id === "web.output.dom-click")!.parameters.some((parameter) => parameter.id === "ensureState"), false);
});

test("waiting for an element names it by handle, and waiting for text stays", () => {
  const wait = catalog.find((entry) => entry.id === "web.output.dom-wait_for_selector")!;
  assert.equal(wait.label, "Wait For Element");
  assert.match(wait.description, /handle/u);
  assert.ok(catalog.some((entry) => entry.id === "web.output.dom-wait_for_text"));
});

test("the domain's own instructions to a model never ask for one either", () => {
  assert.doesNotMatch(JSON.stringify(WEB_LLM_SYSTEM_INSTRUCTIONS), LOCATOR_WORDS);
});
