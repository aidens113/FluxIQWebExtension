// The scroll verb's dwell above humanness 0 (`../../../scroll.ts`, W2 H3): every mode
// pauses once after it moves the page, for a time drawn from the command's own
// generator and fitted within its time, before it reads the position, the
// target or the snapshot. At 0, or with no level, no timer is set that was not
// set before.
//
// The page is faked as `../../scroll.test.ts` fakes it, and the timers are recorded
// in the order they are set, beside the reads the verb makes.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationActionFromGatewayCommand } from "@fluxiq-web-extension/domain/client";
import { scrollAction } from "../../../scroll";
import type { ContentActionDependencies } from "../../../types";
import type { BrowserActionCommand, BrowserActionResult, BrowserActionValidation } from "../../../../types";

/** The platform's own timer, taken once, so a page faked twice in one test never wraps another fake. */
const platformSetTimeout = globalThis.setTimeout;

/** A page scrolled to `y` of a 4000-pixel document, with the verb's timers and reads recorded in order as `steps`. */
function page(t: TestContext, y: number): { steps: string[]; deps: ContentActionDependencies } {
  const steps: string[] = [];
  const view = {
    scrollX: 0,
    scrollY: y,
    innerWidth: 1000,
    innerHeight: 800,
    scrollTo(options: { left: number; top: number }) {
      steps.push("move");
      view.scrollX = options.left;
      view.scrollY = options.top;
    }
  };
  const documentElement = { scrollHeight: 4000, scrollWidth: 1000 };
  const scope = globalThis as unknown as Record<string, unknown>;
  Object.assign(globalThis, {
    window: view,
    document: { documentElement, body: documentElement },
    setTimeout: (callback: () => void, ms?: number) => {
      steps.push(`timer:${ms ?? 0}`);
      return platformSetTimeout(callback, ms);
    }
  });
  t.after(() => {
    scope.setTimeout = platformSetTimeout;
  });
  const element = { getBoundingClientRect: () => ({ left: 10, top: 300, right: 110, bottom: 340 }) };
  const deps = {
    success: (action: BrowserActionCommand, startedAt: number, message: string, validation: BrowserActionValidation): BrowserActionResult => ({
      commandId: action.commandId,
      actionType: action.actionType,
      status: validation.status === "failed" ? "failed" : "succeeded",
      message,
      validation,
      startedAt,
      finishedAt: startedAt + 1
    }),
    failure: (_action: BrowserActionCommand, error: unknown) => {
      throw error;
    },
    captureSnapshot: () => {
      steps.push("snapshot");
      return undefined;
    },
    resolveTarget: () => ({ element, resolution: {} }),
    scrollElementIntoView: () => {
      steps.push("move");
    },
    checkActionability: () => {
      steps.push("gate");
      return { actionable: true, point: { x: 60, y: 320 }, detail: "the point 60,320 landed on the target" };
    },
    describeElement: () => ({})
  } as unknown as ContentActionDependencies;
  return { steps, deps };
}

function command(parameters: JsonObject, extra: Partial<BrowserActionCommand>): BrowserActionCommand {
  const mapped = webAutomationActionFromGatewayCommand({ commandId: "cmd-scroll", actionType: "web.dom.scroll", parameters });
  assert.equal("status" in mapped, false, "the scroll command was rejected before the verb");
  return { ...(mapped as unknown as BrowserActionCommand), ...extra };
}

/** The dwell timers among the steps: every timer but the untilStable growth polls of 50 ms. */
function dwells(steps: string[]): number[] {
  return steps.filter((step) => step.startsWith("timer:") && step !== "timer:50").map((step) => Number(step.slice("timer:".length)));
}

