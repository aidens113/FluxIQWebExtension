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
import { webAutomationOutputNodeId } from "../../../../output-nodes";
import { createWebLlmExtractionHandles } from "../../structure";
import { webLlmHandleRejectionReason } from "../../tool-rejection";
import { createWebLlmTargetPackets, resolveWebPlanNodeParameters } from "..";

test("pages that disagree make a bare handle ambiguous, and each page still answers for itself", () => {
  const targets = createWebLlmTargetPackets();
  const scope = { projectId: "project.one", flowId: "flow.one" };
  const show = (url: string, element: JsonObject): void => targets.remember(scope, sanitizeWebLlmSnapshotWithBindings({ url, interactiveElements: [element] }));
  show("https://example.test/a", { tagName: "button", selector: "#renamed", visibleText: "Renamed" });
  show("https://example.test/b", { tagName: "button", selector: "#renamed", visibleText: "Renamed" });
  assert.equal(targets.resolve(scope, "t1", undefined).ok, true, "pages that agree leave it resolvable bare");
  show("https://example.test/c", { tagName: "a", selector: "#other", visibleText: "Other" });
  assert.deepEqual(targets.resolve(scope, "t1", undefined), { ok: false, code: "ambiguous" });
  const at = (location: string): string => {
    const resolution = targets.resolve(scope, "t1", location);
    return resolution.ok ? resolution.selector : resolution.code;
  };
  assert.equal(at("https://example.test/c"), "#other");
  assert.equal(at("https://example.test/a"), "#renamed");
});

// A rerun puts its page back by reloading it, and a reload can renumber the
// page's handles (`run-musq0b1m-0472cfa0`, Cause 4: 7-in-1 was `t985` on one
// load and `t1194` on the next, and the rerun's handle from before the reload
// was refused `handle_not_in_packet` with nothing saying why). The store knows
// both halves from what it was given: the newer view of the same page arrived
// by reload (`navigation.type`), and the control the handle named is in it
// under another handle. Such a handle is still unknown, and says so.

const ITEM = "https://shop.example/item/1";

function view(navigationType: string | undefined, elements: JsonObject[]) {
  const snapshot: JsonObject = { url: ITEM, interactiveElements: elements };
  if (navigationType !== undefined) snapshot.evidence = { navigation: { url: ITEM, origin: "https://shop.example", path: "/item/1", type: navigationType, historyLength: 2, visibility: "visible" } };
  return sanitizeWebLlmSnapshotWithBindings(snapshot);
}

const SPEC = (name: string, selector: string): JsonObject => ({ tagName: "div", selector, visibleText: name, hasClickHandler: true });

test("a handle shown before a reload, whose control the reloaded page shows under another handle, is unknown because the page was reloaded", () => {
  const targets = createWebLlmTargetPackets();
  const scope = { projectId: "project.one", flowId: "flow.one" };
  targets.remember(scope, view(undefined, [SPEC("4-in-1", "#a > div:nth-of-type(1)"), SPEC("10-in-1", "#a > div:nth-of-type(3)"), SPEC("7-in-1", "#a > div:nth-of-type(2)")]));
  assert.equal(targets.resolve(scope, "t3", ITEM).ok, true, "7-in-1 is t3 before the reload");
  // The reload addresses the group differently and lists 7-in-1 second: t3 is gone, and 7-in-1 is t2.
  targets.rememberLook(scope, view("reload", [SPEC("4-in-1", "#fb1 > div:nth-of-type(1)"), SPEC("7-in-1", "#fb1 > div:nth-of-type(2)")]));
  assert.deepEqual(targets.resolve(scope, "t3", ITEM), { ok: false, code: "unknown", renumberedByReload: true });
  assert.deepEqual(targets.resolve(scope, "t3", undefined), { ok: false, code: "unknown", renumberedByReload: true }, "and bare");
  // A handle no view ever carried keeps today's answer.
  assert.deepEqual(targets.resolve(scope, "t9", ITEM), { ok: false, code: "unknown" });
  // Shown again, the handle resolves and the mark goes with it.
  targets.remember(scope, view("reload", [SPEC("4-in-1", "#a > div:nth-of-type(1)"), SPEC("10-in-1", "#a > div:nth-of-type(3)"), SPEC("7-in-1", "#a > div:nth-of-type(2)")]));
  assert.equal(targets.resolve(scope, "t3", ITEM).ok, true);
  targets.remember(scope, view(undefined, [SPEC("4-in-1", "#a > div:nth-of-type(1)")]));
  assert.deepEqual(targets.resolve(scope, "t3", ITEM), { ok: false, code: "unknown" }, "a later drop that was no reload says nothing of one");
});

