import type { TestInfo } from "@playwright/test";
import type { JsonObject } from "fluxiq/core";
import { STORE_PATHS, TIDEWELL_KETTLES } from "../../../../scenario-lab/src/scenarios/everything-store/catalog/index.js";
import { expect, test, type ExtensionSession } from "../../fixtures/extension-context";
import { bindInstrumentedRuntime, bindScriptedProvider, keepDiagnostic, openStoreDetail, pageHandle, projectBuild, startInstalledBuild, startedWithActs, trialCode, type BuilderTurn, type ObservedOutcome, type ObservedRead } from "../index";

const TASK = "Start a checkout for one product.";
const SAGE = TIDEWELL_KETTLES.find(product => product.variant?.colour === "Sage Green" && product.variant.capacity === "1.7 L")!;
/** Core's words for an act settled with no change seen (`site-reset/words.ts`, `leftUnchanged`). */
const LEFT_UNCHANGED = "nothing it could change showed a change";
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};

type OfficeRun = {
  ending: string;
  destinationReference: string;
  baseline: string | undefined;
  clicksBeforeBuy: number;
  clicksAfterBuy: number;
  clicksEnd: number;
  tests: JsonObject[];
  /** The revision each test was asked of. */
  revisions: number[];
  /** Core's own looks (`site-reset.look.N.arrival`), each with the test it ran before. */
  looksBefore: number[];
  outcomes: ObservedOutcome[];
  cartReads: ObservedRead[];
  buy: { consequences: unknown; permitted: boolean } | undefined;
  lookDeclarations: Array<{ consequences: unknown }>;
};

/**
 * The office build (office r1/r2): the cart is read complete and its ref
 * issued, Buy Now is pressed declaring create_new against that ref, and the
 * subflow that presses Buy Now is submitted and tested. With two trials the
 * build then visits somewhere other than the cart, so that only Core's own
 * look can read the cart again, and submits a second revision that adds a
 * look at the checkout page the press opens: a single-subflow plan's test of a
 * revision already judged yes answers with that stored yes and runs nothing
 * (Core `project-agents/supervisor/whole-trial.ts`, t679), and an unchanged or
 * merely reworded resubmission is refused as unchanged, so only a revision
 * that changes a step makes the second test a trial with its own Buy Now
 * press. No undo is ever pressed.
 */
