import type { JsonObject } from "fluxiq/core";
import { STORE_PATHS, TIDEWELL_KETTLES } from "../../../../scenario-lab/src/scenarios/everything-store/catalog/index.js";
import { expect, test } from "../../fixtures/extension-context";
import { judgeLog, retiredCodesIn } from "../change-proof";
import { actsUnder, bindInstrumentedRuntime, bindScriptedProvider, keepDiagnostic, openStoreDetail, pageHandle, pageHandleWhere, projectBuild, startInstalledBuild, trialCode, type BuilderTurn, type ScriptedAnswer } from "../index";

const TASK = "Start a checkout for one product and deliver it to the other saved address.";
const SAGE = TIDEWELL_KETTLES.find(product => product.variant?.colour === "Sage Green" && product.variant.capacity === "1.7 L")!;
/** The checkout's confirm control: it saves the chosen address and the page reloads showing it. */
const CONFIRM = "Deliver to this address";
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
/** An act a gate could not settle by any call, as Core named it. */
const unsettleable = (answer: JsonObject | undefined) => (Array.isArray(answer?.actsUnsettleable) ? answer.actsUnsettleable : []).map(record).map(entry => ({ act: String(entry.act ?? ""), reason: entry.reason ?? null, failed: entry.failed ?? null }));
const toUndo = (answer: JsonObject | undefined) => actsUnder(answer, "actsToUndo").map(entry => entry.act).sort();
/** Every code Core's refusals and issues carry, so no answer is read by its prose. */
const codes = (answer: JsonObject | undefined) => [answer?.code, answer?.failed, ...(Array.isArray(answer?.issues) ? answer.issues.map(issue => record(issue).code) : [])].filter(code => typeof code === "string");
/** The settlement a call answered for the act it named under undoes: the act still open, or the act settled. */
const settlementOf = (answer: JsonObject | undefined) => record(answer?.resetSettlement);
const stillOpen = (answer: JsonObject | undefined) => (Array.isArray(settlementOf(answer).actsStillOpen) ? settlementOf(answer).actsStillOpen as unknown[] : []).map(entry => record(entry).act);
const REFUSED_FOR_NO_READ = ["no_destination_read_before", "no_item_identity"];

/**
 * Office reloading confirm (`run-mvrj7qg8-6916b3f7`, "Each reset refusal",
 * cause 1): the build chose the other saved address on checkout and pressed
 * the confirm control (declared modify_existing); the page reloads to the same
 * address, so the act sits in no list. Its value witness is the chosen address.
 * Under `undoes` naming that act: a look at an unrelated list (the cart) must
 * not settle it while the other address still shows; opening the chooser and
 * choosing the original option (declaring nothing) is admitted as a step;
 * pressing the confirm declaring modify_existing is admitted `own`; and a fresh
 * read settles the act restored, never listing it unsettleable and never
 * refusing with no_destination_read_before or no_item_identity.
 */
