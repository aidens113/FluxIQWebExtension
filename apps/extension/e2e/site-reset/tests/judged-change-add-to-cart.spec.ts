// DRAFT (t775 F1): expected to fail until phase D wires the trial gates; typechecked only, not yet run headed.
import type { JsonObject } from "fluxiq/core";
import { STORE_PATHS, TIDEWELL_KETTLES } from "../../../../scenario-lab/src/scenarios/everything-store/catalog/index.js";
import { expect, test } from "../../fixtures/extension-context";
import { bindInstrumentedRuntime, bindScriptedProvider, keepDiagnostic, openStoreDetail, pageHandle, projectBuild, startInstalledBuild, trialCode, type BuilderTurn } from "../index";
import { judgeLog, proofsOf, retiredCodesIn, supervisorWithEffect } from "../change-proof";

const TASK = "Add one kettle to the cart.";
const SAGE = TIDEWELL_KETTLES.find(product => product.variant?.colour === "Sage Green" && product.variant.capacity === "1.7 L")!;
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};

/**
 * Everything-store add-to-cart, judged with no reset (t775). Exploration adds the kettle once and leaves it in the
 * cart. The Flow is then tested twice, the second time as a changed revision so it runs as a trial of its own. Each
 * trial starts on the cart exploration left (and the first trial's line for the second), and no reset is asked: the
 * judge is shown the cart line moving by one, from the before-reading Core took just ahead of the trial.
 */
test("installed gateway project build judges an add-to-cart trial twice by the cart's change, with no reset", async ({ extensionSession }, testInfo) => {
  test.setTimeout(360_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const cart = new URL("/scenarios/everything-store/cart", installed.origin).href;
  const detail = new URL(STORE_PATHS.product(SAGE), installed.origin).href;
  const build = projectBuild(installed, "Installed change add to cart", TASK);
  const judge = judgeLog();
  const tests: JsonObject[] = [];
  const pages: Record<string, string> = {};
  let destinationReference = "", addHandle = "";
  try {
    await openStoreDetail(page, installed.origin, detail);
    await installed.pair();
    const observed = bindInstrumentedRuntime(installed);
    const flow = (looksAtEnd: boolean) => [`flow: New line`, `step open: open the product`, `  node: web.browser-navigate`, `  url: ${JSON.stringify(detail)}`,
      `step add: add the product`, `  node: web.dom.click`, `  target: ${addHandle}`, `  consequences: create_new`,
      ...(looksAtEnd ? [`step check: look at the product page`, `  node: web.dom.capture_snapshot`] : [])].join("\n");
    const builder = (turn: BuilderTurn) => {
      const { last, node, call } = turn;
      pages[`step-${turn.step}`] = turn.shownPage();
      if (turn.step === 1) return node("original", "web.output.browser-navigate", { url: cart });
      if (turn.step === 2) {
        const destinations = record(last("core.run_node")?.resetDestinations).collections as JsonObject[] | undefined;
        const reference = destinations?.[0]?.ref;
        if (typeof reference !== "string") throw new Error("diagnostic.original_destination_ref_missing");
        destinationReference = reference;
        return node("detail", "web.output.browser-navigate", { url: detail });
      }
      if (turn.step === 3) {
        addHandle = pageHandle(turn.shownPage(), "Add to Cart");
        return node("add", "web.output.dom-click", { target: { handle: addHandle } }, ["create_new"], { resetDestination: destinationReference });
      }
      // The builder leaves the line in the cart and tests at once: no undo, no look naming an act.
      if (turn.step === 4) return call("submit", "core.submit_subflow", { flow: flow(false) });
      const submitted = last("core.submit_subflow");
      if (typeof submitted?.revision !== "number" || typeof submitted.digest !== "string") throw new Error("diagnostic.submission_refused");
      const candidate = { revision: submitted.revision, digest: submitted.digest };
      if (turn.step === 5) return call("trial.first", "core.test_subflow", candidate);
      if (turn.step === 6) {
        tests.push(record(last("core.test_subflow")));
        return call("submit.second", "core.submit_subflow", { flow: flow(true) });
      }
      if (turn.step === 7) return call("trial.second", "core.test_subflow", candidate);
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
    await keepDiagnostic(testInfo, "change-add-to-cart.json", { ending, failure, tests, retired, siteChanges, outcomes: observed.outcomes, receipts: provider.receipts, pages });

    expect(ending).toBe("proposed");
    // No retired reset code anywhere in the step log.
    expect(retired).toEqual([]);
    // Both trials ran and were judged yes, with no undo named by the builder.
    expect(tests.map(trialCode)).toEqual(["yes", "yes"]);
    expect(observed.declarations.filter(declaration => declaration.call.startsWith("undo"))).toEqual([]);
    // Every judge request carries the site's change: the cart moved, and the part's proof is `shown`.
    expect(judge.requests.length).toBeGreaterThanOrEqual(2);
    for (const siteChange of siteChanges) {
      expect(siteChange).toBeDefined();
      const witnesses = (siteChange?.witnesses as JsonObject[] | undefined) ?? [];
      expect(witnesses.some(witness => witness.change !== "none")).toBe(true);
      expect(proofsOf(siteChange)).toContain("shown");
    }
  } finally {
    await build.stop();
    await installed.close();
  }
});
