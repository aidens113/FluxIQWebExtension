import type { JsonObject } from "fluxiq/core";
import { STORE_PATHS, TIDEWELL_KETTLES } from "../../../../scenario-lab/src/scenarios/everything-store/catalog/index.js";
import { expect, test } from "../../fixtures/extension-context";
import { actsUnder, bindInstrumentedRuntime, bindScriptedProvider, keepDiagnostic, openStoreDetail, pageHandle, pageHandleWhere, projectBuild, startInstalledBuild, startedWithActs, trialCode, type BuilderTurn, type ScriptedAnswer } from "../index";

const TASK = "Start a checkout for one product without the free trial.";
const SAGE = TIDEWELL_KETTLES.find(product => product.variant?.colour === "Sage Green" && product.variant.capacity === "1.7 L")!;
/** Checkout's upsell checkbox, ticked whenever the store opens a checkout session (`state/checkout-ops.ts`, `opened`). */
const PLUS = /^t\d+ checkbox "Yes, start my 30-day FREE .*Plus trial[^"]*" (?:un)?checked$/u;
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
const feedbackSteps = (tested: JsonObject | undefined) => (record(tested?.feedback).steps as JsonObject[] | undefined) ?? [];
/** The Plus checkbox's line in a page view, or none. */
const plusLine = (view: string) => view.split("\n").find(line => PLUS.test(line));

/**
 * Office rerun round 5 (`run-mvhibit5-e1d3a4f3`, cause 1, terminal): act-18
 * unticked the Plus trial checkbox, which checkout ticks by default; a later
 * Buy Now opened a fresh checkout session, and the site itself showed the box
 * ticked again -- the build's start state. Core's settlement still listed the
 * act under `actsToUndo` ("still shows the state this act set: press that same
 * control back"), because a toggle held only when the last press at its place
 * put it back; the press back was refused `candidate.undo_already_back`,
 * `no_call`. Every later trial was refused, nine times.
 *
 * t751 R2 (`t751-reset-by-observed-state.md`): an act is settled when fresh
 * reads of every witness show the baseline, whatever put it back. An undo aimed
 * at a control already at the baseline is answered from settlement: with a
 * fresh read the act is settled, listed nowhere, and the next trial is
 * admitted.
 *
 * The builder reads the cart complete (ref issued), presses Buy Now naming it,
 * unticks the Plus box on checkout (a toggle act), goes back and presses Buy
 * Now again naming the cart -- a fresh session, the box ticked again by the
 * store -- presses the box back under `undoes` naming the untick, then submits
 * the Buy Now subflow and tests it. The Buy Now presses settle on Core's own
 * look at the cart, which they never change (`office-buy-now.spec.ts`).
 */
