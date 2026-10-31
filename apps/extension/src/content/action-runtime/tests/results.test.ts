// Which code the actionability gate's three refusals travel under.
//
// Live run `run-murwdp4f-35f976d2` (t193-1002m, cause R1-C2): a chat card's
// close button, in the DOM and not shown until the card opens, was refused
// `hidden` and reported as TARGET_NOT_ACTIONABLE, Core's `unexpected_state`. Core
// routes a step by page state, or takes its sometimes-present skip, only for a
// failure whose category is `target_not_found`, so the step went to the
// recovery ladder instead. A target that is there and not shown now has its
// own code, TARGET_NOT_SHOWN, under that category; `disabled` and `covered` are
// the page's state exactly as before.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { WEB_AUTOMATION_FAILURE_CODES } from "@fluxiq-web-extension/domain/client";
import type { ActionResultEvidence } from "../results";
import type { BrowserActionCommand, DomSnapshot } from "../../types";

type RejectAction = typeof import("../results").actionRejected;

/**
 * The page globals `actionRejected` reads on its way to a result, put back when
 * the test ends. `results.ts` is imported after them because its import chain
 * reads `window` at load (`recovery/tests/attempt.test.ts` says the same).
 */
async function installRejectionPage(t: TestContext): Promise<RejectAction> {
  const scope = globalThis as unknown as Record<string, unknown>;
  const before = { document: scope.document, location: scope.location, window: scope.window };
  const view: Record<string, unknown> = { innerWidth: 1280, innerHeight: 800, addEventListener: () => undefined };
  view.top = view;
  scope.window = view;
  // An empty page: `blocking-dialog.ts` looks for a dialog over a hidden or covered target and finds none.
  scope.document = { title: "Shop", body: null, querySelector: () => null, querySelectorAll: () => [], addEventListener: () => undefined };
  scope.location = { href: "http://127.0.0.1:4000/scenarios/ecommerce-shop" };
  t.after(() => {
    scope.document = before.document;
    scope.location = before.location;
    scope.window = before.window;
  });
  return (await import("../results")).actionRejected;
}

/** A command with no selector, so the page-decided codes in `results.ts` are never asked. */
const CLICK = { commandId: "c1", actionType: "web.dom.click" } as BrowserActionCommand;

/** A gate refusal as `actions/click.ts` hands it over: a snapshot already taken, refused before anything dispatched. */
const GATE: ActionResultEvidence = { snapshot: {} as DomSnapshot, refusedBeforeDispatch: true };

test("result construction copies only valid current actionability without inferring it from a reason", async (t) => {
  const reject = await installRejectionPage(t);
  for (const actionability of [{ actionable: true }, ...["hidden", "disabled", "covered"].map((cause) => ({ actionable: false, cause }))]) {
    const evidence = { ...GATE, actionability } as ActionResultEvidence;
    const original = structuredClone(evidence);
    const result = reject(CLICK, 0, "disabled", "enabled", "disabled", evidence);
    assert.deepEqual(result.actionability, actionability);
    assert.notEqual(result.actionability, actionability);
    assert.deepEqual(evidence, original);
    assert.equal(result.failure?.effect, "unacted");
  }
  const legacy = reject(CLICK, 0, "covered", "reachable", "covered", GATE);
  assert.equal(Object.hasOwn(legacy, "actionability"), false, "a factory reason is not a measurement");
});

test("invalid or unreadable optional actionability drops alone and cannot change a real failure", async (t) => {
  const reject = await installRejectionPage(t);
  const baseline = reject(CLICK, 0, "disabled", "enabled", "disabled", GATE);
  let getters = 0;
  const accessor = Object.defineProperty({ ...GATE }, "actionability", {
    get() {
      getters += 1;
      throw new Error("must not read");
    }
  });
  const invalid: unknown[] = [
    { ...GATE, actionability: { actionable: true, point: { x: 1, y: 2 }, detail: "private" } },
    { ...GATE, actionability: { actionable: false, cause: "other" } },
    {
      ...GATE,
      actionability: Object.defineProperty({}, "actionable", {
        get() {
          getters += 1;
          throw new Error("must not read");
        }
      })
    },
    accessor,
    new Proxy({ ...GATE }, {
      getOwnPropertyDescriptor(target, key) {
        if (key === "actionability") throw new Error("unreadable control");
        return Reflect.getOwnPropertyDescriptor(target, key);
      }
    })
  ];
  for (const evidence of invalid) {
    const result = reject(CLICK, 0, "disabled", "enabled", "disabled", evidence as ActionResultEvidence);
    assert.equal(Object.hasOwn(result, "actionability"), false);
    assert.deepEqual(result.failure, baseline.failure);
    assert.equal(result.status, baseline.status);
    assert.equal(result.snapshot, GATE.snapshot);
  }
  assert.equal(getters, 0);
});

