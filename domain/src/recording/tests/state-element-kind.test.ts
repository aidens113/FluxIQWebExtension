// Core plus the real web reading classifies a state path as Core alone used to:
// the table below is the answer before the web's words moved here, checked in
// the order the words were read, the cases where the order decides included.

import assert from "node:assert/strict";
import test from "node:test";
import { inferStateElementKind, type StateElementKind, type StateValue } from "fluxiq/automation";
import { createWebAutomationOutputNodeImplementationBundle } from "../../output-nodes";
import { webStateElementKindReader } from "../state-element-kind";

test("the bundle gives Core this reading", () => {
  assert.equal(createWebAutomationOutputNodeImplementationBundle().stateElementKindReader, webStateElementKindReader);
});

test("the web's words are read first, and every other path is Core's", () => {
  const table: ReadonlyArray<readonly [string, StateValue["type"], StateElementKind]> = [
    // The web's words, ahead of any word Core reads.
    ["element.selector", "string", "selector"],
    ["cssSelector", "string", "selector"],
    ["label.selector", "string", "selector"],
    ["selector.testid", "string", "selector"],
    ["element.testid", "string", "static_id"],
    ["element.testId.label", "string", "static_id"],
    ["element.test_id", "string", "static_id"],
    ["test_id.title", "string", "static_id"],
    // Core's words, in Core's order.
    ["account.id", "string", "static_id"],
    ["accountId", "string", "static_id"],
    ["internal.counter", "number", "internal_id"],
    ["field.label", "string", "label"],
    ["page.title", "string", "text"],
    ["toast.message", "string", "text"],
    ["order.status", "string", "status"],
    ["app.route", "string", "route"],
    ["page.url", "string", "url"],
    ["link.href", "string", "url"],
    ["panel.visible", "boolean", "visibility"],
    ["save.enabled", "boolean", "enabled"],
    ["save.disabled", "boolean", "enabled"],
    ["cart.quantity", "number", "count"],
    ["cart.total", "number", "count"],
    ["anything", "point", "position"],
    ["anything", "rectangle", "bounds"],
    ["anything", "entity_ref", "internal_id"],
    ["anything", "json", "json"],
    ["anything", "string", "text"],
    ["anything", "number", "count"],
    ["anything", "boolean", "visibility"]
  ];
  for (const [path, type, kind] of table) assert.equal(inferStateElementKind(path, type, webStateElementKindReader), kind, path);
});
