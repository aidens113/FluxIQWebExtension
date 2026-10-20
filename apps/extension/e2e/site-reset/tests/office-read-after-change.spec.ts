import type { JsonObject } from "fluxiq/core";
import { TIDEWELL_KETTLES, STORE_PATHS } from "../../../../scenario-lab/src/scenarios/everything-store/catalog/index.js";
import { expect, test } from "../../fixtures/extension-context";
import { bindInstrumentedRuntime, bindScriptedProvider, digest, keepDiagnostic, openStoreDetail, pageHandle, pageHandleWhere, projectBuild, startInstalledBuild, trialCode, type BuilderTurn, type ScriptedAnswer } from "../index";

const TASK = "Start a checkout for one product, deliver it to the other saved address, and read the delivery address.";
const SAGE = TIDEWELL_KETTLES.find(product => product.variant?.colour === "Sage Green" && product.variant.capacity === "1.7 L")!;
const CONFIRM = "Deliver to this address";
/** The read step's label in the submitted script, which trial feedback carries. */
const READ_STEP = "read the delivery address";
const EXTRACT = "web.dom.extract";
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
const feedbackSteps = (tested: JsonObject | undefined) => (record(tested?.feedback).steps as JsonObject[] | undefined) ?? [];
/** The first value under `key` anywhere in `value`, depth first, within a few levels. */
function findKey(value: unknown, key: string, depth = 6): unknown {
  if (depth < 0 || typeof value !== "object" || value === null) return undefined;
  if (!Array.isArray(value) && key in value) return (value as JsonObject)[key];
  for (const child of Object.values(value)) {
    const found = findKey(child, key, depth - 1);
    if (found !== undefined) return found;
  }
  return undefined;
}
/** A page-view text line's words: `tN "words"` -> words. */
const lineWords = (line: string) => JSON.parse(line.slice(line.indexOf(" ") + 1)) as string;

/** One `web.dom.extract` the gateway dispatched to the extension: the mark its target carried and what the page read. */
type DispatchedRead = { readsWords: unknown; status?: unknown; ok?: unknown; code?: unknown; extracted?: unknown };

/**
 * Office rerun round 4 (`run-mvgvyaip-d856e135`, 0052-0055): revision 3 chose
 * another saved delivery option and then read the line showing it, by a handle
 * captured while the line still showed the old words. The read's target carried
 * those words as its identity, and the page refused it four times
 * (`web.target.not_found`). t743 keeps a read target's words but marks them as
 * the value it reads (`readsWords`): the save-time guard counts them, and the
 * extension never vetoes a read target because its words changed.
 *
 * The builder reaches checkout (Buy Now), keeps the checkout page that shows
 * the original address line in its bare `<p>`, opens the chooser and picks the
 * other saved address in exploration, and never confirms there. It submits a
 * Flow that confirms the other address and then reads that address line by the
 * handle taken before the change, and tests it. The submission must be accepted
 * (not `web.handle.unidentifiable`), the read dispatched to the extension must
 * carry `readsWords`, and the trial's read must succeed with the new line.
 */
