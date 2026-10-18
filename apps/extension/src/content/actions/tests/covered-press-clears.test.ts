// A press on a control a separate promotion modal covers, through the real
// dispatcher, the real click and the real in-page recovery
// (`../execute.ts`, `../click.ts`, `../../action-runtime/recovery/`,
// `../../action-runtime/interference/`).
//
// The shape of `run-mvcxf4uz-64cd322c`: the control the step presses is the
// decline of a non-modal consent bar at the foot of the page, and a promotion
// modal, whose backdrop spans the viewport, covers it. The modal offers a close
// glyph, an answer that takes the offer ("Collect all") and "No thanks". Since
// lane 2 fix 4 the domain sends such a press in exploration rather than refusing
// it (`domain/src/runtime/llm-evidence/node-run/layer/runtime-clears.ts`), on the
// promise this test holds the extension to: the click is refused at its gate,
// the recovery presses the modal's way out -- the glyph or "No thanks", never
// "Collect all" -- leaves the consent bar that holds the target alone, and the
// press is then made, once, and the result names the layer it closed.
//
// The gate is the one fake here: the real `checkActionability` and
// `actionRejected` read styles, scrolling and capture settings Node does not
// have (`./execute.test.ts`). It hit-tests the target's centre through the same
// fake view the recovery's probes read, so the target is covered exactly while
// the modal is painted. The refusal it reports is the real one's shape: a
// `covered` reason with a dialog over the page is BLOCKED_BY_DIALOG.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "@fluxiq-web-extension/domain/client";
import { executeContentAction } from "../execute";
import type { ContentActionDependencies } from "../types";
import type { BrowserActionCommand, BrowserActionResult } from "../../types";
import { closesOnPress, h, place, withPage, zonedView, type FakeElement, type FakeView } from "../../action-runtime/interference/tests/fake-layer";

type CoveredPage = {
  body: FakeElement;
  view: FakeView;
  bar: FakeElement;
  accept: FakeElement;
  decline: FakeElement;
  scrim: FakeElement;
  close: FakeElement;
  collectAll: FakeElement;
  noThanks: FakeElement;
};

function coveredPage(): CoveredPage {
  const accept = place(h("button", { type: "button" }, "Accept all"), { box: { x: 900, y: 650, width: 150, height: 40 } });
  const decline = place(h("button", { type: "button" }, "Reject non-essential"), { box: { x: 1060, y: 650, width: 200, height: 40 } });
  const bar = place(h("div", { role: "region", "aria-label": "Cookie choices" }, [
    h("p", {}, "We use cookies to keep this site working and to measure visits."),
    accept,
    decline
  ]), { position: "fixed", box: { x: 0, y: 600, width: 1280, height: 120 } });

  const close = place(h("button", { type: "button" }, "x"), { box: { x: 900, y: 110, width: 24, height: 24 } });
  const collectAll = place(h("button", { type: "button" }, "Collect all"), { box: { x: 380, y: 420, width: 200, height: 40 } });
  const noThanks = place(h("button", { type: "button" }, "No thanks"), { box: { x: 600, y: 420, width: 200, height: 40 } });
  const modal = place(h("div", { role: "dialog", "aria-modal": "true", "aria-label": "Members offer" }, [
    close,
    h("h2", {}, "Members save on every order"),
    h("p", {}, "Collect your welcome codes before they expire."),
    collectAll,
    noThanks
  ]), { position: "fixed", box: { x: 340, y: 100, width: 600, height: 400 } });
  // The backdrop spans the viewport, so it is what a press on the bar lands on.
  const scrim = place(h("div", {}, [modal]), { position: "fixed", box: { x: 0, y: 0, width: 1280, height: 720 } });
  for (const control of [close, collectAll, noThanks]) closesOnPress(control, scrim);

  const main = h("main", {}, [h("h1", {}, "Results"), h("ul", {}, [h("li", {}, "First item"), h("li", {}, "Second item")])]);
  const body = h("body", {}, [main, bar, scrim]);
  return { body, view: zonedView([scrim, bar], main), bar, accept, decline, scrim, close, collectAll, noThanks };
}

/** Whether `element` is `ancestor` or sits inside it. */
function within(element: Element, ancestor: Element): boolean {
  for (let current: Element | null = element; current; current = current.parentElement) if (current === ancestor) return true;
  return false;
}

