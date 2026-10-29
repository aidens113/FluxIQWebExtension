import type { JsonObject } from "fluxiq/core";
import { itemHref } from "../../../../../../scenario-lab/src/scenarios/crossborder-marketplace/markup/index.js";
import { expect, test } from "../../../../fixtures/extension-context";
import { bindInstrumentedRuntime, bindScriptedProvider, keepDiagnostic, pageHandle, pageHandleWhere, projectBuild, startInstalledBuild, trialCode, type BuilderTurn } from "../../../index";
import { judgeLog, proofsOf, retiredCodesIn, supervisorWithEffect } from "../../../change-proof";

const TASK = "Add one hub to the cart.";
/** A hub with one colour, one warehouse and no specification, so its default choice is complete and one press adds it. */
const ITEM_ID = "1005008401187";
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
const list = (value: unknown): JsonObject[] => Array.isArray(value) ? value.map(record) : [];

/**
 * Crossborder add-to-cart, whose effect shows on /cart (t791 fixes 1, 2, 3 and 4), provider-free. The cart is an
 * empty-state panel before the first add and unroled `<div>` lines after it, so no list or table collection exists
 * there. The builder reads /cart complete in the item's own tab: Core must issue a page-level `destination-N` receipt
 * (`page: true`). The press naming it is witnessed (no `resetDestinationUnreached` note), the trial then runs (not
 * refused `candidate.trial_step_unwitnessed`), and the judge's packet reads the cart change from the page.
 */