async function runOfficeBuild(extensionSession: ExtensionSession, testInfo: TestInfo, trials: 1 | 2): Promise<OfficeRun> {
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const cart = new URL("/scenarios/everything-store/cart", installed.origin).href;
  const detail = new URL(STORE_PATHS.product(SAGE), installed.origin).href;
  const build = projectBuild(installed, "Installed reset office", TASK);
  let destinationReference = "", buyHandle = "";
  let baseline: string | undefined;
  let clicksBeforeBuy = 0, clicksAfterBuy = 0;
  const tests: JsonObject[] = [];
  const pages: Record<string, string> = {};
  const outcomesAtTest: number[] = [];
  const revisions: number[] = [];
  try {
    await openStoreDetail(page, installed.origin, detail);
    await installed.pair();
    const observed = bindInstrumentedRuntime(installed);
    const { reads } = observed;
    /** The Flow the build submits: open the product and press Buy Now; the second revision also looks at the checkout page the press opened. */
    const checkoutFlow = (looksAtCheckout: boolean) => [`flow: Checkout`, `step open: open the product`, `  node: web.browser-navigate`, `  url: ${JSON.stringify(detail)}`, `step buy: start the checkout`, `  node: web.dom.click`, `  target: ${buyHandle}`, `  consequences: create_new`,
      ...(looksAtCheckout ? [`step check: look at the checkout page`, `  node: web.dom.capture_snapshot`] : [])].join("\n");
    const builder = (turn: BuilderTurn) => {
      const { last, node, call } = turn;
      pages[`step-${turn.step}`] = turn.shownPage();
      if (turn.step === 1) return node("original", "web.output.browser-navigate", { url: cart });
      if (turn.step === 2) {
        baseline = reads.at(-1)?.hash;
        const destinations = record(last("core.run_node")?.resetDestinations).collections as JsonObject[] | undefined;
        const reference = destinations?.[0]?.ref;
        if (typeof reference !== "string") throw new Error("diagnostic.original_destination_ref_missing");
        destinationReference = reference;
        return node("detail", "web.output.browser-navigate", { url: detail });
      }
      if (turn.step === 3) {
        buyHandle = pageHandle(turn.shownPage(), "Buy Now");
        clicksBeforeBuy = observed.clicks();
        return node("buy", "web.output.dom-click", { target: { handle: buyHandle } }, ["create_new"], { resetDestination: destinationReference });
      }
      if (turn.step === 4) {
        clicksAfterBuy = observed.clicks();
        return call("submit", "core.submit_subflow", { flow: checkoutFlow(false) });
      }
      const submitted = last("core.submit_subflow");
      if (typeof submitted?.revision !== "number" || typeof submitted.digest !== "string") throw new Error("diagnostic.submission_refused");
      const candidate = { revision: submitted.revision, digest: submitted.digest };
      if (turn.step === 5) {
        revisions.push(candidate.revision);
        outcomesAtTest.push(observed.outcomes.length);
        return call("trial.first", "core.test_subflow", candidate);
      }
      if (turn.step === 6) tests.push(record(last("core.test_subflow")));
      if (turn.step === 6 && trials === 2) {
        // Somewhere other than the cart, so only Core's own look can read it again.
        return node("elsewhere", "web.output.browser-navigate", { url: detail });
      }
      // A changed revision, so the second test is a trial of its own rather than the first test's stored yes.
      if (turn.step === 7 && trials === 2) return call("submit.second", "core.submit_subflow", { flow: checkoutFlow(true) });
      if (turn.step === 8 && trials === 2) {
        revisions.push(candidate.revision);
        outcomesAtTest.push(observed.outcomes.length);
        return call("trial.second", "core.test_subflow", candidate);
      }
      if (turn.step === 9) tests.push(record(last("core.test_subflow")));
      return turn.complete({ subflowKey: "main", ...candidate });
    };
    const provider = bindScriptedProvider(installed, { task: TASK, permitted: ["create_new"], instructionSourceId: build.instructionSourceId, maxIterations: 20, maxCallsPerRun: 30, builder });
    const { ending, failure } = await build.run();
    const outcomes = observed.outcomes;
    const looks = outcomes.filter(outcome => outcome.call.startsWith("site-reset.look."));
    const looksBefore = outcomesAtTest.map((start, index) => looks.filter(look => outcomes.indexOf(look) >= start && (index + 1 >= outcomesAtTest.length || outcomes.indexOf(look) < outcomesAtTest[index + 1]!)).length);
    const cartReads = reads.filter(read => read.location?.includes("/everything-store/cart") === true);
    const buy = observed.declarations.find(declaration => declaration.call === "buy");
    const lookDeclarations = observed.declarations.filter(declaration => declaration.call.startsWith("site-reset."));
    const run: OfficeRun = { ending, destinationReference, baseline, clicksBeforeBuy, clicksAfterBuy, clicksEnd: observed.clicks(), tests, revisions, looksBefore, outcomes, cartReads, buy, lookDeclarations };
    await keepDiagnostic(testInfo, "reset-office.json", { ...run, failure, builderStep: provider.builderSteps(), reads, declarations: observed.declarations, receipts: provider.receipts, gatewayErrors: installed.gatewayErrors, pages });
    console.log(JSON.stringify({ resetDiagnostic: { ending, failure, tests: tests.map(trialCode), revisions, looksBefore } }));
    return run;
  } finally {
    await build.stop();
    await installed.close();
  }
}

