// What the clear verb says about a target that holds no value (t486).
//
// The type verb's twin (`type-not-editable.test.ts`): a `<span>` has nothing to
// empty, and clearing it fails the same way every time. It used to fail as
// OUTPUT_NOT_OBSERVED, which is retryable, so the runtime retried a step that
// can never pass. It now fails as TARGET_NOT_ACTIONABLE, which is not retryable
// and which a repair may still answer, naming the element's tag; nothing is
// changed on the page. A field still clears as before.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord, type WebAutomationFailureCode } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand, BrowserActionResult, BrowserActionValidation } from "../../types";
import type { ContentActionDependencies } from "../types";

class FakeInputElement {}
class FakeTextAreaElement {}
class FakeHTMLElement {}

async function installPlatform(t: TestContext) {
  const scope = globalThis as unknown as Record<string, unknown>;
  const names = ["HTMLInputElement", "HTMLTextAreaElement", "HTMLElement"] as const;
  const before = Object.fromEntries(names.map((name) => [name, scope[name]]));
  Object.assign(scope, { HTMLInputElement: FakeInputElement, HTMLTextAreaElement: FakeTextAreaElement, HTMLElement: FakeHTMLElement });
  t.after(() => Object.assign(scope, before));
  return (await import("../clear")).clearAction;
}

function span(): Element {
  return Object.assign(Object.create(FakeHTMLElement.prototype as object) as object, { tagName: "SPAN", isConnected: true, textContent: "1", getAttribute: () => null }) as unknown as Element;
}

function field(): Element {
  return Object.assign(Object.create(FakeInputElement.prototype as object) as object, {
    tagName: "INPUT", type: "text", isConnected: true, value: "towels", form: null, getAttribute: () => null, focus: () => undefined
  }) as unknown as Element;
}

type Seen = { set: number; validation?: BrowserActionValidation; failureCode?: WebAutomationFailureCode | undefined };

async function run(clearAction: Awaited<ReturnType<typeof installPlatform>>, element: Element): Promise<Seen> {
  const seen: Seen = { set: 0 };
  const deps = {
    resolveTarget: () => ({ element, resolution: {} }),
    checkActionability: () => ({ actionable: true, point: { x: 4, y: 4 }, detail: "the point 4,4 landed on the target" }),
    describeElement: () => ({}),
    captureSnapshot: () => ({}),
    setElementValue: (target: { value: string }, value: string) => {
      seen.set += 1;
      target.value = value;
    },
    dispatchInputEvents: () => undefined,
    success: (action: BrowserActionCommand, startedAt: number, _message: string, validation: BrowserActionValidation, _evidence?: unknown, failureCode?: WebAutomationFailureCode): BrowserActionResult => {
      Object.assign(seen, { validation, failureCode });
      return { commandId: action.commandId, actionType: action.actionType, status: validation.status === "failed" ? "failed" : "succeeded", validation, startedAt, finishedAt: startedAt };
    }
  } as unknown as ContentActionDependencies;
  clearAction({ commandId: "c", actionType: "web.dom.clear" }, deps, 0);
  return seen;
}

test("clearing a span fails at once, not retryably, naming the element, and changes nothing", async (t) => {
  const clearAction = await installPlatform(t);
  const seen = await run(clearAction, span());
  assert.equal(seen.set, 0, "no value was set");
  assert.equal(seen.validation?.status, "failed");
  assert.match(seen.validation?.actual ?? "", /<span>/u);
  assert.equal(seen.failureCode, WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_ACTIONABLE);
  assert.equal(webAutomationFailureRecord(seen.failureCode!).retryable, false);
});

test("clearing a field is unchanged: it empties and passes with no failure code", async (t) => {
  const clearAction = await installPlatform(t);
  const seen = await run(clearAction, field());
  assert.equal(seen.set, 1);
  assert.equal(seen.validation?.status, "passed");
  assert.equal(seen.failureCode, undefined);
});
