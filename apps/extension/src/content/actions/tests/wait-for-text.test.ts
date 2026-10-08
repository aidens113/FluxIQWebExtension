// What a failed wait for text says about the text it wanted (t369).
//
// Lane A round 7 waited for "Cart (3)", which the page held only inside a
// closed mini-cart, and the failure said only that the text did not appear. A
// wait for text to appear that runs out of time now hands the result builder
// the page's sighting of the text -- hidden or absent, and the shown text most
// like it -- and a wait that succeeds is exactly what it was: the sighting is
// not even asked for.
//
// The verb takes the page as injected dependencies, so it runs in Node: the
// stub's builders record the evidence they were given, and every capability
// the path should not touch throws if reached.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebAutomationTextSighting } from "@fluxiq-web-extension/domain/client";
import type { ActionResultEvidence, WaitConditionOutcome } from "../../action-runtime";
import { waitForTextAction } from "../wait-for-text";
import type { ContentActionDependencies } from "../types";
import type { BrowserActionCommand, BrowserActionResult, BrowserActionValidation } from "../../types";

type Built = { builder: "success" | "timedOut"; evidence: ActionResultEvidence | undefined };

const HIDDEN: WebAutomationTextSighting = { textPresence: "hidden", visibleNear: ["Cart", "View cart"] };

function stub(outcome: WaitConditionOutcome, sightText: (text: string) => WebAutomationTextSighting | undefined): { deps: ContentActionDependencies; built: Built[]; asked: string[] } {
  const built: Built[] = [];
  const asked: string[] = [];
  const build = (builder: Built["builder"]) => (action: BrowserActionCommand, startedAt: number, message: string, validation: BrowserActionValidation, evidence?: ActionResultEvidence): BrowserActionResult => {
    built.push({ builder, evidence });
    return { commandId: action.commandId, actionType: action.actionType, status: builder === "success" ? "succeeded" : "timed_out", validation, message, startedAt, finishedAt: startedAt + 1 };
  };
  const provided = {
    waitForCondition: () => Promise.resolve(outcome),
    sightText: (text: string) => { asked.push(text); return sightText(text); },
    captureSnapshot: () => ({ url: "https://example.test/", title: "Shop", elements: [] }),
    success: build("success"),
    timedOut: build("timedOut")
  };
  const deps = new Proxy(provided as unknown as ContentActionDependencies, {
    get(target, property: string) {
      const found = (target as unknown as Record<string, unknown>)[property];
      if (found === undefined) throw new Error(`the wait-for-text path must not touch ${property}`);
      return found;
    }
  });
  return { deps, built, asked };
}

const timedOut = (condition: WaitConditionOutcome["condition"]): WaitConditionOutcome => ({ ok: false, condition, actual: "the text did not appear before the timeout", waitedMs: 5_000 });

test("a wait for text held only in a hidden flyout reports it hidden, with the shown text beside it", async () => {
  const { deps, built, asked } = stub(timedOut("present"), () => HIDDEN);
  const result = await waitForTextAction({ commandId: "w", actionType: "web.dom.wait_for_text", text: "Cart (3)" }, deps, 1);
  assert.equal(result.status, "timed_out");
  assert.deepEqual(asked, ["Cart (3)"]);
  assert.deepEqual(built[0]?.evidence?.textSighting, HIDDEN);
});

test("a wait for visible text that the page does not hold reports it absent", async () => {
  const absent: WebAutomationTextSighting = { textPresence: "absent", visibleNear: [] };
  const { deps, built } = stub(timedOut("visible"), () => absent);
  await waitForTextAction({ commandId: "w", actionType: "web.dom.wait_for_text", text: "Order placed", wait: { condition: "visible" } }, deps, 1);
  assert.deepEqual(built[0]?.evidence?.textSighting, absent);
});

test("a wait that succeeds is unchanged: the sighting is never asked for", async () => {
  const { deps, built, asked } = stub({ ok: true, condition: "present", actual: "the text was found", waitedMs: 3 }, () => HIDDEN);
  const result = await waitForTextAction({ commandId: "w", actionType: "web.dom.wait_for_text", text: "Cart (0)" }, deps, 1);
  assert.equal(result.status, "succeeded");
  assert.deepEqual(asked, []);
  assert.deepEqual(Object.keys(built[0]?.evidence ?? {}), ["snapshot"]);
});

test("a wait for text to go is not explained by where the text is, nor a URL or a quiet page", async () => {
  for (const condition of ["absent", "url", "stable"] as const) {
    const { deps, built, asked } = stub(timedOut(condition), () => HIDDEN);
    await waitForTextAction({ commandId: "w", actionType: "web.dom.wait_for_text", text: "Loading", wait: { condition, url: "/done" } }, deps, 1);
    assert.deepEqual(asked, [], condition);
    assert.equal(built[0]?.evidence?.textSighting, undefined, condition);
  }
});

test("the page showing the text elsewhere sends no sighting", async () => {
  const { deps, built } = stub(timedOut("present"), () => undefined);
  await waitForTextAction({ commandId: "w", actionType: "web.dom.wait_for_text", text: "Cart (3)" }, deps, 1);
  assert.equal(built[0]?.evidence?.textSighting, undefined);
  assert.ok(!("textSighting" in (built[0]?.evidence ?? {})));
});