test("installed gateway project build on crossborder witnesses an add-to-cart by the cart page read empty, then judges the trial", async ({ extensionSession }, testInfo) => {
  test.setTimeout(420_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const root = new URL("/scenarios/crossborder-marketplace/", installed.origin).href;
  const cart = new URL("cart", root).href;
  const detail = new URL(itemHref(ITEM_ID), installed.origin).href;
  const build = projectBuild(installed, "Installed change crossborder cart", TASK, detail);
  const judge = judgeLog();
  const tests: JsonObject[] = [];
  const pages: Record<string, string> = {};
  const runNodes: Record<string, JsonObject> = {};
  let destinationReference = "", receipts: JsonObject[] = [], addHandle = "", pressed: JsonObject = {};
  try {
    await page.goto(root);
    await page.getByText("Accept all", { exact: true }).click();
    await page.goto(detail);
    await installed.pair();
    const observed = bindInstrumentedRuntime(installed);
    const flow = () => [`flow: Add hub`, `step open: open the item`, `  node: web.browser-navigate`, `  url: ${JSON.stringify(detail)}`,
      `step add: add the item`, `  node: web.dom.click`, `  target: ${addHandle}`, `  consequences: create_new`,
      `step cart: open the cart`, `  node: web.browser-navigate`, `  url: ${JSON.stringify(cart)}`,
      `step check: look at the cart`, `  node: web.dom.capture_snapshot`].join("\n");
    const builder = (turn: BuilderTurn) => {
      const { last, node, call } = turn;
      pages[`step-${turn.step}`] = turn.shownPage();
      if (turn.step === 1) return node("original", "web.output.browser-navigate", { url: cart });
      if (turn.step === 2) {
        const destinations = record(last("core.run_node")?.resetDestinations);
        receipts = list(destinations.collections);
        const reference = receipts[0]?.ref;
        if (typeof reference !== "string") throw new Error("diagnostic.cart_page_ref_missing");
        destinationReference = reference;
        return node("detail", "web.output.browser-navigate", { url: detail });
      }
      if (turn.step === 3) {
        addHandle = pageHandle(turn.shownPage(), "Add to cart");
        return node("add", "web.output.dom-click", { target: { handle: addHandle } }, ["create_new"], { resetDestination: destinationReference });
      }
      if (turn.step === 4) {
        pressed = record(last("core.run_node"));
        return call("submit", "core.submit_subflow", { flow: flow() });
      }
      const submitted = last("core.submit_subflow");
      if (typeof submitted?.revision !== "number" || typeof submitted.digest !== "string") throw new Error("diagnostic.submission_refused");
      const candidate = { revision: submitted.revision, digest: submitted.digest };
      if (turn.step === 5) return call("trial", "core.test_subflow", candidate);
      tests.push(record(last("core.test_subflow")));
      return turn.complete({ subflowKey: "main", ...candidate });
    };
    const provider = bindScriptedProvider(installed, {
      task: TASK, permitted: ["create_new"], instructionSourceId: build.instructionSourceId, maxIterations: 20, maxCallsPerRun: 30, builder, verify: judge.verify,
      supervisor: supervisorWithEffect({ permitted: ["create_new"], maxIterations: 20, effect: { kind: "change", direction: "adds", count: 1, what: "one product in the cart" } })
    });
    const { ending, failure } = await build.run();
    const siteChanges = judge.siteChanges();
    const retired = retiredCodesIn(tests, observed.outcomes, provider.receipts, failure);
    await keepDiagnostic(testInfo, "change-cart-page.json", { ending, failure, receipts, destinationReference, pressed, tests, retired, siteChanges, judgeRequests: judge.requests, outcomes: observed.outcomes, receiptsOfProvider: provider.receipts, pages, runNodes });

    // The empty cart page read in the item's own tab issued a page-level destination.
    expect(destinationReference).toMatch(/^destination-[1-9][0-9]{0,2}$/u);
    expect(receipts[0]?.page).toBe(true);
    // The press naming it is witnessed: no note that the ref shows nothing of its change.
    expect(JSON.stringify(pressed)).not.toContain("resetDestinationUnreached");
    expect(pressed.ok ?? record(pressed.evidence).ok).not.toBe(false);
    // The trial ran, not refused unwitnessed.
    expect(ending).toBe("proposed");
    expect(retired).toEqual([]);
    expect(JSON.stringify([tests, observed.outcomes])).not.toContain("candidate.trial_step_unwitnessed");
    expect(tests.map(trialCode)).toEqual(["yes"]);
    // The judge's packet reads the cart change from the page.
    expect(judge.requests.length).toBeGreaterThanOrEqual(1);
    expect(siteChanges.length).toBeGreaterThanOrEqual(1);
    for (const siteChange of siteChanges) {
      expect(siteChange).toBeDefined();
      const witnesses = list(siteChange?.witnesses);
      // The cart page witness moved: its lines went from one in the cart to two, and the pressing step is judged `changed`.
      expect(witnesses.some(witness => witness.kind === "list" && String(witness.where).endsWith("/cart"))).toBe(true);
      expect(JSON.stringify(witnesses)).toContain("Cart (2)");
      expect(list(siteChange?.acts).some(act => act.outcome === "changed")).toBe(true);
      expect(proofsOf(siteChange)).toContain("shown");
      expect(JSON.stringify(siteChange)).not.toContain("unwitnessed");
    }
  } finally {
    await build.stop();
    await installed.close();
  }
});

/**
 * A ref read in one tab names nothing in another (t791 fix 3). The home page is read complete in its own tab, a card
 * opens the item in a new tab, and Add to cart pressed there naming the home page's ref is told, beside its answer,
 * that the ref shows nothing of its change (`resetDestinationUnreached`).
 */
test("installed gateway project build on crossborder tells a press that names a ref read in another tab", async ({ extensionSession }, testInfo) => {
  test.setTimeout(420_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const root = new URL("/scenarios/crossborder-marketplace/", installed.origin).href;
  const build = projectBuild(installed, "Installed change crossborder other tab", TASK, root);
  const pages: Record<string, string> = {};
  let reference = "", pressed: JsonObject = {};
  try {
    await page.goto(root);
    await page.getByText("Accept all", { exact: true }).click();
    await installed.pair();
    const observed = bindInstrumentedRuntime(installed);
    const builder = (turn: BuilderTurn) => {
      const { last, node, complete } = turn;
      pages[`step-${turn.step}`] = turn.shownPage();
      if (turn.step === 1) return node("home", "web.output.browser-navigate", { url: root });
      if (turn.step === 2) {
        const issued = list(record(last("core.run_node")?.resetDestinations).collections)[0]?.ref;
        if (typeof issued !== "string") throw new Error("diagnostic.home_ref_missing");
        reference = issued;
        const card = pageHandleWhere(turn.shownPage(), /^t\d+ (?:h[1-6] )?link "Hubsmith USB C Hub 6 in 1/u);
        if (!card) throw new Error("diagnostic.card_missing");
        return node("open", "web.output.dom-click", { target: { handle: card } });
      }
      if (turn.step === 3) {
        const add = pageHandle(turn.shownPage(), "Add to cart");
        return node("add", "web.output.dom-click", { target: { handle: add } }, ["create_new"], { resetDestination: reference });
      }
      pressed = record(last("core.run_node"));
      return complete({ subflowKey: "main" });
    };
    bindScriptedProvider(installed, { task: TASK, permitted: ["create_new"], instructionSourceId: build.instructionSourceId, maxIterations: 12, maxCallsPerRun: 20, builder, verify: judgeLog().verify });
    const { ending, failure } = await build.run();
    await keepDiagnostic(testInfo, "change-cart-other-tab.json", { ending, failure, reference, pressed, outcomes: observed.outcomes, pages });
    expect(reference).toMatch(/^destination-[1-9][0-9]{0,2}$/u);
    expect(JSON.stringify(pressed)).toContain("resetDestinationUnreached");
  } finally {
    await build.stop();
    await installed.close();
  }
});
