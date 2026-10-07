// Which refusals say they were decided before the verb dispatched anything.
//
// In-page recovery waits out a control the page disabled for a moment -- the
// "I'm a person" button job-board's applicant tracker holds disabled for three
// seconds after Submit -- but only when the refusal states that nothing was
// dispatched (`action-runtime/recovery/fault.ts`), because the same `disabled`
// word is also written after a verb acted. That statement is made at the four
// actionability gates and nowhere else, and these rows are what fail if one of
// them stops making it, or if a refusal written later starts.
//
// The page is faked at the few things each verb reads before its gate answers,
// and `rejected` keeps the evidence it was handed, so each row checks the
// verb's own statement rather than what `results.ts` builds from it.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { ActionResultEvidence } from "../../action-runtime";
import type { BrowserActionCommand, BrowserActionResult } from "../../types";
import type { ContentActionDependencies } from "../types";

/** The platform classes the verbs ask `instanceof` of; the fakes below are made from them. */
class FakeInputElement {}
class FakeSelectElement {}

/**
 * Installs the platform the verbs read, then loads them. They are imported here
 * rather than at the top because the click verb's import chain reads `window`
 * as it loads (`frame-geometry.ts`), and a static import would make this file
 * pass only when another test file had left a `window` on the global first.
 * The previous globals, usually none, are put back when the test ends.
 */
async function installPlatform(t: TestContext) {
  const scope = globalThis as unknown as Record<string, unknown>;
  const before = { HTMLInputElement: scope.HTMLInputElement, HTMLSelectElement: scope.HTMLSelectElement, window: scope.window };
  const view: Record<string, unknown> = { innerWidth: 1280, innerHeight: 800, addEventListener: () => undefined };
  view.top = view;
  scope.window = view;
  scope.HTMLInputElement = FakeInputElement;
  scope.HTMLSelectElement = FakeSelectElement;
  t.after(() => {
    scope.HTMLInputElement = before.HTMLInputElement;
    scope.HTMLSelectElement = before.HTMLSelectElement;
    scope.window = before.window;
  });
  const [{ checkAction }, { clickAction }, { selectAction }, { typeAction }] = await Promise.all([
    import("../check"), import("../click"), import("../select"), import("../type")
  ]);
  return { checkAction, clickAction, selectAction, typeAction };
}

/** A control with no attributes, of the class the verb will ask about. */
function control(tagName: string, kind: typeof FakeInputElement | typeof FakeSelectElement, extra: Record<string, unknown> = {}): Element {
  return Object.assign(Object.create(kind.prototype as object) as object, { tagName, getAttribute: () => null, ...extra }) as unknown as Element;
}

const DISABLED_GATE = { actionable: false, code: "disabled", detail: "the element is disabled" } as const;
const OPEN_GATE = { actionable: true, point: { x: 4, y: 4 }, detail: "the point 4,4 landed on the target" } as const;

type Refusal = { code: string; evidence: ActionResultEvidence | undefined };

/** The dependencies a verb reads up to its refusal; `rejected` records what it was handed. */
function dependencies(element: Element, gate: ContentActionDependencies["checkActionability"], refusals: Refusal[], extra: Partial<ContentActionDependencies> = {}): ContentActionDependencies {
  const provided: Partial<ContentActionDependencies> = {
    resolveTarget: () => ({ element, resolution: {} as ReturnType<ContentActionDependencies["resolveTarget"]>["resolution"] }),
    checkActionability: gate,
    describeElement: () => ({}) as ReturnType<ContentActionDependencies["describeElement"]>,
    captureSnapshot: () => ({}) as ReturnType<ContentActionDependencies["captureSnapshot"]>,
    rejected: (action: BrowserActionCommand, startedAt: number, code: string, _expected: string, actual: string, evidence?: ActionResultEvidence): BrowserActionResult => {
      refusals.push({ code, evidence });
      return { commandId: action.commandId, actionType: action.actionType, status: "failed", validation: { status: "failed", expected: "e", actual }, startedAt, finishedAt: startedAt };
    },
    ...extra
  };
  return new Proxy(provided as ContentActionDependencies, {
    get(target, property: string | symbol) {
      const found = (target as unknown as Record<string | symbol, unknown>)[property];
      if (found !== undefined || typeof property === "symbol") return found;
      throw new Error(`the verb reached for ${property}, which this test does not provide`);
    }
  });
}

test("each verb's actionability gate states that its refusal came before anything was dispatched", async (t) => {
  const { checkAction, clickAction, selectAction, typeAction } = await installPlatform(t);
  const rows: { name: string; run: (deps: ContentActionDependencies) => Promise<BrowserActionResult> | BrowserActionResult; element: Element }[] = [
    { name: "click", element: control("BUTTON", FakeInputElement), run: (deps) => clickAction({ commandId: "c", actionType: "web.dom.click" }, deps, 0) },
    { name: "type", element: control("INPUT", FakeInputElement), run: (deps) => typeAction({ commandId: "c", actionType: "web.dom.type", text: "x" }, deps, 0) },
    { name: "select", element: control("SELECT", FakeSelectElement), run: (deps) => selectAction({ commandId: "c", actionType: "web.dom.select", value: "x" }, deps, 0) },
    { name: "check", element: control("INPUT", FakeInputElement), run: (deps) => checkAction({ commandId: "c", actionType: "web.dom.check" }, deps, 0) }
  ];
  for (const row of rows) {
    const refusals: Refusal[] = [];
    await row.run(dependencies(row.element, () => DISABLED_GATE, refusals));
    assert.equal(refusals.length, 1, `${row.name} did not refuse`);
    assert.equal(refusals[0]?.code, "disabled", row.name);
    assert.equal(refusals[0]?.evidence?.refusedBeforeDispatch, true, `${row.name}'s gate refusal does not say nothing was dispatched`);
  }
});

test("a disabled control check.ts found after setCheckedState makes no such statement", async (t) => {
  const { checkAction } = await installPlatform(t);
  const refusals: Refusal[] = [];
  const set: boolean[] = [];
  const deps = dependencies(control("INPUT", FakeInputElement), () => OPEN_GATE, refusals, {
    setCheckedState: (_element, checked) => {
      set.push(checked);
      return { ok: false, reason: "the checkbox is disabled", code: "disabled" };
    }
  });
  await checkAction({ commandId: "c", actionType: "web.dom.check" }, deps, 0);
  assert.deepEqual(set, [true], "the gate passed, so the state setter ran");
  assert.equal(refusals[0]?.code, "disabled");
  assert.equal(refusals[0]?.evidence?.refusedBeforeDispatch, undefined);
});

test("a select's disabled option makes no such statement: it stays disabled however often it is asked", async (t) => {
  const { selectAction } = await installPlatform(t);
  const option = { value: "x", index: 0, label: "X", text: "X", textContent: "X", matches: (selector: string) => selector === ":disabled" };
  const select = control("SELECT", FakeSelectElement, { options: [option] });
  const refusals: Refusal[] = [];
  selectAction({ commandId: "c", actionType: "web.dom.select", value: "x" }, dependencies(select, () => OPEN_GATE, refusals), 0);
  assert.equal(refusals[0]?.code, "disabled");
  assert.equal(refusals[0]?.evidence?.refusedBeforeDispatch, undefined);
});