/** What both office proofs hold: the creation pressed once against the cart's ref, no undo of any kind, and a cart exactly as the build found it. */
function expectOfficeCommon(run: OfficeRun, tests: number): void {
  expect(run.ending).toBe("proposed");
  expect(run.destinationReference).toMatch(/^destination-[1-9][0-9]{0,3}$/u);
  expect(run.baseline).toMatch(/^[a-f0-9]{20}$/u);
  expect(run.buy?.consequences).toEqual(["create_new"]);
  expect(run.buy?.permitted).toBe(true);
  expect(run.clicksAfterBuy).toBe(run.clicksBeforeBuy + 1);
  expect(run.outcomes.find(outcome => outcome.call === "buy")?.ok).toBe(true);
  // No undo was asked for or pressed: after the press no builder or Core call clicked anything.
  expect(run.outcomes.some(outcome => outcome.call.startsWith("undo"))).toBe(false);
  expect(run.clicksEnd).toBe(run.clicksAfterBuy);
  // Core's own looks only navigate, declaring nothing lasting.
  for (const declaration of run.lookDeclarations) expect(declaration.consequences).toEqual([]);
  // Each test asked a revision of its own and ran as a trial of its own, with its own Buy Now press.
  expect(run.tests).toHaveLength(tests);
  expect(run.revisions).toEqual(Array.from({ length: tests }, (_, index) => index + 1));
  expect(run.tests.map(tested => tested.revision)).toEqual(run.revisions);
  expect(new Set(run.tests.map(tested => tested.trialRunId)).size).toBe(tests);
  for (const tested of run.tests) {
    expect(tested.trialRunId).toMatch(/^trial\./u);
    const steps = (record(tested.feedback).steps as JsonObject[] | undefined) ?? [];
    expect(steps.some(step => step.control === "Buy Now" && step.status === "succeeded")).toBe(true);
  }
  // The cart: every read of it, the builder's and Core's own, shows it exactly as the build found it.
  expect(run.cartReads.length).toBeGreaterThanOrEqual(2);
  for (const read of run.cartReads) expect(read.hash).toBe(run.baseline);
}

/**
 * Office shape C (office r1): a creation declared against the cart that the
 * cart never shows. Before the first test Core looks at the cart itself, the
 * press settles with no change seen, and the trial is admitted listing it as
 * left -- no undo pressed.
 */
test("installed gateway project build settles a create the cart never shows on Core's own look", async ({ extensionSession }, testInfo) => {
  test.setTimeout(240_000);
  const run = await runOfficeBuild(extensionSession, testInfo, 1);
  expectOfficeCommon(run, 1);
  expect(trialCode(run.tests[0])).toBe("yes");
  expect(run.looksBefore).toEqual([1]);
  const started = startedWithActs(run.tests[0]);
  expect(started.map(act => act.call)).toEqual(["buy"]);
  expect(started[0]!.did).toContain(LEFT_UNCHANGED);
});

/**
 * Office shape E (office r2): the trial's own press repeats the explored one
 * and inherits its cart destination, so on the next test -- of a second
 * revision, so that it runs as a trial of its own -- Core's own look settles
 * both and the trial is admitted listing both as left. In a
 * single-subflow plan the builder's test is the judged whole run, recorded in
 * the supervisor's ledger, so this also proves repeats match the explored
 * acts of every ledger of the build (`l1-d3-browser-proof.md`, office E).
 */
test("installed gateway project build settles the trial act repeating a create on Core's own look", async ({ extensionSession }, testInfo) => {
  test.setTimeout(300_000);
  const run = await runOfficeBuild(extensionSession, testInfo, 2);
  expectOfficeCommon(run, 2);
  expect(run.tests.map(trialCode)).toEqual(["yes", "yes"]);
  expect(run.looksBefore).toEqual([1, 1]);
  const first = startedWithActs(run.tests[0]);
  const second = startedWithActs(run.tests[1]);
  expect(second).toHaveLength(2);
  expect(second[0]).toMatchObject({ act: first[0]!.act, call: "buy" });
  expect(second[1]!.call).toBeUndefined();
  expect(second[1]!.did).toMatch(/^trial step \d+ /u);
  for (const act of second) expect(act.did).toContain(LEFT_UNCHANGED);
});
