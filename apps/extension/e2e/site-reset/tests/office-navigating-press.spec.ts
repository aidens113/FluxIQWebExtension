import type { JsonObject } from "fluxiq/core";
import { STORE_PATHS, TIDEWELL_KETTLES } from "../../../../scenario-lab/src/scenarios/everything-store/catalog/index.js";
import { expect, test } from "../../fixtures/extension-context";
import { actsUnder, bindInstrumentedRuntime, bindScriptedProvider, keepDiagnostic, openStoreDetail, pageHandle, projectBuild, startInstalledBuild, startedWithActs, trialCode, type BuilderTurn, type ScriptedAnswer } from "../index";

const TASK = "Start a checkout for one product.";
const SAGE = TIDEWELL_KETTLES.find((product) => product.variant?.colour === "Sage Green" && product.variant.capacity === "1.7 L")!;
/** Core's words for an act settled with no change seen (`site-reset/words.ts`, `leftUnchanged`). */
const LEFT_UNCHANGED = "nothing it could change showed a change";
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
const feedbackSteps = (tested: JsonObject | undefined) => (record(tested?.feedback).steps as JsonObject[] | undefined) ?? [];
/** An act a gate could not settle by any call, as it named it. */
const unsettleableIn = (answer: JsonObject | undefined) => (Array.isArray(answer?.actsUnsettleable) ? answer.actsUnsettleable : []).map(record).map((entry) => ({ act: String(entry.act ?? ""), reason: entry.reason ?? null, failed: entry.failed ?? null }));
/** A page address a settle names, when it names one. */
const settleAddress = (settle: string | undefined) => /https?:\/\/[^\s"]+/u.exec(settle ?? "")?.[0]?.replace(/[.,;:]$/u, "");

/**
 * Office rerun round 5 (`run-mvhibit5-e1d3a4f3`, cause 2, structural): a
 * lasting press that navigates away -- Buy Now, which opens checkout -- reports
 * no control states (the domain emits a step's `controls` only for a stateful
 * control on a step that stayed on its document), so a trial's Buy Now could
 * be witnessed only by an explored act it repeats or by a list a judge adopted
 * for it; with neither, it was `gate_unsatisfiable` (`nothing_to_name`) and
 * every later trial was refused.
 *
 * t751 R3 (`t751-reset-by-observed-state.md`): a reversible lasting step is
 * stamped with its witness at submission -- the explored act it repeats lends
 * its lists -- and judge adoption is deleted, so the trial act's witness comes
 * only from that stamp.
 *
 * The build reads the cart complete (its ref issued), presses Buy Now on the
 * product page naming it (the explored twin), submits open + Buy Now and tests
 * it: the trial presses Buy Now itself, a navigating lasting act. It then goes
 * somewhere other than the cart, so that only Core's own look can read it, and
 * submits a second revision that also looks at checkout, so its test is a
 * trial of its own. If a gate asks to read a list again it reads that page
 * and tests again; no undo is ever pressed, because Buy Now leaves the cart as
 * it was (`state/checkout-ops.ts`).
 *
 * Expected: the trial act carries the cart as its witness, Core's look reads
 * the cart, the act settles on it with no change seen, and the next trial is
 * admitted; no act is ever unsettleable.
 */
test("installed gateway project build witnesses a trial's navigating press by the list its explored twin named and admits the next trial", async ({ extensionSession }, testInfo) => {
  test.setTimeout(420_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const cart = new URL(STORE_PATHS.cart, installed.origin).href;
  const detail = new URL(STORE_PATHS.product(SAGE), installed.origin).href;
  const build = projectBuild(installed, "Installed reset office navigating press", TASK);
  const pages: Record<string, string> = {};
  /** Each scripted call's own answer, by call id. */
  const answers: Record<string, JsonObject> = {};
  /** Clicks dispatched just before each scripted call and just after its answer. */
  const clicks: Record<string, { before: number; after?: number }> = {};
  /** How many tool outcomes had been seen when each test was asked, to count Core's own looks before it. */
  const outcomesAtTest: Record<string, number> = {};
  const sent: string[] = [];
  const tests: Array<{ call: string; answer: JsonObject }> = [];
  let destinationReference = "", buyHandle = "";
  let baseline: string | undefined;
  try {
    await openStoreDetail(page, installed.origin, detail);
    await installed.pair();
    const observed = bindInstrumentedRuntime(installed);
    const { reads } = observed;
    let pending = "", finished = false, rereads = 0;
    let candidate: { revision: number; digest: string } | undefined;
    const send = (callId: string, made: ScriptedAnswer) => {
      pending = callId;
      sent.push(callId);
      clicks[callId] = { before: observed.clicks() };
      if (callId.startsWith("trial.")) outcomesAtTest[callId] = observed.outcomes.length;
      return made;
    };
    const checkoutFlow = (looksAtCheckout: boolean) => [
      "flow: Checkout",
      "step open: open the product", "  node: web.browser-navigate", `  url: ${JSON.stringify(detail)}`,
      "step buy: start the checkout", "  node: web.dom.click", `  target: ${buyHandle}`, "  consequences: create_new",
      ...(looksAtCheckout ? ["step check: look at the checkout page", "  node: web.dom.capture_snapshot"] : [])
    ].join("\n");
    const builder = (turn: BuilderTurn): ScriptedAnswer => {
      const { last, node, call } = turn;
      pages[`step-${turn.step}`] = turn.shownPage();
      const previous = pending;
      if (pending) {
        answers[pending] = record([...turn.evidence].reverse().find((entry) => entry.callId === pending)?.value);
        clicks[pending]!.after = observed.clicks();
        if (pending.startsWith("trial.")) tests.push({ call: pending, answer: answers[pending]! });
        pending = "";
      }
      const done = () => {
        finished = true;
        return turn.complete({ subflowKey: "main", ...(candidate ?? {}) });
      };
      // A later brief, or a turn after the script's end, is not scripted: it completes at once.
      if (finished) return done();
      const submitted = (callId: string) => {
        const answer = answers[callId];
        if (typeof answer?.revision !== "number" || typeof answer.digest !== "string") return false;
        candidate = { revision: answer.revision, digest: answer.digest };
        return true;
      };
      /** A refused test whose acts a fresh read could settle: read the page its first such settle names, then test again. */
      const reread = (tested: JsonObject, again: string) => {
        const address = actsUnder(tested, "actsToUndo").map((act) => settleAddress(act.settle)).find((value) => value !== undefined);
        if (!address || rereads >= 2) return done();
        rereads++;
        return send(`reread.${rereads}.${again}`, node(`reread.${rereads}.${again}`, "web.output.browser-navigate", { url: address }));
      };
      if (previous.startsWith("reread.")) {
        const again = previous.split(".").slice(2).join(".");
        return send(`${again}.${rereads}`, call(`${again}.${rereads}`, "core.test_subflow", candidate!));
      }
      switch (previous.replace(/\.\d+$/u, "")) {
        case "":
          return send("original", node("original", "web.output.browser-navigate", { url: cart }));
        case "original": {
          baseline = reads.at(-1)?.hash;
          const reference = (record(last("core.run_node")?.resetDestinations).collections as JsonObject[] | undefined)?.[0]?.ref;
          if (typeof reference !== "string") throw new Error("diagnostic.original_destination_ref_missing");
          destinationReference = reference;
          return send("detail", node("detail", "web.output.browser-navigate", { url: detail }));
        }
        case "detail":
          // The explored twin: Buy Now naming the cart, which it never changes.
          buyHandle = pageHandle(turn.shownPage(), "Buy Now");
          return send("buy", node("buy", "web.output.dom-click", { target: { handle: buyHandle } }, ["create_new"], { resetDestination: destinationReference }));
        case "buy":
          return send("submit", call("submit", "core.submit_subflow", { flow: checkoutFlow(false) }));
        case "submit":
          if (!submitted("submit")) return done();
          return send("trial.first", call("trial.first", "core.test_subflow", candidate!));
        case "trial.first": {
          const tested = answers[previous]!;
          if (typeof tested.trialRunId !== "string") return actsUnder(tested, "actsToUndo").length ? reread(tested, "trial.first") : done();
          // Somewhere other than the cart, so only Core's own look can read it again.
          return send("elsewhere", node("elsewhere", "web.output.browser-navigate", { url: detail }));
        }
        case "elsewhere":
          // A changed revision, so the second test is a trial of its own rather than the first test's stored yes.
          return send("submit.second", call("submit.second", "core.submit_subflow", { flow: checkoutFlow(true) }));
        case "submit.second":
          if (!submitted("submit.second")) return done();
          return send("trial.second", call("trial.second", "core.test_subflow", candidate!));
        case "trial.second": {
          const tested = answers[previous]!;
          if (typeof tested.trialRunId !== "string" && actsUnder(tested, "actsToUndo").length) return reread(tested, "trial.second");
          return done();
        }
        default:
          return done();
      }
    };
    const provider = bindScriptedProvider(installed, { task: TASK, permitted: ["create_new"], instructionSourceId: build.instructionSourceId, maxIterations: 20, maxCallsPerRun: 30, builder });
    const { ending, failure } = await build.run();
    const outcomes = observed.outcomes;
    const looks = outcomes.map((outcome, index) => ({ outcome, index })).filter((entry) => entry.outcome.call.startsWith("site-reset.look."));
    const testCalls = Object.keys(outcomesAtTest);
    const looksBefore = Object.fromEntries(testCalls.map((callId, index) => [callId, looks.filter((look) => look.index >= outcomesAtTest[callId]! && (index + 1 >= testCalls.length || look.index < outcomesAtTest[testCalls[index + 1]!]!)).length]));
    const cartReads = reads.filter((read) => read.location?.includes("/everything-store/cart") === true);
    const ranFirst = tests.filter((entry) => entry.call.startsWith("trial.first")).map((entry) => entry.answer);
    const first = ranFirst.find((answer) => typeof answer.trialRunId === "string") ?? ranFirst.at(-1);
    const ranSecond = tests.filter((entry) => entry.call.startsWith("trial.second")).map((entry) => entry.answer);
    const second = ranSecond.find((answer) => typeof answer.trialRunId === "string") ?? ranSecond.at(-1);
    const trialAct = actsUnder(first, "leftOnSite").find((act) => act.call === undefined)?.act;
    const unsettleable = tests.flatMap((entry) => unsettleableIn(entry.answer));
    const summary = tests.map((entry) => ({
      call: entry.call,
      code: trialCode(entry.answer) ?? null,
      ran: typeof entry.answer.trialRunId === "string",
      buyNow: feedbackSteps(entry.answer).filter((step) => step.control === "Buy Now").map((step) => step.status),
      actsToUndo: actsUnder(entry.answer, "actsToUndo").map((act) => [act.act, act.call ?? null, act.settle ? (settleAddress(act.settle)?.includes("/cart") ? "settle_names_cart" : "settle") : "no_settle"]),
      startedWith: startedWithActs(entry.answer).map((act) => [act.act, act.call ?? null, act.did.includes(LEFT_UNCHANGED)]),
      unsettleable: unsettleableIn(entry.answer)
    }));
    const diagnostic = { ending, failure, builderStep: provider.builderSteps(), sent, destinationReference, baseline, trialAct, looksBefore, summary, clicks, answers, reads, declarations: observed.declarations, outcomes, receipts: provider.receipts, gatewayErrors: installed.gatewayErrors, pages };
    await keepDiagnostic(testInfo, "reset-office-navigating.json", diagnostic);
    console.log(JSON.stringify({ resetDiagnostic: { ending, failure, sent, codes: Object.fromEntries(sent.map((callId) => [callId, answers[callId]?.code ?? answers[callId]?.verdict ?? (answers[callId]?.ok === true ? "ok" : null)])), trialAct: trialAct ?? null, looksBefore, summary, cartReads: cartReads.map((read) => read.hash === baseline) } }));

    // The explored twin: the cart read complete, its ref issued, Buy Now declared create_new naming it, admitted and pressed once.
    expect(destinationReference).toMatch(/^destination-[1-9][0-9]{0,3}$/u);
    const buy = observed.declarations.find((declaration) => declaration.call === "buy");
    expect([buy?.consequences, buy?.permitted]).toEqual([["create_new"], true]);
    expect(clicks["buy"]?.after).toBe(clicks["buy"]!.before + 1);
    // The first trial ran and pressed Buy Now itself: a navigating lasting act it left on the site.
    expect(first?.trialRunId).toMatch(/^trial\./u);
    expect(feedbackSteps(first).some((step) => step.control === "Buy Now" && step.status === "succeeded")).toBe(true);
    expect(trialAct).toMatch(/^act-[1-9][0-9]{0,3}$/u);
    // No act of the build is ever one no call can settle.
    expect(unsettleable).toEqual([]);
    // The next trial is admitted: a trial of its own, starting with the trial act settled on Core's own look at the cart.
    expect(second?.trialRunId).toMatch(/^trial\./u);
    expect(second?.trialRunId).not.toBe(first?.trialRunId);
    expect(trialCode(second)).toBe("yes");
    const started = startedWithActs(second).find((act) => act.act === trialAct);
    expect(started?.did).toContain(LEFT_UNCHANGED);
    expect(looksBefore["trial.second"] ?? 0).toBeGreaterThanOrEqual(1);
    // No undo was ever pressed: after the explored press no call of the builder's or Core's clicked anything but a trial's own Buy Now.
    expect(outcomes.some((outcome) => outcome.call.startsWith("undo"))).toBe(false);
    // The cart: every read of it, the builder's and Core's own, shows it exactly as the build found it.
    expect(cartReads.length).toBeGreaterThanOrEqual(2);
    for (const read of cartReads) expect(read.hash).toBe(baseline);
    expect(ending).toBe("proposed");
  } finally {
    await build.stop();
    await installed.close();
  }
});
