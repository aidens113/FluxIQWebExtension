// A saved act's required options are checked by the page's typed state before
// the act runs (t1030). Through the real dispatcher, `executeContentAction`, with
// every page capability injected, so it runs in Node with no DOM: an act whose
// option stands chosen reaches its verb; one whose option does not, or is not
// on the page, never does, and answers OPTION_NOT_CHOSEN, a step that cannot
// run. A garden shop's branch chooser, none of the Lab's realistic scenarios.

import assert from "node:assert/strict";
import test from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation";
import { WEB_AUTOMATION_FAILURE_CODES, isWebAutomationFailureCode, type WebAutomationFailureRecord } from "@fluxiq-web-extension/domain/client";
import { executeContentAction, type ContentActionDependencies } from "../../../actions";
import type { BrowserActionCommand, BrowserActionResult } from "../../../types";
import { TargetResolutionError } from "../..";
import { requiredChoiceUnmet, standsChosen } from "..";

const ADD = "#add";
const COLLECTION = "#branch-collection";

/** The press of "+ Add", requiring Collection chosen first, as Core writes a saved act's node. */
const ACT: BrowserActionCommand = {
  commandId: "cmd-add", actionType: "web.dom.click", selector: ADD,
  requiresChosen: [{ at: { selector: COLLECTION, element: { tagName: "button", text: "Collection" } }, words: "Collection" }]
};

/** A control with these attributes and no class, which no run of like options reads. */
function control(attributes: Record<string, string> = {}, extra: Partial<HTMLInputElement> = {}): Element {
  return { tagName: "BUTTON", classList: { length: 0 }, getAttribute: (name: string) => attributes[name] ?? null, ...extra } as unknown as Element;
}

/** The dependencies: the option resolved to `option` (or not found), the act's own target recorded and failed, and a failure builder. */
function page(option: Element | undefined): { deps: ContentActionDependencies; actResolved: () => number } {
  let acted = 0;
  const failure = (action: BrowserActionCommand, error: unknown, startedAt = 0): BrowserActionResult => {
    const record = (error as { failure?: WebAutomationFailureRecord }).failure;
    return { commandId: action.commandId, actionType: action.actionType, status: "failed", validation: { status: "none", reason: "not-yet-validated" }, message: error instanceof Error ? error.message : "", ...(record && isWebAutomationFailureCode(record.code) ? { failure: record } : {}), startedAt, finishedAt: startedAt + 1 };
  };
  const resolveTarget = (command: BrowserActionCommand) => {
    if (command.selector === COLLECTION) {
      if (!option) throw new TargetResolutionError("not found", { code: WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND } as WebAutomationFailureRecord, { strategy: "selector", candidateCount: 0 });
      return { element: option, resolution: { strategy: "selector", candidateCount: 1 } };
    }
    // The act's own target: the verb ran. It then stops here, which is all this test needs to know.
    acted += 1;
    throw new Error("the act's verb ran");
  };
  const provided = { failure, resolveTarget } as unknown as Record<string, unknown>;
  const deps = new Proxy(provided as unknown as ContentActionDependencies, {
    get(target, property: string | symbol) {
      const found = (target as unknown as Record<string | symbol, unknown>)[property];
      if (found !== undefined || typeof property === "symbol") return found;
      return () => { throw new Error(`the act's verb ran: ${property}`); };
    }
  });
  return { deps, actResolved: () => acted };
}

test("an act whose required option stands chosen reaches its verb", async () => {
  const { deps, actResolved } = page(control({ "aria-pressed": "true" }));
  const result = await executeContentAction(ACT, deps);
  assert.ok(actResolved() > 0, "the act's own target was resolved, so the verb ran");
  assert.notEqual(result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.OPTION_NOT_CHOSEN);
});

test("an act whose required option is not chosen, or not on the page, never runs and answers a step that cannot run", async () => {
  for (const option of [control({ "aria-pressed": "false" }), undefined]) {
    const { deps, actResolved } = page(option);
    const result = await executeContentAction(ACT, deps);
    assert.equal(actResolved(), 0, "the act's own target was never resolved");
    assert.equal(result.status, "failed");
    assert.equal(result.failure?.code, "web.precondition.option_not_chosen");
    assert.equal(result.failure?.category, "target_not_found");
    assert.equal(result.failure?.effect, "unacted");
    assert.equal(result.failure?.retryable, false);
    assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure);
    // No page words in the record or the message: the option is named by its place in the act's list.
    assert.doesNotMatch(JSON.stringify([result.failure, result.message]), /Collection/u);
  }
});

test("an act that requires nothing is not checked", () => {
  assert.equal(requiredChoiceUnmet({ ...ACT, requiresChosen: undefined }, () => { throw new Error("never asked"); }), undefined);
});

test("chosen is the page's typed state, never words", () => {
  assert.equal(standsChosen(control({ "aria-checked": "true" })), true);
  assert.equal(standsChosen(control({ "aria-selected": "true" })), true);
  assert.equal(standsChosen(control({ "aria-current": "page" })), true);
  assert.equal(standsChosen(control({}, { tagName: "INPUT", type: "radio", checked: true } as Partial<HTMLInputElement>)), true);
  assert.equal(standsChosen(control({ "aria-current": "false", "aria-pressed": "false" })), false);
  assert.equal(standsChosen(control({ "aria-label": "Collection chosen" })), false);
  assert.equal(standsChosen(control({}, { tagName: "INPUT", type: "radio", checked: false } as Partial<HTMLInputElement>)), false);
});