test("installed gateway project build settles a toggle the site put back itself and admits the next trial", async ({ extensionSession }, testInfo) => {
  test.setTimeout(360_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const cart = new URL(STORE_PATHS.cart, installed.origin).href;
  const checkout = new URL(STORE_PATHS.checkout, installed.origin).href;
  const detail = new URL(STORE_PATHS.product(SAGE), installed.origin).href;
  const build = projectBuild(installed, "Installed reset office toggle", TASK);
  const pages: Record<string, string> = {};
  /** Each scripted call's own answer, by call id. */
  const answers: Record<string, JsonObject> = {};
  /** Clicks dispatched just before each scripted call and just after its answer. */
  const clicks: Record<string, { before: number; after?: number }> = {};
  /** The Plus box as each named moment's page view showed it. */
  const plusShown: Record<string, string | null> = {};
  const sent: string[] = [];
  const tests: JsonObject[] = [];
  let destinationReference = "", buyHandle = "", untickAct = "";
  let baseline: string | undefined;
  let plusCheckedAtEnd: boolean | undefined;
  try {
    await openStoreDetail(page, installed.origin, detail);
    await installed.pair();
    const observed = bindInstrumentedRuntime(installed);
    const { reads } = observed;
    let pending = "";
    const send = (callId: string, made: ScriptedAnswer) => {
      pending = callId;
      sent.push(callId);
      clicks[callId] = { before: observed.clicks() };
      return made;
    };
    const flow = [`flow: Checkout`, `step open: open the product`, `  node: web.browser-navigate`, `  url: ${JSON.stringify(detail)}`, `step buy: start the checkout`, `  node: web.dom.click`, `  target: BUY`, `  consequences: create_new`].join("\n");
    let candidate: { revision: number; digest: string } | undefined;
    let finished = false;
    const builder = (turn: BuilderTurn): ScriptedAnswer => {
      const { last, node, call } = turn;
      pages[`step-${turn.step}`] = turn.shownPage();
      const previous = pending;
      if (pending) {
        answers[pending] = record([...turn.evidence].reverse().find(entry => entry.callId === pending)?.value);
        clicks[pending]!.after = observed.clicks();
        plusShown[pending] = plusLine(turn.shownPage()) ?? null;
        if (pending.startsWith("trial.")) tests.push(answers[pending]!);
        pending = "";
      }
      const done = () => {
        finished = true;
        return turn.complete({ subflowKey: "main", ...(candidate ?? {}) });
      };
      // A later brief (the supervisor dispatching again after a refused ending) is not scripted: it completes at once.
      if (finished) return done();
      switch (previous) {
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
          buyHandle = pageHandle(turn.shownPage(), "Buy Now");
          return send("buy", node("buy", "web.output.dom-click", { target: { handle: buyHandle } }, ["create_new"], { resetDestination: destinationReference }));
        case "buy": {
          // Checkout opened with the Plus box ticked: untick it, a toggle act at the box's place.
          const box = pageHandleWhere(turn.shownPage(), PLUS);
          if (!box) throw new Error("diagnostic.plus_box_missing");
          return send("untick", node("untick", "web.output.dom-check", { target: { handle: box }, checked: false }, ["modify_existing"]));
        }
        case "untick":
          return send("detail.again", node("detail.again", "web.output.browser-navigate", { url: detail }));
        case "detail.again":
          // A second Buy Now naming the cart: the store opens a fresh checkout session, on its own preferences.
          return send("buy.again", node("buy.again", "web.output.dom-click", { target: { handle: pageHandle(turn.shownPage(), "Buy Now") } }, ["create_new"], { resetDestination: destinationReference }));
        case "buy.again": {
          // The box is back at its start, put there by the site. Pressed back under undoes naming the untick (the build's second act).
          const box = pageHandleWhere(turn.shownPage(), PLUS);
          if (!box) throw new Error("diagnostic.plus_box_missing");
          untickAct = "act-2";
          return send("undo.toggle", node("undo.toggle", "web.output.dom-check", { target: { handle: box }, checked: true }, ["modify_existing"], { undoes: untickAct }));
        }
        case "undo.toggle":
          return send("submit", call("submit", "core.submit_subflow", { flow: flow.replace("BUY", buyHandle) }));
        case "submit": {
          const submitted = answers["submit"];
          if (typeof submitted?.revision !== "number" || typeof submitted.digest !== "string") throw new Error("diagnostic.submission_refused");
          candidate = { revision: submitted.revision, digest: submitted.digest };
          return send("trial.first", call("trial.first", "core.test_subflow", candidate));
        }
        default:
          return done();
      }
    };
    const provider = bindScriptedProvider(installed, { task: TASK, permitted: ["create_new", "modify_existing"], instructionSourceId: build.instructionSourceId, maxIterations: 20, maxCallsPerRun: 30, builder });
    const { ending, failure } = await build.run();
    // The site as the build left it: a checkout session whose Plus box is ticked, as the store opens every session.
    await page.goto(checkout);
    plusCheckedAtEnd = await page.getByRole("checkbox", { name: /Plus trial/u }).isChecked().catch(() => undefined);
    const cartReads = reads.filter(read => read.location?.includes("/everything-store/cart") === true);
    const coded = (callId: string) => answers[callId]?.code ?? answers[callId]?.verdict ?? (answers[callId]?.ok === true ? "ok" : undefined);
    const diagnostic = { ending, failure, builderStep: provider.builderSteps(), sent, destinationReference, baseline, untickAct, plusShown, plusCheckedAtEnd, clicks, answers, tests, reads, declarations: observed.declarations, outcomes: observed.outcomes, receipts: provider.receipts, gatewayErrors: installed.gatewayErrors, pages };
    await keepDiagnostic(testInfo, "reset-office-toggle.json", diagnostic);
    console.log(JSON.stringify({ resetDiagnostic: { ending, failure, sent, codes: Object.fromEntries(sent.map(callId => [callId, coded(callId) ?? null])), undo: [answers["undo.toggle"]?.failed ?? null, answers["undo.toggle"]?.canMeet ?? null], actsToUndo: actsUnder(tests[0], "actsToUndo").map(act => [act.act, act.call ?? null]), plusShown: Object.fromEntries(Object.entries(plusShown).map(([call, line]) => [call, line === null ? null : line.endsWith(" unchecked") ? "unchecked" : "checked"])), plusCheckedAtEnd } }));

    // The cart is read complete, its ref issued; Buy Now named it, admitted and pressed once.
    expect(destinationReference).toMatch(/^destination-[1-9][0-9]{0,3}$/u);
    const buy = observed.declarations.find(declaration => declaration.call === "buy");
    expect([buy?.consequences, buy?.permitted]).toEqual([["create_new"], true]);
    expect(clicks["buy"]?.after).toBe(clicks["buy"]!.before + 1);
    // The untick: declared modify_existing with its box's place and state, admitted, and the page shows the box unticked.
    const untick = observed.declarations.find(declaration => declaration.call === "untick");
    expect([untick?.consequences, untick?.permitted]).toEqual([["modify_existing"], true]);
    expect(untick?.place).toMatch(/^[a-z]+:[a-f0-9]{16,}$/u);
    expect(untick?.state).toMatch(/^[a-z]+:[a-f0-9]{16,}$/u);
    expect(answers["untick"]?.ok).toBe(true);
    expect(plusShown["buy"]).toMatch(/ checked$/u);
    expect(plusShown["untick"]).toMatch(/ unchecked$/u);
    // The second Buy Now opened a fresh session: the site itself shows the box ticked again, the build's start state.
    expect(answers["buy.again"]?.ok).toBe(true);
    expect(plusShown["buy.again"]).toMatch(/ checked$/u);

    // The press back under undoes: answered already back, unrun, nothing clicked.
    const back = answers["undo.toggle"];
    expect(back?.ok).toBe(false);
    expect(back?.code).toBe("candidate.undo_already_back");
    expect(clicks["undo.toggle"]?.after).toBe(clicks["undo.toggle"]?.before);
    // A fresh read had already settled the untick restored, so the claim is answered before any admission (Core t751 R2,
    // `site-reset/undo-claims.ts`, met by no call): nothing is even asked, so no declaration reaches the permission wrapper.
    expect(back?.canMeet).toBe("no_call");
    expect(observed.declarations.filter(declaration => declaration.call === "undo.toggle")).toEqual([]);

    // The untick is settled by what the page shows: the test lists it nowhere to undo, and the trial is admitted.
    expect(tests).toHaveLength(1);
    expect(actsUnder(tests[0], "actsToUndo").filter(act => act.act === untickAct || act.call === "untick")).toEqual([]);
    expect(actsUnder(tests[0], "actsToUndo")).toEqual([]);
    expect(["candidate.trial_reset_required", "candidate.trial_reset_unproved"]).not.toContain(trialCode(tests[0]));
    expect(trialCode(tests[0])).toBe("yes");
    expect(tests[0]?.trialRunId).toMatch(/^trial\./u);
    expect(feedbackSteps(tests[0]).some(step => step.control === "Buy Now" && step.status === "succeeded")).toBe(true);
    // It did not start with the untick left either: settled, it is listed nowhere.
    expect(startedWithActs(tests[0]).some(act => act.act === untickAct || act.call === "untick")).toBe(false);
    expect(ending).toBe("proposed");
    // Final site state: the cart exactly as the build found it, and checkout's box ticked as the store opens it.
    expect(cartReads.length).toBeGreaterThanOrEqual(1);
    for (const read of cartReads) expect(read.hash).toBe(baseline);
    expect(plusCheckedAtEnd).toBe(true);
  } finally {
    await build.stop();
    await installed.close();
  }
});