test("installed gateway project build reads a value its own earlier step changed, by a handle captured before the change", async ({ extensionSession }, testInfo) => {
  test.setTimeout(300_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const cart = new URL("/scenarios/everything-store/cart", installed.origin).href;
  const detail = new URL(STORE_PATHS.product(SAGE), installed.origin).href;
  const build = projectBuild(installed, "Installed office read after change", TASK);
  let destinationReference = "", buyHandle = "", changeHandle = "", radioHandle = "", confirmHandle = "", readHandle = "";
  let checkoutBefore = "", originalWords = "", chosenWords = "";
  const tests: JsonObject[] = [];
  const submissions: JsonObject[] = [];
  const answers: Array<{ step: number; toolId: unknown; ok: unknown; code: unknown; issues: unknown[] }> = [];
  const pages: Record<string, string> = {};
  const dispatchedReads: DispatchedRead[] = [];
  try {
    await openStoreDetail(page, installed.origin, detail);
    await installed.pair();
    // Every action the Core gateway sends the extension, by any caller (the builder or a trial): the reads are kept.
    const gateway = installed.fluxiq.programs.clientGateway as unknown as { executeAction: (...args: unknown[]) => { result: Promise<unknown> } };
    const dispatch = gateway.executeAction.bind(gateway);
    gateway.executeAction = (...args: unknown[]) => {
      const response = dispatch(...args);
      if (JSON.stringify(args[1] ?? null).includes(JSON.stringify(EXTRACT))) {
        const entry: DispatchedRead = { readsWords: findKey(args[1], "readsWords") ?? null };
        dispatchedReads.push(entry);
        void Promise.resolve(response.result).then(outcome => {
          entry.status = findKey(outcome, "status", 1) ?? null;
          entry.ok = findKey(outcome, "ok") ?? null;
          entry.code = findKey(outcome, "code") ?? null;
          entry.extracted = findKey(outcome, "extracted") ?? null;
        }, () => { entry.status = "rejected"; });
      }
      return response;
    };
    const observed = bindInstrumentedRuntime(installed);
    const flow = () => [`flow: Checkout`, `step open: open the product`, `  node: web.browser-navigate`, `  url: ${JSON.stringify(detail)}`,
      `step buy: start the checkout`, `  node: web.dom.click`, `  target: ${buyHandle}`, `  consequences: create_new`,
      `step chooser: open the address chooser`, `  node: web.dom.click`, `  target: ${changeHandle}`, `  consequences: none`,
      `step choose: choose the other saved address`, `  node: web.dom.click`, `  target: ${radioHandle}`, `  consequences: none`,
      `step confirm: confirm the chosen address`, `  node: web.dom.click`, `  target: ${confirmHandle}`, `  consequences: modify_existing`,
      `step read: ${READ_STEP}`, `  node: ${EXTRACT}`, `  target: ${readHandle}`, `  extract.mode: text`].join("\n");
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
        // Checkout, before anything changed: the delivery address line still shows the address it opened on.
        checkoutBefore = turn.shownPage();
        changeHandle = pageHandle(checkoutBefore, "Change");
        return node("chooser", "web.output.dom-click", { target: { handle: changeHandle } });
      }
      if (turn.step === 5) {
        const shown = turn.shownPage();
        const checked = shown.split("\n").find(line => /^t\d+ radio "[^"]*" checked$/u.test(line));
        const other = pageHandleWhere(shown, /^t\d+ radio "[^"]*" unchecked$/u);
        if (!checked || !other) throw new Error("diagnostic.address_radios_missing");
        radioHandle = other;
        originalWords = JSON.parse(checked.slice(checked.indexOf(" radio ") + 7).replace(/ checked$/u, "")) as string;
        const otherLine = shown.split("\n").find(line => line.startsWith(`${other} radio `))!;
        chosenWords = JSON.parse(otherLine.slice(`${other} radio `.length).replace(/ unchecked$/u, "")) as string;
        // The handle of the element that showed the original address on the checkout page captured before the change.
        const before = checkoutBefore.split("\n").find(line => /^t\d+ "/u.test(line) && lineWords(line) === originalWords);
        if (!before) throw new Error("diagnostic.original_address_line_missing");
        readHandle = before.split(" ")[0]!;
        return node("choose", "web.output.dom-click", { target: { handle: radioHandle } });
      }
      if (turn.step === 6) {
        confirmHandle = pageHandle(turn.shownPage(), CONFIRM);
        return call("submit", "core.submit_subflow", { flow: flow() });
      }
      const submitted = record(last("core.submit_subflow"));
      if (turn.step === 7) {
        submissions.push(submitted);
        if (typeof submitted.revision !== "number" || typeof submitted.digest !== "string") throw new Error("diagnostic.submission_refused");
        return call("trial", "core.test_subflow", { revision: submitted.revision, digest: submitted.digest });
      }
      tests.push(record(last("core.test_subflow")));
      return turn.complete({ subflowKey: "main", revision: submitted.revision ?? null, digest: submitted.digest ?? null });
    };
    const builder = async (turn: BuilderTurn) => {
      const previous = [...turn.evidence].reverse().find(entry => entry.toolId.startsWith("core.") && !["core.budget", "core.route_state", "core.evidence_history"].includes(entry.toolId));
      const issues = Array.isArray(previous?.value.issues) ? (previous.value.issues as unknown[]).map(issue => record(issue).code ?? null) : [];
      answers.push({ step: turn.step, toolId: previous?.toolId ?? null, ok: previous?.value.ok ?? null, code: previous?.value.code ?? null, issues });
      try {
        return await script(turn);
      } catch (error) {
        answers.push({ step: turn.step, toolId: "script.error", ok: false, code: error instanceof Error ? error.message : "unknown", issues: [] });
        throw error;
      }
    };
    const provider = bindScriptedProvider(installed, { task: TASK, permitted: ["create_new", "modify_existing"], instructionSourceId: build.instructionSourceId, maxIterations: 12, maxCallsPerRun: 20, builder });
    const { ending, failure } = await build.run();
    // A dispatched read's answer may land a moment after the build saw it.
    await expect.poll(() => dispatchedReads.every(entry => entry.status !== undefined), { timeout: 5_000 }).toBe(true);
    const tested = tests[0];
    const readFeedback = feedbackSteps(tested).find(step => step.label === READ_STEP);
    const submissionIssues = submissions.flatMap(submitted => Array.isArray(submitted.issues) ? (submitted.issues as unknown[]).map(issue => record(issue).code ?? null) : []);
    const readsShown = dispatchedReads.map(entry => ({ readsWords: entry.readsWords, status: entry.status, ok: entry.ok, code: entry.code,
      extractedIs: entry.extracted === chosenWords ? "chosen" : entry.extracted === originalWords ? "original" : entry.extracted === null ? "none" : `other:${digest(entry.extracted)}` }));
    await keepDiagnostic(testInfo, "office-read-after-change.json", { ending, failure, destinationReference, handles: { buyHandle, changeHandle, radioHandle, confirmHandle, readHandle },
      submissions, tests, answers, dispatchedReads: readsShown, outcomes: observed.outcomes, builderStep: provider.builderSteps(), receipts: provider.receipts, gatewayErrors: installed.gatewayErrors, pages });
    console.log(JSON.stringify({ resetDiagnostic: { ending, failure, submissionIssues, trial: tests.map(trialCode), readStep: readFeedback?.status ?? null, readsShown } }));

    expect(ending).toBe("proposed");
    expect(originalWords).not.toBe("");
    expect(chosenWords).not.toBe(originalWords);
    // The checkout captured before the change showed the original address line at the read's handle.
    expect(checkoutBefore.split("\n").some(line => line.startsWith(`${readHandle} `) && lineWords(line) === originalWords)).toBe(true);
    // The submission was accepted: the bare address line's words count toward its identity.
    expect(submissionIssues).not.toContain("web.handle.unidentifiable");
    expect(submissions[0]?.revision).toBe(1);
    // The trial ran and its read step succeeded.
    expect(tests).toHaveLength(1);
    expect(trialCode(tested)).toBe("yes");
    expect(readFeedback?.status).toBe("succeeded");
    // Every read the gateway sent the extension carried the mark, and the trial's read returned the new line, not the old one.
    expect(dispatchedReads.length).toBeGreaterThanOrEqual(1);
    for (const entry of dispatchedReads) expect(entry.readsWords).toBe(true);
    expect(dispatchedReads.at(-1)?.extracted).toBe(chosenWords);
    expect(dispatchedReads.some(entry => entry.extracted === originalWords)).toBe(false);
  } finally {
    await build.stop();
    await installed.close();
  }
});