test("at level 0, or with no level, a scroll by a delta sets no timer at all", async (t) => {
  for (const extra of [{}, { humanness: 0 }]) {
    const { steps, deps } = page(t, 100);
    const result = await scrollAction(command({ scroll: { mode: "by", y: 640 } }, { ...extra, timeoutMs: 5_000 }), deps, Date.now());
    assert.equal(result.status, "succeeded");
    assert.deepEqual(steps, ["move", "snapshot"]);
  }
});

test("at level 80 a scroll by a delta dwells once after the move, within the command's time, before it is read", async (t) => {
  const { steps, deps } = page(t, 100);
  const result = await scrollAction(command({ scroll: { mode: "by", y: 640 } }, { humanness: 80, timeoutMs: 1_000 }), deps, Date.now());
  assert.equal(result.status, "succeeded");
  assert.equal(steps.length, 3);
  assert.equal(steps[0], "move");
  assert.match(steps[1] ?? "", /^timer:\d+$/u);
  assert.equal(steps[2], "snapshot");
  const [dwell] = dwells(steps);
  assert.ok(dwell !== undefined && dwell > 0 && dwell <= 400, `a dwell of ${dwell} ms in a 1 s command`);
});

test("the same command id dwells the same time", async (t) => {
  const first = page(t, 0);
  await scrollAction(command({ scroll: { mode: "by", y: 10 } }, { humanness: 60, timeoutMs: 60_000 }), first.deps, Date.now());
  const again = page(t, 0);
  await scrollAction(command({ scroll: { mode: "by", y: 10 } }, { humanness: 60, timeoutMs: 60_000 }), again.deps, Date.now());
  assert.deepEqual(dwells(again.steps), dwells(first.steps));
  assert.equal(dwells(first.steps).length, 1);
});

test("a scroll to an element dwells between the move and the gate's read at level 80, and not at all at 0", async (t) => {
  const zero = page(t, 0);
  await scrollAction(command({ scroll: { mode: "toElement" }, selector: "#cart" }, { timeoutMs: 1_000 }), zero.deps, Date.now());
  assert.deepEqual(zero.steps, ["move", "gate", "snapshot"]);
  const human = page(t, 0);
  await scrollAction(command({ scroll: { mode: "toElement" }, selector: "#cart" }, { humanness: 80, timeoutMs: 1_000 }), human.deps, Date.now());
  assert.equal(human.steps[0], "move");
  assert.match(human.steps[1] ?? "", /^timer:\d+$/u);
  assert.deepEqual(human.steps.slice(2), ["gate", "snapshot"]);
});

test("scrolling until the document stops growing dwells once, after the last pass, only above level 0", async (t) => {
  const zero = page(t, 0);
  await scrollAction(command({ scroll: { mode: "untilStable", maxScrolls: 1 } }, { timeoutMs: 3_000 }), zero.deps, Date.now());
  assert.deepEqual(dwells(zero.steps), []);
  const human = page(t, 0);
  await scrollAction(command({ scroll: { mode: "untilStable", maxScrolls: 1 } }, { humanness: 80, timeoutMs: 3_000 }), human.deps, Date.now());
  assert.equal(dwells(human.steps).length, 1);
  assert.equal(human.steps.at(-1), "snapshot");
  assert.match(human.steps.at(-2) ?? "", /^timer:\d+$/u, "the dwell comes after the last growth poll and before the snapshot");
});

test("the scroll result records the level with aimed false above level 0, and nothing at 0 or with no level", async (t) => {
  const absent = await scrollAction(command({ scroll: { mode: "by", y: 10 } }, {}), page(t, 0).deps, 5);
  assert.equal("humanness" in absent, false);
  const zero = await scrollAction(command({ scroll: { mode: "by", y: 10 } }, { humanness: 0 }), page(t, 0).deps, 5);
  assert.deepEqual(zero, absent);
  const human = await scrollAction(command({ scroll: { mode: "by", y: 10 } }, { humanness: 80, timeoutMs: 1_000 }), page(t, 0).deps, 5);
  assert.deepEqual(human.humanness, { level: 80, aimed: false });
});
