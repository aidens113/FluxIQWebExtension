import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { resolveScenarioWorkflow, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { VOLTBAY_LOOKALIKE_ID, VOLTBAY_OFFICIAL_ID } from "../catalog/index.js";
import { crossborderMarketplaceManifest as manifest, MARKET_SEED } from "../manifest/index.js";
import { itemHref } from "../markup/index.js";
import type { MarketState } from "../state/index.js";
import { marketClasses } from "../styles/index.js";
import { closeBrowser, locate, openSession, type Session } from "./browser-harness.js";

/**
 * The breadth round's four tasks (t697) in a browser: each workflow's honest
 * recording reaches its oracle exactly, and the plausible wrong path beside it
 * -- the ads kept, Best Match order, the lookalike seller, a second press of a
 * toggle, the in-stock lookalike option, the standard shipping, the euro
 * checkout -- does not.
 */
const c = marketClasses(MARKET_SEED, "baseline");
const ALLOWED = manifest.expected.allowedConsoleErrors ?? [];
const workflow = (workflowId: string) => resolveScenarioWorkflow(manifest, { workflowId });
const upTo = (script: readonly ScenarioStep[], lastId: string) => script.slice(0, script.findIndex((step) => step.id === lastId) + 1);
const stepOf = (script: readonly ScenarioStep[], id: string) => script.find((step) => step.id === id)!;
const unexpectedErrors = (session: Session) => session.errors.filter((error) => !error.startsWith("http ") && !ALLOWED.some((allowed) => error.includes(allowed)));
const stateOf = async (session: Session) => (await session.finalState()) as unknown as MarketState;

/** The opening of a recording, re-pointed from the official listing to the lookalike seller's organic one, which needs a scroll to be drawn. */
function toLookalike(script: readonly ScenarioStep[]): ScenarioStep[] {
  const link = `a[href="${itemHref(VOLTBAY_LOOKALIKE_ID)}"] >> nth=1`;
  return script.flatMap((step): ScenarioStep[] => {
    if (step.id === "results-drawn") return [step, { id: "scroll-to-lookalike", operation: "scroll", value: 1400 }, { id: "lookalike-drawn", operation: "waitForState", target: link, timeoutMs: 6000 }];
    if (step.id === "open-listing") return [{ ...step, target: link }];
    if (step.id === "listing-tab") return [{ ...step, path: itemHref(VOLTBAY_LOOKALIKE_ID) }];
    return [step];
  });
}

/** Runs steps through the harness, choosing a `select` step's option itself, which the harness does not drive. */
async function runSteps(session: Session, steps: readonly ScenarioStep[]): Promise<Record<string, Array<Record<string, string>>>> {
  const extracted: Record<string, Array<Record<string, string>>> = {};
  for (const step of steps) {
    if (step.operation === "select") {
      await locate(session.page, step.target ?? "").selectOption(String(step.value), { timeout: step.timeoutMs ?? 12_000 });
      continue;
    }
    Object.assign(extracted, await session.run([step]));
  }
  return extracted;
}

async function withSession<T>(work: (session: Session) => Promise<T>): Promise<T> {
  const session = await openSession();
  try {
    return await work(session);
  } finally {
    await session.close();
  }
}

after(() => closeBrowser());

describe("crossborder-marketplace breadth tasks in a browser", { concurrency: true }, () => {
  const cheap = workflow("free-hubs-under-ten");
  const follow = workflow("follow-official-store");
  const mint = workflow("mint-hub-fallback");
  const uk = workflow("uk-express-quote");

  test("free-hubs-under-ten: the filters, the check and the price sort read the ten records; keeping the ads does not", () => withSession(async (session) => {
    const extracted = await runSteps(session, cheap.recordingScript);
    assert.deepEqual(extracted["extract-free-hubs-under-ten"], cheap.expected.extracted![0]!.records);
    assert.deepEqual(await session.failingFacts(cheap.expected.finalState!), []);
    const recorded = stepOf(cheap.recordingScript, "extract-free-hubs-under-ten");
    const withAds = await runSteps(session, [{ ...recorded, id: "keep-ads", target: `.${c.grid} > .${c.card}` }]);
    assert.equal(withAds["keep-ads"]?.length, 12, "two paid placements dearer than the ceiling sit on the narrowed page");
    assert.notDeepEqual(withAds["keep-ads"], cheap.expected.extracted![0]!.records);
    assert.equal((await stateOf(session)).search.checksPassed, 1, "the honest path met the traffic screen once");
    assert.deepEqual(unexpectedErrors(session), []);
  }));

  test("free-hubs-under-ten: the same narrowed results left in Best Match order are the right rows in the wrong order", () => withSession(async (session) => {
    await runSteps(session, upTo(cheap.recordingScript, "cheap-results-back"));
    await runSteps(session, [stepOf(cheap.recordingScript, "cheap-first-cards"), stepOf(cheap.recordingScript, "cheap-scroll-results"), stepOf(cheap.recordingScript, "cheap-last-cards")]);
    const unsorted = (await runSteps(session, [stepOf(cheap.recordingScript, "extract-free-hubs-under-ten")]))["extract-free-hubs-under-ten"]!;
    const expected = cheap.expected.extracted![0]!.records!;
    assert.equal(unsorted.length, expected.length);
    assert.notDeepEqual(unsorted, expected);
    assert.deepEqual(new Set(unsorted.map(({ title }) => title)), new Set(expected.map(({ title }) => title)));
  }));

  test("follow-official-store: Follow on the official store's card adds it to the account's list, and nothing else changes", () => withSession(async (session) => {
    const extracted = await runSteps(session, follow.recordingScript);
    assert.deepEqual(extracted["extract-followed-stores"], follow.expected.extracted![0]!.records);
    assert.deepEqual(await session.failingFacts(follow.expected.finalState!), []);
    const state = await stateOf(session);
    assert.deepEqual([state.following, state.cart, state.orders], [["hubsmith", "mirafone", "qinport", "voltbay-official"], [], []]);
    assert.deepEqual(unexpectedErrors(session), []);
  }));

  test("follow-official-store: following the lookalike VoltBay Store under the same title fails the list", () => withSession(async (session) => {
    const extracted = await runSteps(session, toLookalike(follow.recordingScript));
    assert.notDeepEqual(extracted["extract-followed-stores"], follow.expected.extracted![0]!.records);
    assert.notDeepEqual(await session.failingFacts(follow.expected.finalState!), []);
    assert.equal((await stateOf(session)).following.at(-1), "voltbay-lookalike");
  }));

  test("follow-official-store: a second press of the toggle unfollows, and the list is back to three", () => withSession(async (session) => {
    const at = follow.recordingScript.findIndex((step) => step.id === "follow-confirmed") + 1;
    const twice: ScenarioStep[] = [
      ...follow.recordingScript.slice(0, at),
      { id: "follow-press-again", operation: "click", target: `.${c.sideCard} >> text="Following"` },
      { id: "follow-undone", operation: "waitForState", target: `.${c.sideCard} >> text="Follow"`, timeoutMs: 5000 },
      ...follow.recordingScript.slice(at),
    ];
    const extracted = await runSteps(session, twice);
    assert.deepEqual(extracted["extract-followed-stores"], [{ following: "Followed stores: Hubsmith Global Store; Mirafone Accessories; Qinport Official Store" }]);
    assert.notDeepEqual(await session.failingFacts(follow.expected.finalState!), []);
  }));

  test("mint-hub-fallback: the Mint 10-in-1 refuses as sold out, and two Mint 7-in-1 from Spain are the one cart line", () => withSession(async (session) => {
    const extracted = await runSteps(session, mint.recordingScript);
    assert.deepEqual(extracted["extract-mint-fallback-cart"], mint.expected.extracted![0]!.records);
    assert.deepEqual(await session.failingFacts(mint.expected.finalState!), []);
    const state = await stateOf(session);
    assert.deepEqual(state.cart.map(({ listingId, choice, quantity }) => ({ listingId, ...choice, quantity })), [{ listingId: VOLTBAY_OFFICIAL_ID, color: "Mint", spec: "7-in-1", origin: "Spain", quantity: 2 }]);
    assert.deepEqual(unexpectedErrors(session), []);
  }));

  test("mint-hub-fallback: taking the Mint 10-in-1 from the lookalike seller, where it is in stock, fails the cart", () => withSession(async (session) => {
    const steps = toLookalike(mint.recordingScript)
      .filter((step) => step.id !== "mint-ten-sold-out" && step.id !== "mint-seven-in-one");
    const extracted = await runSteps(session, steps);
    assert.notDeepEqual(extracted["extract-mint-fallback-cart"], mint.expected.extracted![0]!.records);
    assert.deepEqual((await stateOf(session)).cart.map(({ listingId, choice }) => [listingId, choice.spec]), [[VOLTBAY_LOOKALIKE_ID, "10-in-1"]]);
    assert.notDeepEqual(await session.failingFacts(mint.expected.finalState!), []);
  }));

  test("uk-express-quote: the region, the listing, Buy now and express read the summary in pounds, and no order is placed", () => withSession(async (session) => {
    const extracted = await runSteps(session, uk.recordingScript);
    assert.deepEqual(extracted["extract-uk-express-quote"], uk.expected.extracted![0]!.records);
    assert.deepEqual(await session.failingFacts(uk.expected.finalState!), []);
    const state = await stateOf(session);
    assert.deepEqual([state.region, state.orders, state.checkout?.shipping], ["GB", [], { keelson: "express" }]);
    assert.deepEqual(unexpectedErrors(session), []);
  }));

  test("uk-express-quote: stopping at the checkout without choosing express reads standard shipping, which is not the quote", () => withSession(async (session) => {
    const extracted = await runSteps(session, [...upTo(uk.recordingScript, "uk-checkout-open"), stepOf(uk.recordingScript, "extract-uk-express-quote")]);
    assert.deepEqual(extracted["extract-uk-express-quote"], [{ items: "£17.16", shipping: "Free", total: "£17.16" }]);
    assert.notDeepEqual(extracted["extract-uk-express-quote"], uk.expected.extracted![0]!.records);
  }));

  test("uk-express-quote: the same journey without the region change reads euros, which is not the quote", () => withSession(async (session) => {
    const steps = uk.recordingScript.filter((step) => !["uk-open-region", "uk-choose-country", "uk-save-country", "uk-region-saved"].includes(step.id))
      .map((step) => (step.id === "uk-express-applied" ? { ...step, target: `.${c.cartSummary} >> text="6,99 €"` } : step));
    const extracted = await runSteps(session, steps);
    assert.deepEqual(extracted["extract-uk-express-quote"], [{ items: "19,95 €", shipping: "6,99 €", total: "26,94 €" }]);
    assert.notDeepEqual(extracted["extract-uk-express-quote"], uk.expected.extracted![0]!.records);
  }));
});