test("a reload says nothing of a handle whose control is not on the reloaded page, and a re-render without a reload says nothing at all", () => {
  const targets = createWebLlmTargetPackets();
  const scope = { projectId: "project.one", flowId: "flow.one" };
  targets.remember(scope, view(undefined, [SPEC("4-in-1", "#a > div:nth-of-type(1)"), SPEC("7-in-1", "#a > div:nth-of-type(2)")]));
  targets.remember(scope, view("reload", [SPEC("4-in-1", "#a > div:nth-of-type(1)")]));
  assert.deepEqual(targets.resolve(scope, "t2", ITEM), { ok: false, code: "unknown" }, "7-in-1 left the page: the reload did not renumber it");

  const other = { projectId: "project.one", flowId: "flow.two" };
  targets.remember(other, view(undefined, [SPEC("4-in-1", "#a > div:nth-of-type(1)"), SPEC("10-in-1", "#a > div:nth-of-type(3)"), SPEC("7-in-1", "#a > div:nth-of-type(2)")]));
  targets.remember(other, view(undefined, [SPEC("4-in-1", "#a > div:nth-of-type(1)"), SPEC("7-in-1", "#a > div:nth-of-type(2)")]));
  assert.deepEqual(targets.resolve(other, "t3", ITEM), { ok: false, code: "unknown" }, "the same renumbering with no reload is not called one");
});

test("a plan step naming a handle the reload renumbered is refused web.handle.renumbered_by_reload, read as handle_not_in_packet", async () => {
  const targets = createWebLlmTargetPackets();
  const scope = { projectId: "project.one", flowId: "flow.one" };
  targets.remember(scope, view(undefined, [SPEC("4-in-1", "#a > div:nth-of-type(1)"), SPEC("10-in-1", "#a > div:nth-of-type(3)"), SPEC("7-in-1", "#a > div:nth-of-type(2)")]));
  targets.rememberLook(scope, view("reload", [SPEC("4-in-1", "#fb1 > div:nth-of-type(1)"), SPEC("7-in-1", "#fb1 > div:nth-of-type(2)")]));
  const resolve = (handle: string) => resolveWebPlanNodeParameters(
    { ...scope, nodeDefinitionId: webAutomationOutputNodeId("web.dom.click"), parameters: { target: { handle, location: ITEM } }, gatedByCaller: true },
    { targets, extractions: createWebLlmExtractionHandles() }
  );
  const renumbered = await resolve("t3");
  assert.equal(renumbered.status, "refused");
  if (renumbered.status !== "refused") return;
  assert.equal(renumbered.issueCodes.includes("web.handle.renumbered_by_reload"), true, JSON.stringify(renumbered.issueCodes));
  assert.equal(renumbered.issueCodes.includes("web.handle.unknown"), false);
  assert.equal(webLlmHandleRejectionReason(renumbered.issueCodes), "handle_not_in_packet");
  // A handle no view ever carried keeps today's code.
  const never = await resolve("t9");
  assert.equal(never.status === "refused" && never.issueCodes.includes("web.handle.unknown"), true, JSON.stringify(never));
});

// U-B3-3 (lane B round 3, `run-mux6pndp-16feb842`): a size chip lays its name
// and its price out as two lines, and its captured text runs them together.
// The identity keeps that text whole, since the page compares it; the
// resolution carries the words a person reads beside it, never in it.
test("a resolution names a control by its readable words beside an identity that keeps the captured text, and a secret control by nothing", () => {
  const targets = createWebLlmTargetPackets();
  const scope = { projectId: "project.one", flowId: "flow.one" };
  targets.remember(scope, sanitizeWebLlmSnapshotWithBindings({
    url: ITEM,
    interactiveElements: [
      { tagName: "button", selector: "#size-12", visibleText: "12 Double Rolls$16.47", readableText: "12 Double Rolls $16.47" },
      { tagName: "button", selector: "#add", visibleText: "Add to cart" },
      { tagName: "input", selector: "#pw", inputType: "password", accessibleName: "Pass word", readableText: "Pass  word" }
    ]
  }));
  const chip = targets.resolve(scope, "t1", undefined);
  assert.equal(chip.ok, true);
  if (!chip.ok) return;
  assert.equal(chip.words, "12 Double Rolls $16.47");
  assert.equal(chip.element.visibleText, "12 Double Rolls$16.47", "the identity the page compares is the captured text");
  const add = targets.resolve(scope, "t2", undefined);
  assert.equal(add.ok && add.words, undefined, "a control whose words read as captured carries no second spelling");
  const secret = targets.resolve(scope, "t3", undefined);
  if (secret.ok) {
    assert.equal(secret.words, undefined);
    assert.equal(secret.element.accessibleName, undefined);
  }
});
