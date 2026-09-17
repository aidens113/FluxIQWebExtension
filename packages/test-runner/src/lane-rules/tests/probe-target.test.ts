import assert from "node:assert/strict";
import test from "node:test";
import { coreProbeTargetUsable, type ProbeTargetPage } from "../probe-target.js";
import { selectCoreProbeStep } from "../probe-step.js";

/**
 * The Core action probe used to ask whether its target was *visible*, and
 * Playwright's visible ignores occlusion: on `storefront-checkout`, whose start
 * page opens a consent overlay, it always chose a covered field and Core
 * refused the action with "which covers the target". These pin the question the
 * probe asks now.
 */

type Attempt = { selector: string; options: { trial: true; timeout: number } };

/** A page whose named selectors are covered by an overlay, as Playwright reports one. */
function page(covered: readonly string[]): { page: ProbeTargetPage; attempts: Attempt[] } {
  const attempts: Attempt[] = [];
  return {
    attempts,
    page: {
      locator: (selector: string) => ({
        first: () => ({
          click: async (options: { trial: true; timeout: number }) => {
            attempts.push({ selector, options });
            if (covered.includes(selector)) {
              throw new Error(`locator.click: Timeout exceeded.\n- element is not stable\n- <div data-testid="cookie-consent-scrim"> intercepts pointer events`);
            }
          },
        }),
      }),
    },
  };
}

test("the probe asks with a trial click, so it presses nothing and the whole actionability check runs", async () => {
  const fixture = page([]);
  assert.equal(await coreProbeTargetUsable(fixture.page, "#card-number", 1_000), true);
  assert.deepEqual(fixture.attempts, [{ selector: "#card-number", options: { trial: true, timeout: 1_000 } }]);
  // `trial: true` is the whole guarantee that the recording starts on an
  // untouched page. A visibility wait would pass this without it.
  assert.equal(fixture.attempts[0]?.options.trial, true);
});

test("a target an overlay covers is not usable, and the failure is an answer rather than a throw", async () => {
  const fixture = page(["#card-number"]);
  assert.equal(await coreProbeTargetUsable(fixture.page, "#card-number", 1_000), false);
});

test("a covered field is passed over for the first one the page will accept", async () => {
  const steps = [
    { id: "accept-cookies", operation: "click", target: "testid:accept-cookies" },
    { id: "enter-card-number", operation: "type", target: "testid:card-number", value: "4111" },
    { id: "enter-card-name", operation: "type", target: "testid:card-name", value: "A Name" },
  ] as unknown as Parameters<typeof selectCoreProbeStep>[0];
  const fixture = page([`[data-testid="card-number"]`]);
  const choice = await selectCoreProbeStep(steps, (selector) => coreProbeTargetUsable(fixture.page, selector, 1_000));
  assert.equal(choice.kind, "probe");
  assert.equal(choice.kind === "probe" ? choice.step.id : undefined, "enter-card-name");
  assert.deepEqual(fixture.attempts.map((attempt) => attempt.selector), [`[data-testid="card-number"]`, `[data-testid="card-name"]`]);
});

test("a page that covers every candidate skips the probe, naming the steps and never a value", async () => {
  const steps = [{ id: "enter-card-number", operation: "type", target: "testid:card-number", value: "4111111111111111" }] as unknown as Parameters<typeof selectCoreProbeStep>[0];
  const fixture = page([`[data-testid="card-number"]`]);
  const choice = await selectCoreProbeStep(steps, (selector) => coreProbeTargetUsable(fixture.page, selector, 1_000));
  assert.equal(choice.kind, "skipped");
  assert.deepEqual(choice.kind === "skipped" ? choice.stepIds : [], ["enter-card-number"]);
  assert.equal(JSON.stringify(choice).includes("4111111111111111"), false);
});
