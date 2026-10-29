// DRAFT (t775 F1): expected to fail until phase D wires the trial gates; typechecked only, not yet run headed.
import type { JsonObject } from "fluxiq/core";
import { STORE_PATHS, TIDEWELL_KETTLES } from "../../../../../../scenario-lab/src/scenarios/everything-store/catalog/index.js";
import { expect, test } from "../../../../fixtures/extension-context";
import { bindInstrumentedRuntime, bindScriptedProvider, keepDiagnostic, openStoreDetail, pageHandle, pageHandleWhere, projectBuild, startInstalledBuild, trialCode, type BuilderTurn } from "../../../index";
import { judgeLog, proofsOf, retiredCodesIn, supervisorWithEffect } from "../../../change-proof";

const TASK = "Start a checkout for one product and deliver it to the other saved address.";
const SAGE = TIDEWELL_KETTLES.find(product => product.variant?.colour === "Sage Green" && product.variant.capacity === "1.7 L")!;
const CONFIRM = "Deliver to this address";
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};

/**
 * Everything-store office checkout with the address already set (t775). Exploration chooses the other saved address
 * and presses the confirm, so the address is already the asked one when the Flow is tested. The part is an
 * `end_state` ("delivered to the other saved address") and its step was seen to make that change in exploration, so
 * the trial is judged with proof `carried`, not `already_in_end_state`. No undo is asked and the builder names none.
 */
test("installed gateway project build judges an office checkout whose address is already set as carried, asking no undo", async ({ extensionSession }, testInfo) => {
  test.setTimeout(360_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const cart = new URL("/scenarios/everything-store/cart", installed.origin).href;
  const detail = new URL(STORE_PATHS.product(SAGE), installed.origin).href;
  const build = projectBuild(installed, "Installed change office address", TASK, detail);
  const judge = judgeLog();
  const pages: Record<string, string> = {};
  const tests: JsonObject[] = [];
  let destinationReference = "", buyHandle = "", changeHandle = "", radioHandle = "", confirmHandle = "";
  try {
    await openStoreDetail(page, installed.origin, detail);
    await installed.pair();
    const observed = bindInstrumentedRuntime(installed);
    const flow = (looksAtEnd: boolean) => [`flow: Checkout`, `step open: open the product`, `  node: web.browser-navigate`, `  url: ${JSON.stringify(detail)}`,
      `step buy: start the checkout`, `  node: web.dom.click`, `  target: ${buyHandle}`, `  consequences: create_new`,
      `step chooser: open the address chooser`, `  node: web.dom.click`, `  target: ${changeHandle}`, `  consequences: none`,
      `step choose: choose the other saved address`, `  node: web.dom.click`, `  target: ${radioHandle}`, `  consequences: none`,
      `step confirm: confirm the chosen address`, `  node: web.dom.click`, `  target: ${confirmHandle}`, `  consequences: modify_existing`,
      ...(looksAtEnd ? [`step check: look at the checkout page`, `  node: web.dom.capture_snapshot`] : [])].join("\n");
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
        buyHandle = pageHandle(turn.shownPage(), "Buy Now");
        return node("buy", "web.output.dom-click", { target: { handle: buyHandle } }, ["create_new"], { resetDestination: destinationReference });
      }
      if (turn.step === 4) {
        changeHandle = pageHandle(turn.shownPage(), "Change");
        return node("chooser", "web.output.dom-click", { target: { handle: changeHandle } });
      }
      if (turn.step === 5) {
        const found = pageHandleWhere(turn.shownPage(), /^t\d+ radio "[^"]*" unchecked$/u);
        if (!found) throw new Error("diagnostic.other_address_missing");
        radioHandle = found;
        return node("choose", "web.output.dom-click", { target: { handle: radioHandle } });
      }
      if (turn.step === 6) {
        confirmHandle = pageHandle(turn.shownPage(), CONFIRM);
        // The explored confirm sets the address: it stays in place, so the tested Flow starts with it already set.
        return node("confirm", "web.output.dom-click", { target: { handle: confirmHandle } }, ["modify_existing"]);
      }
      if (turn.step === 7) return call("submit", "core.submit_subflow", { flow: flow(false) });
      const submitted = last("core.submit_subflow");
      if (typeof submitted?.revision !== "number" || typeof submitted.digest !== "string") throw new Error("diagnostic.submission_refused");
      const candidate = { revision: submitted.revision, digest: submitted.digest };
      if (turn.step === 8) return call("trial", "core.test_subflow", candidate);
      tests.push(record(last("core.test_subflow")));
      return turn.complete({ subflowKey: "main", ...candidate });
    };
    const provider = bindScriptedProvider(installed, {
      task: TASK, permitted: ["create_new", "modify_existing"], instructionSourceId: build.instructionSourceId, maxIterations: 24, maxCallsPerRun: 36, builder, verify: judge.verify,
      supervisor: supervisorWithEffect({ permitted: ["create_new", "modify_existing"], maxIterations: 24, effect: { kind: "end_state", state: "the checkout delivers to the other saved address" } })
    });
    const { ending, failure } = await build.run();
    const siteChanges = judge.siteChanges();
    const retired = retiredCodesIn(tests, observed.outcomes, provider.receipts, failure);
    await keepDiagnostic(testInfo, "change-office-address.json", { ending, failure, tests, retired, siteChanges, outcomes: observed.outcomes, receipts: provider.receipts, pages });

    // No retired reset code anywhere in the step log, and no undo asked of the builder or named by it.
    expect(retired).toEqual([]);
    expect(observed.declarations.filter(declaration => declaration.call.startsWith("undo"))).toEqual([]);
    expect(tests.map(trialCode)).toEqual(["yes"]);
    // The judge request carries the site's change, and the address proof is carried from the explored confirm.
    expect(judge.requests.length).toBeGreaterThanOrEqual(1);
    const siteChange = siteChanges.at(-1);
    expect(siteChange).toBeDefined();
    expect(proofsOf(siteChange)).toContain("carried");
    expect(proofsOf(siteChange)).not.toContain("already_in_end_state");
  } finally {
    await build.stop();
    await installed.close();
  }
});
