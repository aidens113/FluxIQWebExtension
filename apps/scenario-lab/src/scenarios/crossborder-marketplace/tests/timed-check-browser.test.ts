import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { crossborderMarketplaceManifest as manifest } from "../manifest/index.js";
import { PERSON_CHECKS } from "../person-check.js";
import type { MarketState } from "../state/index.js";
import { closeBrowser, openSession, type Session } from "./browser-harness.js";

/**
 * The timed check in a browser: armed by `free-hubs-under-ten`'s `timed-check`
 * variant, it comes up over a page on its own timer with nothing done there,
 * stays until a person passes it, and then leaves in place, with no reload,
 * after its own two-second check. The person is played exactly as the Lab's
 * person module declares (`person-check.ts`), and with them the honest read
 * still reaches its ten records.
 */
const WORKFLOW = "free-hubs-under-ten";
const VARIANT = "timed-check";
const CHECK = PERSON_CHECKS.checks.find(({ id }) => id === VARIANT)!;
const ALLOWED = manifest.expected.allowedConsoleErrors ?? [];
const cheap = resolveScenarioWorkflow(manifest, { workflowId: WORKFLOW, variantId: VARIANT });
const unexpectedErrors = (session: Session) => session.errors.filter((error) => !error.startsWith("http ") && !ALLOWED.some((allowed) => error.includes(allowed)));
const stateOf = async (session: Session) => (await session.finalState()) as unknown as MarketState;

/**
 * Every page the session opens records, by itself, whether the check showed as its document finished parsing, the
 * moment after its script started that the check came up, and every press and key a visitor made on it. A page that
 * reloads loses all three, which is how a check that left by reloading would be told from one that left in place.
 */
const RECORD = String.raw`(() => {
  const record = { atLoad: null, upAfterMs: null, inputs: 0 };
  window.__timedCheck = record;
  const started = performance.now();
  const showing = () => [...document.querySelectorAll('[role="dialog"] h2')].some((node) => node.textContent.trim() === ${JSON.stringify(CHECK.shows)});
  for (const kind of ['pointerdown', 'keydown']) addEventListener(kind, () => { record.inputs += 1; }, true);
  addEventListener('DOMContentLoaded', () => { record.atLoad = showing(); });
  new MutationObserver(() => { if (record.upAfterMs === null && showing()) record.upAfterMs = Math.round(performance.now() - started); })
    .observe(document, { childList: true, subtree: true });
})();`;

type Recorded = { atLoad: boolean | null; upAfterMs: number | null; inputs: number };
const recorded = (session: Session) => session.page.evaluate("window.__timedCheck") as Promise<Recorded | undefined>;
const questionShows = (session: Session) => session.page.getByText(CHECK.shows).first().isVisible();

async function withSession<T>(work: (session: Session) => Promise<T>): Promise<T> {
  const session = await openSession();
  try { return await work(session); } finally { await session.close(); }
}

/** Arms the variant the way a Lab run does and loads the home page afresh, recording what the page does by itself. */
async function armedHome(session: Session): Promise<void> {
  await session.armVariant(VARIANT, WORKFLOW);
  await session.context.addInitScript(RECORD);
  await session.page.reload({ waitUntil: "domcontentloaded" });
}

/** What the Lab's person does at the check (`play-person-check.ts`): press what the module names, then wait for the question to go. */
async function personPasses(session: Session): Promise<number> {
  for (const step of CHECK.steps) {
    assert.equal(step.action, "click");
    if (step.action === "click") await session.page.getByText(step.text).first().click({ timeout: 5_000 });
  }
  const pressed = Date.now();
  await session.page.getByText(CHECK.shows).first().waitFor({ state: "hidden", timeout: CHECK.clearsWithinMs });
  return Date.now() - pressed;
}

after(() => closeBrowser());

describe("crossborder-marketplace timed check in a browser", { concurrency: true }, () => {
  test("timed-check: the check comes up on its timer with nothing done, stays until a person passes it, and leaves in place", async () => {
    await withSession(async (session) => {
      await armedHome(session);
      await session.page.getByText(CHECK.shows).first().waitFor({ state: "visible", timeout: 8_000 });
      const up = await recorded(session);
      assert.ok(up, "the page recorded itself");
      assert.equal(up.atLoad, false, "not there as the page finishes parsing: it is on a timer, not part of the load");
      assert.ok(up.upAfterMs !== null && up.upAfterMs >= 1_400, `it came up on its own timer, ${String(up.upAfterMs)} ms after the page's script started`);
      assert.equal(up.inputs, 0, "nothing was pressed or typed before it came up");
      // It stays: left alone well past its timer and the welcome coupons' two seconds, it is still the topmost layer.
      await session.page.waitForTimeout(3_000);
      assert.equal(await questionShows(session), true, "left alone, it stays");
      const topmost = await session.page.evaluate(`(() => {
        const at = document.elementFromPoint(innerWidth / 2, innerHeight - 40);
        return Boolean(at && (at.closest('[role="dialog"]') || getComputedStyle(at).zIndex === '90'));
      })()`);
      assert.equal(topmost, true, "nothing behind it, the consent banner included, can be pressed");
      assert.equal((await stateOf(session)).timedCheck?.status, "waiting");
      // A reload while it stands brings it back on its timer.
      await session.page.reload({ waitUntil: "domcontentloaded" });
      await session.page.getByText(CHECK.shows).first().waitFor({ state: "visible", timeout: 8_000 });
      assert.equal((await recorded(session))?.atLoad, false);
      // The person passes it: the question stays through the box's own two-second check, then the layer leaves with no reload.
      const tookMs = await personPasses(session);
      assert.ok(tookMs >= 1_500, `the question stayed through the box's own check (${tookMs} ms)`);
      const left = await recorded(session);
      assert.ok(left && left.inputs > 0, "the same document the person pressed in: it left in place, with no reload");
      assert.equal((await stateOf(session)).timedCheck?.status, "passed");
      // Passed once, it never comes back.
      await session.page.reload({ waitUntil: "domcontentloaded" });
      await session.page.waitForTimeout(2_000);
      assert.equal(await questionShows(session), false, "a load after the pass carries no check");
      assert.deepEqual(unexpectedErrors(session), []);
    });
  });

  test("timed-check: with the person passing the check first, the read's own honest path reaches the same ten records", async () => {
    await withSession(async (session) => {
      await armedHome(session);
      await session.page.getByText(CHECK.shows).first().waitFor({ state: "visible", timeout: 8_000 });
      await personPasses(session);
      const extracted = await session.run(cheap.recordingScript);
      assert.deepEqual(extracted["extract-free-hubs-under-ten"], cheap.expected.extracted![0]!.records);
      assert.deepEqual(await session.failingFacts(cheap.expected.finalState ?? []), []);
      assert.deepEqual(unexpectedErrors(session), []);
    });
  });
});
