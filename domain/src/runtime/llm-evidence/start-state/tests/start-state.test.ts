// Where the page stands against where a build began (t462, `../`): the web
// domain's answer to Core's `startState`, read through the bound runtime.

import assert from "node:assert/strict";
import test from "node:test";
import { automationStudioActionPermissionDenied } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { webStartStateFromEvidence, WEB_START_STATE_SCHEMA_VERSION } from "..";
import { createWebAutomationLlmEvidenceRuntime } from "../..";
import type { WebLlmEvidenceGateway } from "../../capture";
import { webLlmPageText } from "../../page-view";
import { sanitizeWebLlmSnapshot } from "../../sanitize";

const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
const request = { projectId: "project", flowId: "flow", callId: "start", permission: automationStudioActionPermissionDenied };

type Snapshot = Record<string, unknown>;

const cart = (count: number, extra: Snapshot["interactiveElements"] = [], url = "https://shop.test/cart"): Snapshot => ({
  url,
  title: "Cart",
  interactiveElements: [
    { tagName: "a", selector: "#home", visibleText: "Home", bounds: box(0, 0, 50, 20) },
    { tagName: "p", selector: "#count", visibleText: `${count} items in cart`, bounds: box(0, 40, 200, 20) },
    { tagName: "button", selector: "#add", visibleText: "Add to cart", bounds: box(100, 300, 120, 40) },
    { tagName: "button", selector: "#buy", visibleText: "Buy now", bounds: box(300, 300, 120, 40) },
    { tagName: "p", selector: "#ledger", visibleText: `Ledger: ${count} reserved`, hidden: true },
    { tagName: "input", selector: "#password", inputType: "password", value: "private-marker", hidden: true },
    ...(extra as unknown[])
  ]
});

/** The same cart behind a consent wall: a backdrop, a modal dialog and its controls. */
const walled = (count: number): Snapshot => Object.assign(cart(count, [
    { tagName: "div", selector: "#backdrop", bounds: box(0, 0, 1280, 800), frontLayer: true },
    { tagName: "div", selector: "#consent", role: "dialog", accessibleName: "We value your privacy", bounds: box(200, 200, 400, 300), frontLayer: true },
    { tagName: "p", selector: "#consent-text", visibleText: "We and our partners use cookies.", bounds: box(220, 240, 360, 60), frontLayer: true },
    { tagName: "button", selector: "#accept", visibleText: "Accept all", bounds: box(250, 400, 120, 40), frontLayer: true }
  ]), {
  evidence: {
    dialogs: { modal: true, open: [{ selector: "#consent", role: "dialog", modal: true, native: false, label: "We value your privacy", bounds: box(200, 200, 400, 300), kind: "consent" }] },
    overlays: { tested: 4, blockedCount: 2, blockers: [{ selector: "#backdrop", blocks: 2, blocked: ["#add", "#buy"], bounds: box(0, 0, 1280, 800), kind: "consent" }] }
  }
});

/** A runtime whose page is each snapshot in turn, and the commands it was sent. */
function runtimeOver(...snapshots: Snapshot[]) {
  const commands: Array<{ actionType: string; parameters: unknown }> = [];
  const gateway: WebLlmEvidenceGateway = { eligibleSessionIds: () => ["session"], executeAction: async (_session, command) => {
    commands.push(command as { actionType: string; parameters: unknown });
    const snapshot = snapshots[Math.min(commands.length - 1, snapshots.length - 1)]!;
    return { status: "succeeded", payload: { snapshot: snapshot as JsonObject } };
  } };
  return { runtime: createWebAutomationLlmEvidenceRuntime(gateway), commands };
}

async function compare(first: Snapshot, second: Snapshot) {
  const { runtime, commands } = runtimeOver(first, second);
  const start = await runtime.startState!(request);
  assert.ok(start);
  assert.deepEqual(start.differs, [], "the first ask has nothing to compare with");
  const now = await runtime.startState!({ ...request, start: start.state });
  assert.ok(now);
  return { start, now, commands };
}

