import type { JsonObject } from "fluxiq/core";
import { STORE_PATHS, TIDEWELL_KETTLES } from "../../../../scenario-lab/src/scenarios/everything-store/catalog/index.js";
import { expect, test } from "../../fixtures/extension-context";
import { judgeLog, retiredCodesIn } from "../change-proof";
import { bindInstrumentedRuntime, bindScriptedProvider, keepDiagnostic, openStoreDetail, pageHandle, pageHandleWhere, projectBuild, startInstalledBuild, startedWithActs, trialCode, type BuilderTurn, type ScriptedAnswer } from "../index";

const TASK = "Start a checkout for one product and deliver it to the other saved address.";
const SAGE = TIDEWELL_KETTLES.find(product => product.variant?.colour === "Sage Green" && product.variant.capacity === "1.7 L")!;
/** The checkout's confirm control, which saves the chosen address and reloads; no list on any page shows its effect. */
const CONFIRM = "Deliver to this address";
/** The confirm step's label in the submitted script, which trial feedback and the act's words carry. */
const CONFIRM_STEP = "confirm the chosen address";
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
const feedbackSteps = (tested: JsonObject | undefined) => (record(tested?.feedback).steps as JsonObject[] | undefined) ?? [];

/**
 * Office shape r3 (`run-mvgo5xft-25460ba2`, act-12/15/18): a trial step that
 * confirms a choice on checkout, declared modify_existing, sits in no list --
 * no read the build issued shows its effect. Before t741 A1 each such trial
 * act needed its own model look naming a list under `undoes`, or the next
 * trial was refused `candidate.trial_reset_required`. Now a trial act with no
 * witness adopts the build's issued lists, and Core's own pre-trial look
 * settles it `unchanged` when they all hold.
 *
 * The builder reads the cart complete (its ref issued), presses Buy Now with
 * that ref, opens the address chooser and picks the other saved address in
 * exploration (both declared none: the chooser and the radio change nothing
 * until confirmed), and never presses the confirm in exploration, as office r3
 * did not. It submits the subflow that ends on the confirm press and tests it,
 * goes elsewhere so only Core's own look can read the cart, and tests a
 * changed second revision (a revision already judged yes answers from the
 * stored yes, so the second test must change a step to run as a trial). It
 * never names an act under `undoes`.
 */