test("unmeasured success stays absent and malformed control cannot erase a person's post-press refusal", async (t) => {
  await installRejectionPage(t);
  const { success, actionNeedsPerson } = await import("../results");
  const unmeasured = success(CLICK, 0, "observed", { status: "passed", expected: "observed", actual: "observed" }, GATE);
  assert.equal(Object.hasOwn(unmeasured, "actionability"), false);
  const sighting = { outcome: "person_only", afterMs: 10, waitedMs: 20 } as const;
  const baseline = actionNeedsPerson(CLICK, 0, sighting, GATE);
  for (const actionability of [{ actionable: false, cause: "covered" }, { actionable: true, geometry: "private" }]) {
    const result = actionNeedsPerson(CLICK, 0, sighting, { ...GATE, actionability } as ActionResultEvidence);
    assert.deepEqual(result.failure, baseline.failure);
    assert.deepEqual(result.validation, baseline.validation);
    assert.equal(result.failure?.effect, undefined);
    assert.equal(result.status, "failed");
    assert.deepEqual(result.actionability, "geometry" in actionability ? undefined : actionability);
  }
});

test("a target the gate found hidden is TARGET_NOT_SHOWN: Core's target_not_found, retryable, at target resolution, nothing done", async (t) => {
  const actionRejected = await installRejectionPage(t);
  const result = actionRejected(CLICK, Date.now(), "hidden", "a target that can be clicked", "the element's display is none", GATE);
  assert.equal(result.status, "failed");
  assert.deepEqual(result.failure, {
    category: "target_not_found",
    code: WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_SHOWN,
    retryable: true,
    stage: "target_resolution",
    expected: "a target that can be clicked",
    actual: "hidden: the element's display is none",
    effect: "unacted"
  });
  assert.equal(result.message, "Action rejected: the element's display is none", "the words are unchanged");
});

test("a disabled or covered target is the page's unexpected state exactly as before", async (t) => {
  const actionRejected = await installRejectionPage(t);
  for (const [reason, detail] of [["disabled", "the element is disabled"], ["covered", "the point 10,20 landed on div.scrim, which covers the target"]] as const) {
    const result = actionRejected(CLICK, Date.now(), reason, "a target that can be clicked", detail, GATE);
    assert.deepEqual(result.failure, {
      category: "unexpected_state",
      code: WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_ACTIONABLE,
      retryable: false,
      stage: "execution",
      expected: "a target that can be clicked",
      actual: `${reason}: ${detail}`,
      effect: "unacted"
    }, reason);
  }
});

test("a refusal anyone decided on purpose is still ACTION_REJECTED", async (t) => {
  const actionRejected = await installRejectionPage(t);
  const result = actionRejected(CLICK, Date.now(), "unsupported_key", "a key this extension presses", "F13", { snapshot: {} as DomSnapshot });
  assert.equal(result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED);
});

test("a target refused as hidden is kept beside its result for the retry loop to scroll toward; a disabled one is not", async (t) => {
  const actionRejected = await installRejectionPage(t);
  const { revealUnshownTarget } = await import("../reveal");
  const asked: string[] = [];
  // A target that is no longer in the document: the reveal reads that first and stops, so reading it proves it was noted.
  const target = (name: string): Element => ({
    get isConnected() {
      asked.push(name);
      return false;
    }
  }) as unknown as Element;
  const hidden = actionRejected(CLICK, Date.now(), "hidden", "a target that can be clicked", "the element's display is none", { ...GATE, target: target("hidden") });
  const disabled = actionRejected(CLICK, Date.now(), "disabled", "a target that can be clicked", "the element is disabled", { ...GATE, target: target("disabled") });
  asked.length = 0;
  assert.equal(revealUnshownTarget(hidden), false, "a detached target is not scrolled for");
  assert.deepEqual(asked, ["hidden"], "the hidden refusal's target was noted, and the reveal consulted it");
  asked.length = 0;
  assert.equal(revealUnshownTarget(disabled), false);
  assert.deepEqual(asked, [], "a disabled refusal's target is not noted for the reveal");
  assert.equal(JSON.stringify(hidden).includes("isConnected"), false, "nothing of the element is on the result");
});