test("the bound runtime exposes startState: a passive look with hidden state, and the same page differs in nothing", async () => {
  const { start, now, commands } = await compare(cart(3), cart(3));
  assert.equal(start.state.schemaVersion, WEB_START_STATE_SCHEMA_VERSION);
  assert.equal(start.state.location, "https://shop.test/cart");
  assert.equal(start.state.title, "Cart");
  const lines = start.state.lines as string[];
  assert.ok(lines.some((line) => line.includes("3 items in cart")));
  assert.ok(lines.some((line) => line.includes("Ledger: 3 reserved") && line.includes("\"hidden\":true")), "non-rendered state is part of the state");
  assert.deepEqual(now.differs, []);
  assert.deepEqual(commands.map((command) => [command.actionType, command.parameters]), [
    ["web.dom.capture_snapshot", { includeHidden: true }],
    ["web.dom.capture_snapshot", { includeHidden: true }]
  ]);
  const serialized = JSON.stringify([start, now]);
  assert.doesNotMatch(serialized, /#count|#ledger|#password|private-marker|selector/u, "no selector or screened value leaves");
  assert.ok(lines.every((line) => !/\bt[1-9][0-9]*\b/u.test(line.replace(/"(?:[^"\\]|\\.)*"/gu, ""))), "no handle is kept");
});

test("a changed count reads as a gone and new pair, rendered and hidden", async () => {
  const { now } = await compare(cart(3), cart(4));
  assert.deepEqual(now.differs.map((entry) => entry.split(":")[0]), ["gone", "gone", "new", "new"]);
  assert.ok(now.differs[0]!.includes("3 items in cart"));
  assert.ok(now.differs[1]!.includes("Ledger: 3 reserved"));
  assert.ok(now.differs[2]!.includes("4 items in cart"));
  assert.ok(now.differs[3]!.includes("Ledger: 4 reserved"));
});

test("a location change comes first, then what is gone, then what is new; repeats are counted", async () => {
  const twice = [{ tagName: "button", selector: "#add-2", visibleText: "Add to cart", bounds: box(100, 360, 120, 40) }];
  const { now } = await compare(cart(3, twice), cart(3, [], "https://shop.test/cart?step=2"));
  assert.equal(now.differs[0], "location: https://shop.test/cart -> https://shop.test/cart?step=2");
  assert.deepEqual(now.differs.slice(1).map((entry) => entry.split(":")[0]), ["gone"]);
  assert.match(now.differs[1]!, /Add to cart/u);
});

test("handles that differ between captures do not count", () => {
  const evidence = sanitizeWebLlmSnapshot(walled(3));
  const renumbered = JSON.parse(JSON.stringify(evidence).replace(/"t([1-9][0-9]*)"/gu, (_, n: string) => `"t${Number(n) + 40}"`));
  assert.notDeepEqual(renumbered.elements.map((element: { target: string }) => element.target), evidence.elements.map((element) => element.target));
  assert.deepEqual(webStartStateFromEvidence(renumbered), webStartStateFromEvidence(evidence));
});

test("a dialog or covering layer over the page is not the site's state", async () => {
  const { start, now } = await compare(cart(3), walled(3));
  assert.deepEqual(now.differs, [], "a consent wall that opened is an interruption, not a difference");
  const shown = webLlmPageText(sanitizeWebLlmSnapshot(walled(3)));
  assert.match(shown, /Accept all/u, "the model's own view shows the wall");
  assert.match(shown, /covered-by/u, "and the page controls it covers");
  const walledLines = webStartStateFromEvidence(sanitizeWebLlmSnapshot(walled(3))).lines;
  assert.ok(walledLines.every((line) => !/privacy|cookies|Accept all|covered-by/u.test(line)), walledLines.join("\n"));
  assert.deepEqual(walledLines, start.state.lines);
  const { now: changed } = await compare(cart(3), walled(4));
  assert.equal(changed.differs.length, 4, "the page behind the wall is still compared");
});

test("a start this module did not make answers undefined without reading the page", async () => {
  const { runtime, commands } = runtimeOver(cart(3));
  const made = (await runtime.startState!(request))!.state;
  const malformed: JsonObject[] = [
    {},
    { ...made, schemaVersion: "web-start-state.v0" },
    { ...made, lines: [1, 2] },
    { ...made, lines: "3 items in cart" },
    { ...made, location: 7 },
    { ...made, title: ["Cart"] }
  ];
  for (const start of malformed) assert.equal(await runtime.startState!({ ...request, start }), undefined, JSON.stringify(start));
  assert.equal(commands.length, 1);
});

test("an aborted ask dispatches nothing", async () => {
  const { runtime, commands } = runtimeOver(cart(3));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(runtime.startState!({ ...request, signal: controller.signal }));
  assert.equal(commands.length, 0);
});
