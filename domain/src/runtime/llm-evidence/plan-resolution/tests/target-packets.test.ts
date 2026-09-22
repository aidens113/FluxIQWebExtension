// The packet store (`../target-packets.ts`), held on its own.
//
// The authoring tools number handles for the whole Flow
// (`../../stable-handles.ts`), so two pages they show never give one handle to
// different controls and a bare handle resolves (`resolve-plan-node.test.ts`).
// The store still decides what such a handle means -- a Flow whose numbers had
// to start again can produce one -- so the rule is held here against the store
// itself, with packets numbered positionally as the sanitizer numbers them.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";
import { createWebLlmTargetPackets } from "..";

test("pages that disagree make a bare handle ambiguous, and each page still answers for itself", () => {
  const targets = createWebLlmTargetPackets();
  const scope = { projectId: "project.one", flowId: "flow.one" };
  const show = (url: string, element: JsonObject): void => targets.remember(scope, sanitizeWebLlmSnapshotWithBindings({ url, interactiveElements: [element] }));
  show("https://example.test/a", { tagName: "button", selector: "#renamed", visibleText: "Renamed" });
  show("https://example.test/b", { tagName: "button", selector: "#renamed", visibleText: "Renamed" });
  assert.equal(targets.resolve(scope, "target.1", undefined).ok, true, "pages that agree leave it resolvable bare");
  show("https://example.test/c", { tagName: "a", selector: "#other", visibleText: "Other" });
  assert.deepEqual(targets.resolve(scope, "target.1", undefined), { ok: false, code: "ambiguous" });
  const at = (location: string): string => {
    const resolution = targets.resolve(scope, "target.1", location);
    return resolution.ok ? resolution.selector : resolution.code;
  };
  assert.equal(at("https://example.test/c"), "#other");
  assert.equal(at("https://example.test/a"), "#renamed");
});