test("installed gateway project build settles a reloading confirm by its value once the original choice is confirmed back", async ({ extensionSession }, testInfo) => {
  test.setTimeout(420_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const cart = new URL(STORE_PATHS.cart, installed.origin).href;
  const checkout = new URL("/scenarios/everything-store/checkout", installed.origin).href;
  const detail = new URL(STORE_PATHS.product(SAGE), installed.origin).href;
  const build = projectBuild(installed, "Installed reset office reloading confirm", TASK, () => installed.page.url());
  const pages: Record<string, string> = {};
  const answers: Record<string, JsonObject> = {};
  const judge = judgeLog();
  let destinationReference = "", buyHandle = "", changeHandle = "", confirmHandle = "";
  /** Core numbers every admitted press in order: Buy Now act-1, the chooser act-2, the radio act-3, the confirm act-4. */
  const CONFIRM_ACT = "act-4";
  try {
    await openStoreDetail(page, installed.origin, detail);
    await installed.pair();
    const observed = bindInstrumentedRuntime(installed);
    let pending = "";
    const send = (callId: string, made: ScriptedAnswer) => {
      pending = callId;
      return made;
    };
    const flow = () => [`flow: Checkout`, `step open: open the product`, `  node: web.browser-navigate`, `  url: ${JSON.stringify(detail)}`,
      `step buy: start the checkout`, `  node: web.dom.click`, `  target: ${buyHandle}`, `  consequences: create_new`].join("\n");
    const candidate = () => {
      const submitted = answers["submit"];
      if (typeof submitted?.revision !== "number" || typeof submitted.digest !== "string") throw new Error("diagnostic.submission_refused");
      return { revision: submitted.revision, digest: submitted.digest };
    };
    const queue: Array<(turn: BuilderTurn) => ScriptedAnswer> = [];
    queue.push(turn => send("detail", turn.node("detail", "web.output.browser-navigate", { url: detail })));
    queue.push(turn => {
      buyHandle = pageHandle(turn.shownPage(), "Buy Now");
      return send("buy", turn.node("buy", "web.output.dom-click", { target: { handle: buyHandle } }, ["create_new"], { resetDestination: destinationReference }));
    });
    queue.push(turn => {
      changeHandle = pageHandle(turn.shownPage(), "Change");
      return send("chooser", turn.node("chooser", "web.output.dom-click", { target: { handle: changeHandle } }));
    });
    queue.push(turn => {
      const found = pageHandleWhere(turn.shownPage(), /^t\d+ radio "[^"]*" unchecked$/u);
      if (!found) throw new Error("diagnostic.other_address_missing");
      return send("choose", turn.node("choose", "web.output.dom-click", { target: { handle: found } }));
    });
    // The explored confirm: declared modify_existing; the page reloads to the chosen address.
    queue.push(turn => {
      confirmHandle = pageHandle(turn.shownPage(), CONFIRM);
      return send("confirm", turn.node("confirm", "web.output.dom-click", { target: { handle: confirmHandle } }, ["modify_existing"]));
    });
    // A look naming an unrelated list (the cart) for the confirm act, while the other address still shows.
    queue.push(turn => send("look.cart", turn.node("look.cart", "web.output.browser-navigate", { url: cart }, [], { undoes: CONFIRM_ACT })));
    // The undo runs before any trial, while the confirm is still open: the build opens the checkout (an address its page views showed) to see its controls.
    queue.push(turn => send("back.checkout", turn.node("back.checkout", "web.output.browser-navigate", { url: checkout })));
    queue.push(turn => {
      changeHandle = pageHandle(turn.shownPage(), "Change");
      return send("undo.chooser", turn.node("undo.chooser", "web.output.dom-click", { target: { handle: changeHandle } }, [], { undoes: CONFIRM_ACT }));
    });
    queue.push(turn => {
      const original = pageHandleWhere(turn.shownPage(), /^t\d+ radio "[^"]*" unchecked$/u);
      if (!original) throw new Error("diagnostic.original_address_missing");
      return send("undo.choose", turn.node("undo.choose", "web.output.dom-click", { target: { handle: original } }, [], { undoes: CONFIRM_ACT }));
    });
    queue.push(turn => send("undo.confirm", turn.node("undo.confirm", "web.output.dom-click", { target: { handle: pageHandle(turn.shownPage(), CONFIRM) } }, ["modify_existing"], { undoes: CONFIRM_ACT })));
    queue.push(turn => send("submit", turn.call("submit", "core.submit_subflow", { flow: flow() })));
    queue.push(turn => send("trial.open", turn.call("trial.open", "core.test_subflow", candidate())));
    queue.push(turn => send("trial.settled", turn.call("trial.settled", "core.test_subflow", candidate())));
    const builder = (turn: BuilderTurn) => {
      pages[`step-${turn.step}`] = turn.shownPage();
      if (pending) {
        answers[pending] = record([...turn.evidence].reverse().find(entry => entry.callId === pending)?.value);
        pending = "";
      }
      if (turn.step === 1) return send("original", turn.node("original", "web.output.browser-navigate", { url: cart }));
      if (turn.step === 2) {
        const reference = (record(turn.last("core.run_node")?.resetDestinations).collections as JsonObject[] | undefined)?.[0]?.ref;
        if (typeof reference !== "string") throw new Error("diagnostic.original_destination_ref_missing");
        destinationReference = reference;
      }
      const next = queue.shift();
      if (next) return next(turn);
      return turn.complete({ subflowKey: "main", ...(answers["submit"] ? candidate() : {}) });
    };
    const provider = bindScriptedProvider(installed, { task: TASK, permitted: ["create_new", "modify_existing"], instructionSourceId: build.instructionSourceId, maxIterations: 30, maxCallsPerRun: 40, builder, verify: judge.verify });
    const { ending, failure } = await build.run();
    const summary = Object.fromEntries(Object.entries(answers).map(([id, answer]) => [id, { ok: answer.ok ?? null, code: answer.code ?? answer.verdict ?? null, codes: codes(answer), admission: answer.admission ?? answer.kind ?? null, toUndo: toUndo(answer), unsettleable: unsettleable(answer), settlement: answer.resetSettlement ?? null }]));
    await keepDiagnostic(testInfo, "reset-office-reloading-confirm.json", { ending, failure, builderStep: provider.builderSteps(), destinationReference, answers, reads: observed.reads, declarations: observed.declarations, outcomes: observed.outcomes, receipts: provider.receipts, gatewayErrors: installed.gatewayErrors, pages });
    console.log(JSON.stringify({ resetDiagnostic: { ending, failure, summary } }));

    // The explored press: Buy Now (act-1) and the confirm (act-4, modify_existing) were admitted and ran.
    expect(destinationReference).toMatch(/^destination-[1-9][0-9]{0,3}$/u);
    expect(answers["buy"]?.ok).toBe(true);
    expect(answers["confirm"]?.ok).toBe(true);
    expect(observed.declarations.find(declaration => declaration.call === "confirm")?.consequences).toEqual(["modify_existing"]);
    for (const call of ["chooser", "choose"]) expect(observed.declarations.filter(declaration => declaration.call === call).every(declaration => Array.isArray(declaration.consequences) && declaration.consequences.length === 0)).toBe(true);

    // The look at the unrelated cart was admitted but did not settle the act: it stays open while the other address shows.
    expect(answers["look.cart"]?.ok).toBe(true);
    expect(settlementOf(answers["look.cart"]).settled).toBeUndefined();
    expect(settlementOf(answers["look.cart"]).open).toBe(CONFIRM_ACT);
    expect(stillOpen(answers["look.cart"])).toEqual([CONFIRM_ACT]);

    // The undo steps run before any trial, while the confirm is still the open act (t775: a trial opens a fresh checkout and would read it already back).
    // The undo steps: the chooser and the original option declare nothing and are admitted as steps; the confirm is admitted own.
    for (const call of ["undo.chooser", "undo.choose", "undo.confirm"]) {
      expect(answers[call]?.ok).toBe(true);
      expect(codes(answers[call]).filter(code => REFUSED_FOR_NO_READ.includes(code))).toEqual([]);
      expect(observed.declarations.find(declaration => declaration.call === call)?.permitted).toBe(true);
    }
    for (const call of ["undo.chooser", "undo.choose"]) expect(observed.declarations.find(declaration => declaration.call === call)?.consequences).toEqual([]);
    expect(observed.declarations.find(declaration => declaration.call === "undo.confirm")?.consequences).toEqual(["modify_existing"]);

    // Each step of the way back leaves the act open, until the own confirm lands and the fresh read after it settles it.
    for (const call of ["undo.chooser", "undo.choose"]) {
      expect(settlementOf(answers[call]).settled).toBeUndefined();
      // The trial above ran its own Buy Now, which may stand beside the confirm, so this names the confirm and no longer the whole list.
      expect(stillOpen(answers[call])).toContain(CONFIRM_ACT);
    }
    expect(settlementOf(answers["undo.confirm"]).settled).toBe(CONFIRM_ACT);
    expect(stillOpen(answers["undo.confirm"])).not.toContain(CONFIRM_ACT);

    // The trial runs after the undo: it is not refused, no retired code appears, and its post-trial state settles the act as already back.
    const open = answers["trial.open"];
    expect(trialCode(open)).toBe("yes");
    expect(unsettleable(open).map(entry => entry.act)).not.toContain(CONFIRM_ACT);
    expect(retiredCodesIn(answers, observed.outcomes, provider.receipts)).toEqual([]);
    // A fresh read settles the act restored: it leaves actsToUndo, is never unsettleable, and no refusal says a read or an identity was missing.
    const settled = answers["trial.settled"];
    expect(toUndo(settled)).not.toContain(CONFIRM_ACT);
    expect(unsettleable(settled).map(entry => entry.act)).not.toContain(CONFIRM_ACT);
    expect(unsettleable(settled)).toEqual([]);
    for (const answer of Object.values(answers)) expect(codes(answer).filter(code => REFUSED_FOR_NO_READ.includes(code))).toEqual([]);
    expect(trialCode(settled)).toBe("yes");
    expect(ending).toBe("proposed");
  } finally {
    await build.stop();
    await installed.close();
  }
});