test("installed gateway project build settles a trial confirm on no list by Core's own look before the next trial", async ({ extensionSession }, testInfo) => {
  test.setTimeout(360_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const cart = new URL("/scenarios/everything-store/cart", installed.origin).href;
  const detail = new URL(STORE_PATHS.product(SAGE), installed.origin).href;
  const build = projectBuild(installed, "Installed reset office r3", TASK, () => installed.page.url());
  let destinationReference = "", buyHandle = "", changeHandle = "", radioHandle = "", radioLabel = "", confirmHandle = "";
  const tests: JsonObject[] = [];
  const judge = judgeLog();
  const revisions: number[] = [];
  const outcomesAtTest: number[] = [];
  const readsAtTest: number[] = [];
  const pages: Record<string, string> = {};
  /** Every builder decision's `undoes` and `resetDestination`, as sent. */
  const sent: Array<{ step: number; callId: unknown; undoes: unknown; resetDestination: unknown }> = [];
  /** What each builder turn had just been answered. */
  const answers: Array<{ step: number; toolId: unknown; ok: unknown; code: unknown; issues: unknown[] }> = [];
  /** A refused submission's answer, as Core gave it (the script is built from Lab fixture handles only). */
  const refusals: JsonObject[] = [];
  try {
    await openStoreDetail(page, installed.origin, detail);
    await installed.pair();
    const observed = bindInstrumentedRuntime(installed);
    const { reads } = observed;
    const checkoutFlow = (looksAtEnd: boolean) => [`flow: Checkout`, `step open: open the product`, `  node: web.browser-navigate`, `  url: ${JSON.stringify(detail)}`,
      `step buy: start the checkout`, `  node: web.dom.click`, `  target: ${buyHandle}`, `  consequences: create_new`,
      `step chooser: open the address chooser`, `  node: web.dom.click`, `  target: ${changeHandle}`, `  consequences: none`,
      `step choose: choose the other saved address`, `  node: web.dom.click`, `  target: ${radioHandle}`, `  consequences: none`,
      `step confirm: ${CONFIRM_STEP}`, `  node: web.dom.click`, `  target: ${confirmHandle}`, `  consequences: modify_existing`,
      ...(looksAtEnd ? [`step check: look at the checkout page`, `  node: web.dom.capture_snapshot`] : [])].join("\n");
    const script = (turn: BuilderTurn): ScriptedAnswer => {
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
        // The first "Change" on checkout is the delivery address's.
        changeHandle = pageHandle(turn.shownPage(), "Change");
        return node("chooser", "web.output.dom-click", { target: { handle: changeHandle } });
      }
      if (turn.step === 5) {
        // The saved address the checkout did not open on: the chooser's radio shown unchecked (delivery's radios carry a group).
        const found = pageHandleWhere(turn.shownPage(), /^t\d+ radio "[^"]*" unchecked$/u);
        if (!found) throw new Error("diagnostic.other_address_missing");
        radioHandle = found;
        radioLabel = turn.shownPage().split("\n").find(line => line.startsWith(`${found} radio `))!.slice(`${found} radio `.length).replace(/ unchecked$/u, "");
        return node("choose", "web.output.dom-click", { target: { handle: radioHandle } });
      }
      if (turn.step === 6) {
        confirmHandle = pageHandle(turn.shownPage(), CONFIRM);
        return call("submit", "core.submit_subflow", { flow: checkoutFlow(false) });
      }
      const submitted = last("core.submit_subflow");
      if (typeof submitted?.revision !== "number" || typeof submitted.digest !== "string") {
        refusals.push(submitted ?? {});
        throw new Error("diagnostic.submission_refused");
      }
      const candidate = { revision: submitted.revision, digest: submitted.digest };
      if (turn.step === 7 || turn.step === 10) {
        revisions.push(candidate.revision);
        outcomesAtTest.push(observed.outcomes.length);
        readsAtTest.push(reads.length);
        return call(turn.step === 7 ? "trial.first" : "trial.second", "core.test_subflow", candidate);
      }
      if (turn.step === 8) {
        tests.push(record(last("core.test_subflow")));
        // Somewhere other than the cart, so only Core's own look can read it again.
        return node("elsewhere", "web.output.browser-navigate", { url: detail });
      }
      if (turn.step === 9) return call("submit.second", "core.submit_subflow", { flow: checkoutFlow(true) });
      if (turn.step === 11) tests.push(record(last("core.test_subflow")));
      return turn.complete({ subflowKey: "main", ...candidate });
    };
    const builder = async (turn: BuilderTurn) => {
      // What the turn was answered, by code and issue codes only, so a refused step is diagnosable.
      const previous = [...turn.evidence].reverse().find(entry => entry.toolId.startsWith("core.") && !["core.budget", "core.route_state", "core.evidence_history"].includes(entry.toolId));
      const issues = Array.isArray(previous?.value.issues) ? (previous.value.issues as unknown[]).map(issue => record(issue).code ?? null) : [];
      answers.push({ step: turn.step, toolId: previous?.toolId ?? null, ok: previous?.value.ok ?? null, code: previous?.value.code ?? null, issues });
      let answered: ScriptedAnswer;
      try {
        answered = await script(turn);
      } catch (error) {
        answers.push({ step: turn.step, toolId: "script.error", ok: false, code: error instanceof Error ? error.message : "unknown", issues: [] });
        throw error;
      }
      const decision = record(answered.response.decision);
      const input = record(decision.input);
      sent.push({ step: turn.step, callId: decision.callId ?? null, undoes: input.undoes ?? null, resetDestination: input.resetDestination ?? null });
      return answered;
    };
    const provider = bindScriptedProvider(installed, { task: TASK, permitted: ["create_new", "modify_existing"], instructionSourceId: build.instructionSourceId, maxIterations: 20, maxCallsPerRun: 30, builder, verify: judge.verify });
    const { ending, failure } = await build.run();
    const outcomes = observed.outcomes;
    const siteChanges = judge.siteChanges();
    const lookDeclarations = observed.declarations.filter(declaration => declaration.call.startsWith("site-reset."));
    const started = tests.map(tested => startedWithActs(tested));
    await keepDiagnostic(testInfo, "reset-office-r3.json", { ending, failure, destinationReference, tests, revisions, siteChanges, readsAtTest, started, sent, answers, refusals, outcomes, reads, declarations: observed.declarations, builderStep: provider.builderSteps(), receipts: provider.receipts, gatewayErrors: installed.gatewayErrors, pages });
    console.log(JSON.stringify({ resetDiagnostic: { ending, failure, tests: tests.map(trialCode), revisions, siteChanges, started, undoesSent: sent.filter(entry => entry.undoes !== null).length } }));

    expect(ending).toBe("proposed");
    expect(destinationReference).toMatch(/^destination-[1-9][0-9]{0,3}$/u);
    // The builder never named an act under `undoes`: every settlement is Core's own.
    expect(sent.filter(entry => entry.undoes !== null)).toEqual([]);
    // Core's own looks only navigate, declaring nothing lasting.
    for (const declaration of lookDeclarations) expect(declaration.consequences).toEqual([]);
    // The exploration declared only Buy Now as lasting; the chooser and the radio declared nothing.
    expect(observed.declarations.find(declaration => declaration.call === "buy")?.consequences).toEqual(["create_new"]);
    for (const call of ["chooser", "choose"]) expect(observed.declarations.filter(declaration => declaration.call === call).every(declaration => Array.isArray(declaration.consequences) && declaration.consequences.length === 0)).toBe(true);
    // Both tests ran as trials of their own -- the second was not refused `candidate.trial_reset_required`.
    expect(tests).toHaveLength(2);
    expect(tests.map(trialCode)).toEqual(["yes", "yes"]);
    expect(revisions).toEqual([1, 2]);
    expect(new Set(tests.map(tested => tested.trialRunId)).size).toBe(2);
    for (const tested of tests) {
      expect(tested.trialRunId).toMatch(/^trial\./u);
      expect(feedbackSteps(tested).find(step => step.label === CONFIRM_STEP)?.status).toBe("succeeded");
      // The confirm press reloads the page and still names its control (t748). Its words were dropped by Core's
      // model-facing screen, which refuses the word "address" in a control's own words, not by the reload.
      expect(feedbackSteps(tested).find(step => step.label === CONFIRM_STEP)?.control).toBe(CONFIRM);
      // The confirm took effect: the page the trial left shows the chosen address as checkout's own line, the chooser closed.
      const after = String(record(tested.pageAfterTrial).page ?? "").split("\n");
      expect(radioLabel).toMatch(/^".+"$/u);
      expect(after.some(line => /^t\d+ "/u.test(line) && line.slice(line.indexOf(" ") + 1) === radioLabel)).toBe(true);
      expect(after.some(line => /^t\d+ radio "[^"]*" (?:un)?checked$/u.test(line))).toBe(false);
    }
    // t775: no retired reset code anywhere in the step log, and each trial's judge request carries the site's change. The
    // confirm sits in no list, so it is judged by what the trial left on the page, not by a settle-unchanged look.
    expect(retiredCodesIn(tests, outcomes, observed.declarations, provider.receipts, failure)).toEqual([]);
    expect(siteChanges).toHaveLength(2);
    for (const siteChange of siteChanges) expect(siteChange).toBeDefined();
    // The first trial started with only the explored Buy Now in place; the second also with the first trial's acts, all
    // reported to the judge as left from earlier instead of refusing the trial.
    expect(started[0]!.map(act => act.call)).toEqual(["buy"]);
    const left = siteChanges.map(siteChange => (Array.isArray(siteChange?.leftFromEarlier) ? siteChange.leftFromEarlier.length : 0));
    expect(left[0]).toBeGreaterThanOrEqual(1);
    expect(left[1]).toBeGreaterThan(left[0]!);
  } finally {
    await build.stop();
    await installed.close();
  }
});