function centre(element: Element): { x: number; y: number } {
  const box = element.getBoundingClientRect();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Every capability a throw, but those the click and the recovery ask for here. */
function dependencies(page: CoveredPage): ContentActionDependencies {
  const provided: Partial<ContentActionDependencies> = {
    resolveTarget: (() => ({ element: page.decline, resolution: { strategy: "selector", candidateCount: 1, bestScore: 1 } })) as unknown as ContentActionDependencies["resolveTarget"],
    checkActionability: ((element: Element) => {
      const point = centre(element);
      const hit = page.view.hitAt(point.x, point.y);
      return hit && within(element, hit)
        ? { actionable: true, point, detail: "hit at its centre" }
        : { actionable: false, code: "covered", detail: "another element receives the click at its centre", point };
    }) as unknown as ContentActionDependencies["checkActionability"],
    rejected: ((action: BrowserActionCommand, startedAt: number, reason: string, expected: string, detail: string) => ({
      commandId: action.commandId,
      actionType: action.actionType,
      status: "failed",
      validation: { status: "failed", expected, actual: detail },
      message: `Action blocked: ${detail}`,
      failure: { ...webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.BLOCKED_BY_DIALOG, { expected, actual: `${reason}: ${detail}` }), effect: "unacted" },
      startedAt,
      finishedAt: startedAt + 1
    })) as unknown as ContentActionDependencies["rejected"],
    describeElement: () => ({}) as ReturnType<ContentActionDependencies["describeElement"]>,
    captureSnapshot: () => ({}) as ReturnType<ContentActionDependencies["captureSnapshot"]>,
    watchRateLimitNotice: (() => undefined) as unknown as ContentActionDependencies["watchRateLimitNotice"],
    watchRobotCheck: (() => undefined) as unknown as ContentActionDependencies["watchRobotCheck"],
    watchIgnoredPress: (() => undefined) as unknown as ContentActionDependencies["watchIgnoredPress"],
    success: (action: BrowserActionCommand, startedAt: number, message: string, validation: BrowserActionResult["validation"]) => ({
      commandId: action.commandId, actionType: action.actionType, status: "succeeded", validation, message, startedAt, finishedAt: startedAt + 1
    })
  };
  return new Proxy(provided as ContentActionDependencies, {
    get(target, property: string | symbol) {
      const found = (target as unknown as Record<string | symbol, unknown>)[property];
      if (found !== undefined || typeof property === "symbol") return found;
      return () => {
        throw new Error(`not provided: ${property}`);
      };
    }
  });
}

/** `./execute.test.ts`'s: advances the mock clock until `work` settles. */
async function settledOnMockClock<T>(t: TestContext, work: Promise<T>, limitMs = 10_000): Promise<T> {
  let settled = false;
  work.then(() => { settled = true; }, () => { settled = true; });
  for (let elapsed = 0; !settled && elapsed <= limitMs; elapsed += 10) {
    await new Promise<void>((resolve) => { setImmediate(resolve); });
    if (!settled) t.mock.timers.tick(10);
  }
  return await work;
}

test("a press under a separate promotion modal clears the modal by its way out, never its offer, spares the consent bar holding the target, and presses once (run-mvcxf4uz-64cd322c)", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
  const page = coveredPage();
  const result = await settledOnMockClock(t, withPage(page.body, () => executeContentAction(
    { commandId: "cmd-decline", actionType: "web.dom.click", selector: "#cookie-decline", timeoutMs: 4_000 },
    dependencies(page)
  ), page.view));

  assert.equal(result.status, "succeeded", `the press failed: ${result.failure?.code ?? "no record"} ${String(result.failure?.actual ?? "")}`);
  // The modal was closed by its glyph or its "No thanks", and its offer was never taken.
  assert.deepEqual(page.collectAll.events, [], "Collect all was pressed");
  assert.equal(page.close.pressed || page.noThanks.pressed, true, "neither way out was pressed");
  assert.equal(page.scrim.isConnected, false, "the modal is still there");
  // The result says which layer was closed, by which word.
  assert.equal(result.clearedLayers?.length, 1, JSON.stringify(result.clearedLayers));
  assert.equal(result.clearedLayers?.[0]?.name, "Members offer");
  assert.ok(["Close", "No thanks"].includes(String(result.clearedLayers?.[0]?.control)), JSON.stringify(result.clearedLayers));
  // The consent bar that holds the target is left alone: its accept was never pressed, and it is still shown.
  assert.deepEqual(page.accept.events, []);
  assert.equal(page.bar.getClientRects().length > 0, true);
  // And the target itself was pressed exactly once, after the modal was gone.
  assert.equal(page.decline.events.filter((type) => type === "click").length, 1, page.decline.events.join(","));
});
