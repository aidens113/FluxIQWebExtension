// What a text assertion that did not hold says about the text it claimed
// (t369): the page's sighting of it -- hidden or absent, and the shown text
// most like it -- rides in the evidence of both the STATE_MISMATCH and the
// TIMEOUT result. A claim that held, and a claim about anything but text, never
// ask for it.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebAutomationTextSighting } from "@fluxiq-web-extension/domain/client";
import type { ActionResultEvidence, AssertionOutcome } from "../../action-runtime";
import { assertAction } from "../assert";
import type { ContentActionDependencies } from "../types";
import type { BrowserActionCommand, BrowserActionResult, BrowserActionValidation } from "../../types";

const SIGHTING: WebAutomationTextSighting = { textPresence: "hidden", visibleNear: ["Cart"] };

function stub(outcome: Partial<AssertionOutcome>): { deps: ContentActionDependencies; evidence: Array<ActionResultEvidence | undefined>; asked: string[] } {
  const evidence: Array<ActionResultEvidence | undefined> = [];
  const asked: string[] = [];
  const build = (status: BrowserActionResult["status"]) => (action: BrowserActionCommand, startedAt: number, message: string, validation: BrowserActionValidation, given?: ActionResultEvidence): BrowserActionResult => {
    evidence.push(given);
    return { commandId: action.commandId, actionType: action.actionType, status, validation, message, startedAt, finishedAt: startedAt + 1 };
  };
  const full: AssertionOutcome = { held: false, expected: "the page contains \"Cart (3)\"", actual: "the page reads \"Deals\"", judged: true, waitExpired: true, timeoutMs: 200, elapsedMs: 200, attempts: 3, ...outcome };
  const provided = {
    evaluateAssertion: () => Promise.resolve(full),
    sightText: (text: string) => { asked.push(text); return SIGHTING; },
    captureSnapshot: () => ({ url: "https://example.test/", title: "Shop", elements: [] }),
    resolveTarget: () => { throw new Error("no target"); },
    success: build("succeeded"),
    timedOut: build("timed_out")
  };
  const deps = new Proxy(provided as unknown as ContentActionDependencies, {
    get(target, property: string) {
      const found = (target as unknown as Record<string, unknown>)[property];
      if (found === undefined) throw new Error(`the assert path must not touch ${property}`);
      return found;
    }
  });
  return { deps, evidence, asked };
}

const textClaim: BrowserActionCommand = { commandId: "a", actionType: "web.dom.assert", assert: { kind: "text", expected: "Cart (3)" } };

test("a page text claim that did not hold carries the sighting of its text", async () => {
  const { deps, evidence, asked } = stub({});
  await assertAction(textClaim, deps, 1);
  assert.deepEqual(asked, ["Cart (3)"]);
  assert.deepEqual(evidence[0]?.textSighting, SIGHTING);
});

test("a text claim that timed out before it was judged carries it too", async () => {
  const { deps, evidence } = stub({ judged: false });
  await assertAction({ ...textClaim, selector: "#cart-title" }, deps, 1);
  assert.deepEqual(evidence[0]?.textSighting, SIGHTING);
});

test("a text claim that held is unchanged, and a claim about anything but text never asks", async () => {
  const held = stub({ held: true });
  await assertAction(textClaim, held.deps, 1);
  assert.deepEqual(held.asked, []);
  assert.equal(held.evidence[0]?.textSighting, undefined);

  const visible = stub({});
  await assertAction({ commandId: "a", actionType: "web.dom.assert", selector: "#cart", assert: { kind: "visible" } }, visible.deps, 1);
  assert.deepEqual(visible.asked, []);
  assert.equal(visible.evidence[0]?.textSighting, undefined);
});
