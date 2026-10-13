// A select sent an option's visible words where the option's value was wanted
// (t509). Live (`run-mv6qrcdu-a31b44b8`, steps 0020, 0030, 0032), a distance
// select whose options read "10 miles" and carried the value "10" was sent
// "10 miles" three times and failed each time, because a request by value
// compared only option values. The page view shows a select's options by their
// visible words and nothing else, so a value that names no option is matched
// against those words -- when exactly one option carries them, so the choice
// is never a guess.
//
// The page is faked at what the verb reads: the select's options, its gate,
// and the read-back after `selectedIndex` is set.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { WEB_AUTOMATION_FAILURE_CODES } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand, BrowserActionResult, BrowserActionValidation } from "../../types";
import type { ContentActionDependencies } from "../types";

class FakeSelectElement {}
class FakeInputElement {}

/** The platform classes the verb asks `instanceof` of, put back when the test ends. */
async function installPlatform(t: TestContext) {
  const scope = globalThis as unknown as Record<string, unknown>;
  const before = { HTMLSelectElement: scope.HTMLSelectElement, HTMLInputElement: scope.HTMLInputElement };
  scope.HTMLSelectElement = FakeSelectElement;
  scope.HTMLInputElement = FakeInputElement;
  t.after(() => Object.assign(scope, before));
  return (await import("../select")).selectAction;
}

type FakeOption = { value: string; index: number; label: string; textContent: string; matches: () => boolean };

/** A select offering `[value, words]` pairs; not connected, so a missing option is not waited for. */
function fakeSelect(pairs: ReadonlyArray<readonly [string, string]>) {
  const options: FakeOption[] = pairs.map(([value, words], index) => ({ value, index, label: "", textContent: words, matches: () => false }));
  const select = Object.assign(Object.create(FakeSelectElement.prototype as object) as object, {
    tagName: "SELECT",
    options,
    value: options[0]?.value ?? "",
    getAttribute: () => null,
    focus: () => undefined
  }) as { value: string };
  // A setter, defined rather than assigned: `Object.assign` would copy it as a plain value.
  Object.defineProperty(select, "selectedIndex", { set(index: number) { select.value = options[index]?.value ?? ""; } });
  return select as unknown as Element & { value: string };
}

type Reported = { validation: BrowserActionValidation; failureCode: string | undefined };

function dependencies(element: Element, reported: Reported[]): ContentActionDependencies {
  const provided: Partial<ContentActionDependencies> = {
    resolveTarget: () => ({ element, resolution: {} as ReturnType<ContentActionDependencies["resolveTarget"]>["resolution"] }),
    checkActionability: () => ({ actionable: true, point: { x: 4, y: 4 }, detail: "open" }) as ReturnType<ContentActionDependencies["checkActionability"]>,
    describeElement: () => ({}) as ReturnType<ContentActionDependencies["describeElement"]>,
    captureSnapshot: () => ({}) as ReturnType<ContentActionDependencies["captureSnapshot"]>,
    dispatchInputEvents: () => undefined,
    success: (action: BrowserActionCommand, startedAt: number, _message: string, validation: BrowserActionValidation, _evidence?: unknown, failureCode?: string): BrowserActionResult => {
      reported.push({ validation, failureCode });
      return { commandId: action.commandId, actionType: action.actionType, status: validation.status === "passed" ? "succeeded" : "failed", validation, startedAt, finishedAt: startedAt };
    }
  };
  return new Proxy(provided as ContentActionDependencies, {
    get(target, property: string | symbol) {
      const found = (target as unknown as Record<string | symbol, unknown>)[property];
      if (found !== undefined || typeof property === "symbol") return found;
      throw new Error(`the verb reached for ${property}, which this test does not provide`);
    }
  });
}

const choose = (value: string): BrowserActionCommand => ({ commandId: "c", actionType: "web.dom.select", value });

test("a value naming no option, and exactly one option's visible words, chooses that option", async (t) => {
  const selectAction = await installPlatform(t);
  const select = fakeSelect([["1", "1 league"], ["10", "10 leagues"], ["50", "50 leagues"]]);
  const reported: Reported[] = [];
  const result = await selectAction(choose("10 leagues"), dependencies(select, reported), 0);
  assert.equal(result.status, "succeeded", JSON.stringify(reported));
  assert.equal(select.value, "10");
  // Spacing and letter case are how page markup and a reader differ, not which option is meant.
  const again = fakeSelect([["1", "1 league"], ["10", "  10\n  Leagues "]]);
  assert.equal((await selectAction(choose("10 leagues"), dependencies(again, []), 0)).status, "succeeded");
  assert.equal(again.value, "10");
});

test("a value wins over another option's visible words, so a request by value means what it always did", async (t) => {
  const selectAction = await installPlatform(t);
  // "2" is one option's value and another's words: the value is the one chosen.
  const select = fakeSelect([["1", "2"], ["2", "two"]]);
  assert.equal((await selectAction(choose("2"), dependencies(select, []), 0)).status, "succeeded");
  assert.equal(select.value, "2");
});

test("visible words two options share choose neither, and the failure stays option_not_offered", async (t) => {
  const selectAction = await installPlatform(t);
  const select = fakeSelect([["a", "Any"], ["b", "Any"]]);
  const reported: Reported[] = [];
  const result = await selectAction(choose("Any"), dependencies(select, reported), 0);
  assert.equal(result.status, "failed");
  assert.equal(reported[0]?.failureCode, WEB_AUTOMATION_FAILURE_CODES.OPTION_NOT_OFFERED);
  assert.equal(select.value, "a", "nothing was chosen");
});
