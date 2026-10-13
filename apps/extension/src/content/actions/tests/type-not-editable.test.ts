// What the type verb says about a target nothing can be typed into (t486).
//
// Round 12 build 1 (`run-mv62icw0-2be384b4`): a trial typed into a `<span>`
// holding a quantity. The verb reported a failed validation with no code of
// its own, which became OUTPUT_NOT_OBSERVED -- retryable -- and the runtime
// retried a step that can never pass three times, and told the model it might.
//
// Held here: such a target fails with TARGET_NOT_ACTIONABLE, which is not
// retryable and which a repair may still answer, naming the element's tag, and
// no key is sent. A field still types as before.
//
// The page is faked at the few things the verb reads, on the pattern of
// `type-unsent-form.test.ts`.

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
  const names = ["HTMLInputElement", "HTMLTextAreaElement", "HTMLElement", "window"] as const;
  const before = Object.fromEntries(names.map((name) => [name, scope[name]]));
  const view: Record<string, unknown> = { innerWidth: 1280, innerHeight: 800, addEventListener: () => undefined };
  view.top = view;
  Object.assign(scope, { HTMLInputElement: FakeInputElement, HTMLTextAreaElement: FakeTextAreaElement, HTMLElement: FakeHTMLElement, window: view });
  t.after(() => Object.assign(scope, before));
  return (await import("../type")).typeAction;
}

function span(): Element {
  return Object.assign(Object.create(FakeHTMLElement.prototype as object) as object, { tagName: "SPAN", isContentEditable: false, isConnected: true, textContent: "1", getAttribute: () => null }) as unknown as Element;
}

function field(): Element {
  return Object.assign(Object.create(FakeInputElement.prototype as object) as object, { tagName: "INPUT", type: "text", isConnected: true, value: "", form: null, getAttribute: () => null }) as unknown as Element;
}

type Seen = { typed: number; validation?: BrowserActionValidation; failureCode?: WebAutomationFailureCode | undefined; message?: string };

async function run(typeAction: Awaited<ReturnType<typeof installPlatform>>, element: Element): Promise<Seen> {
  const seen: Seen = { typed: 0 };
  const deps = {
    resolveTarget: () => ({ element, resolution: {} }),
    checkActionability: () => ({ actionable: true, point: { x: 4, y: 4 }, detail: "the point 4,4 landed on the target" }),
    describeElement: () => ({}),
    captureSnapshot: () => ({}),
    keyboard: {
      typeText: (target: { value: string }, text: string) => {
        seen.typed += 1;
        target.value = text;
      },
      pressKey: () => ({ dispatched: true, defaultAction: "none", expected: "", detail: "", held: false })
    },
    success: (action: BrowserActionCommand, startedAt: number, message: string, validation: BrowserActionValidation, _evidence?: unknown, failureCode?: WebAutomationFailureCode): BrowserActionResult => {
      Object.assign(seen, { validation, failureCode, message });
      return { commandId: action.commandId, actionType: action.actionType, status: validation.status === "failed" ? "failed" : "succeeded", validation, startedAt, finishedAt: startedAt };
    }
  } as unknown as ContentActionDependencies;
  await typeAction({ commandId: "c", actionType: "web.dom.type", text: "2" }, deps, 0);
  return seen;
}

test("typing into a span fails at once, not retryably, naming the element, and sends no key", async (t) => {
  const typeAction = await installPlatform(t);
  const seen = await run(typeAction, span());
  assert.equal(seen.typed, 0, "no key was sent");
  assert.equal(seen.validation?.status, "failed");
  assert.match(seen.validation?.actual ?? "", /<span>/u);
  assert.equal(seen.failureCode, WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_ACTIONABLE);
  assert.equal(webAutomationFailureRecord(seen.failureCode!).retryable, false);
});

test("typing into a field is unchanged: it types and passes with no failure code", async (t) => {
  const typeAction = await installPlatform(t);
  const seen = await run(typeAction, field());
  assert.equal(seen.typed, 1);
  assert.equal(seen.validation?.status, "passed");
  assert.equal(seen.failureCode, undefined);
});
