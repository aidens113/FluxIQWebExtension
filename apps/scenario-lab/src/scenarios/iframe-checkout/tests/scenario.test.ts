import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import type { ScenarioRouteRequest } from "../../../types.js";
import { orderLines } from "../order-lines.js";
import { iframeCheckoutScenario as scenario } from "../scenario.js";

const { manifest } = scenario;
const context = { runToken: "iframe-checkout-run-token", seed: 105, alternateOrigin: "http://127.0.0.1:4321" };
const request = (subpath: string): ScenarioRouteRequest => ({ subpath, query: new URLSearchParams(), method: "GET" });
const frameBody = (subpath: string): string => scenario.route?.(scenario.createState(105), request(subpath), context)?.body ?? "";
const lineCount = (html: string) => html.match(/<li data-testid="order-line">/g)?.length ?? 0;

test("manifest is valid and keeps the two-frame click workflow as its primary", () => {
  const result = validateWebScenario(manifest);
  assert.equal(result.valid, true, result.valid ? "" : JSON.stringify(result.issues));
  assert.deepEqual([manifest.id, manifest.seed, manifest.startPath, manifest.networkPolicy], ["iframe-checkout", 105, "/scenarios/iframe-checkout/", "loopback-only"]);
  assert.deepEqual(manifest.capabilities, ["iframe"]);
  const primary = resolveScenarioWorkflow(manifest);
  assert.deepEqual(primary.recordingScript.map(({ operation }) => operation), ["click", "click", "checkpoint"]);
  assert.equal(primary.expected.extracted, undefined, "the click workflow reads no data");
});

test("the fixture declares no extraction workflow, because FluxIQ cannot be asked to read a child frame", () => {
  // An extraction reads the document its action was delivered to, and the
  // definition lane pins the top frame: the picker takes a pick from frame 0
  // alone, and `background/extraction/confirm.ts` dispatches with `frameId: 0`.
  // A workflow whose extract step named this frame would be served by the
  // reference reader, which resolves the frame through Playwright, so it would
  // measure Playwright rather than FluxIQ -- and the intent seam refuses a
  // `frame:` extract target outright. When the confirm path can be given a
  // frame, the workflow and this row come back together.
  assert.equal(manifest.workflows, undefined, "no workflow reads the frame FluxIQ cannot address");
  assert.equal(JSON.stringify(manifest).includes("\"extract\""), false, "and no extract step survives anywhere in the manifest");
  assert.equal(scenario.route?.(scenario.createState(105), request("same-frame"), context)?.body?.includes('data-testid="order-lines"'), true, "the lines stay in the frame, so the workflow is a paste away");
});

test("the same-origin frame lists every expected order line, each field in its own element", () => {
  const html = frameBody("same-frame");
  assert.equal(lineCount(html), orderLines.length);
  assert.ok(html.includes('<ul data-testid="order-lines">'));
  for (const line of orderLines) {
    assert.ok(html.includes(`<span data-testid="order-line-item">${line.item}</span>`), line.item);
    assert.ok(html.includes(`<span data-testid="order-line-quantity">${line.quantity}</span>`), line.quantity);
    assert.ok(html.includes(`<span data-testid="order-line-amount">${line.amount}</span>`), line.amount);
  }
  // Amounts are distinct, so a record read off the wrong line cannot match by accident.
  assert.equal(new Set(orderLines.map((line) => line.amount)).size, orderLines.length);
  // The frame keeps the control the primary workflow clicks.
  assert.ok(html.includes('data-testid="same-frame-action"'));
  assert.ok(html.includes('<p data-testid="frame-result" aria-live="polite">Pending</p>'));
});

test("the cross-origin frame lists no order lines, so a read across origins cannot pass for this workflow", () => {
  const html = frameBody("cross-frame");
  assert.equal(lineCount(html), 0);
  assert.ok(!html.includes('data-testid="order-lines"'));
  assert.ok(html.includes('data-testid="cross-frame-action"'));
  const response = scenario.route?.(scenario.createState(105), request("cross-frame"), context);
  assert.match(response?.headers?.["content-security-policy"] ?? "", /frame-ancestors http:\/\/127\.0\.0\.1:\*/u);
  assert.equal(scenario.route?.(scenario.createState(105), request("missing-frame"), context), undefined);
});

test("the start document embeds both frames and the fixture state stays the two click counters", () => {
  const html = scenario.render(scenario.createState(105), context);
  assert.ok(html.includes('title="Same-origin checkout" data-testid="same-frame" src="/scenarios/iframe-checkout/same-frame"'));
  assert.ok(html.includes(`title="Cross-origin checkout" data-testid="cross-frame" src="${context.alternateOrigin}/scenarios/iframe-checkout/cross-frame"`));
  assert.equal(lineCount(html), 0, "the order lines live in the frame, not in the top document");

  // The state shape is asserted exactly by e2e/scenario-pages.spec.ts, so
  // reading the order lines must not add a field to it.
  const state = scenario.createState(105);
  assert.deepEqual(state, { sameOriginClicks: 0, crossOriginClicks: 0 });
  assert.deepEqual(scenario.mutate(state, "same", {}), { sameOriginClicks: 1, crossOriginClicks: 0 });
  assert.deepEqual(scenario.mutate(state, "cross", {}), { sameOriginClicks: 0, crossOriginClicks: 1 });
  assert.equal(scenario.mutate(state, "unknown", {}), state);
});
