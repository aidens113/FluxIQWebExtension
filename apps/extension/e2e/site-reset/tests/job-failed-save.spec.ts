import type { JsonObject } from "fluxiq/core";
import { postingById } from "../../../../scenario-lab/src/scenarios/job-board/catalog/index.js";
import { viewJobHref } from "../../../../scenario-lab/src/scenarios/job-board/board/index.js";
import { expect, test } from "../../fixtures/extension-context";
import { actsUnder, bindInstrumentedRuntime, keepDiagnostic, bindScriptedProvider, pageHandleWhere, projectBuild, rowControl, rowTitles, startInstalledBuild, trialCode, type BuilderTurn } from "../index";

const TASK = "Save one job to my saved jobs.";
/** A job nobody saved: the build presses its heart, and the board's first save of a page load fails. */
const TARGET = postingById("g1");
/** A job already on the saved list when the build began (`job-board/state.ts`, `ALREADY_SAVED`). */
const HELD = postingById("hv2");
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};

/**
 * Job shapes D and F (job r1/r2): My jobs is a plain list the domain vouches
 * complete by its own continuation detectors, so its read issues a ref. A save
 * the board itself fails has no list of its own; the trial is refused saying
 * to name that ref, an undo aimed at a job saved before the build is refused
 * unrun, and a look naming the ref under `undoes` settles the press.
 */
test("installed gateway project build settles a site-failed save on a plain list's ref and never touches a job saved before it", async ({ extensionSession }, testInfo) => {
  test.setTimeout(240_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const myJobs = new URL("/scenarios/job-board/myjobs", installed.origin).href;
  const viewJob = new URL(viewJobHref(TARGET), installed.origin).href;
  const build = projectBuild(installed, "Installed reset job", TASK);
  const pages: Record<string, string> = {};
  let destinationReference = "", heartHandle = "", saveAct = "", heldTitle = "";
  let baseline: string | undefined, baselineTitles: string[] = [];
  let clicksBeforeSave = 0, clicksAfterSave = 0, clicksBeforeWrong = 0, clicksAfterWrong = 0;
  let wrong: JsonObject = {}, settlingLook: JsonObject = {};
  const tests: JsonObject[] = [];
  try {
    await page.goto(new URL("/scenarios/job-board/", installed.origin).href);
    await page.getByRole("button", { name: "Accept all", exact: true }).click();
    await page.locator("rf-assistant .fa-min").waitFor({ timeout: 9000 });
    await page.locator("rf-assistant .fa-min").click();
    await page.goto(viewJob);
    await installed.pair();
    const observed = bindInstrumentedRuntime(installed);
    const { reads } = observed;
    const builder = (turn: BuilderTurn) => {
      const { last, node, call } = turn;
      pages[`step-${turn.step}`] = turn.shownPage();
      if (turn.step === 1) return node("saved.original", "web.output.browser-navigate", { url: myJobs });
      if (turn.step === 2) {
        baseline = reads.at(-1)?.hash;
        baselineTitles = rowTitles(turn.shownPage());
        const destinations = record(last("core.run_node")?.resetDestinations).collections as JsonObject[] | undefined;
        const reference = destinations?.[0]?.ref;
        if (typeof reference !== "string") throw new Error("diagnostic.plain_list_ref_missing");
        destinationReference = reference;
        return node("job", "web.output.browser-navigate", { url: viewJob });
      }
      if (turn.step === 3) {
        const found = pageHandleWhere(turn.shownPage(), /\bicon\b/u);
        if (!found) throw new Error("diagnostic.heart_missing");
        heartHandle = found;
        clicksBeforeSave = observed.clicks();
        return node("save", "web.output.dom-click", { target: { handle: heartHandle } }, ["modify_existing"]);
      }
      if (turn.step === 4) {
        clicksAfterSave = observed.clicks();
        return call("submit", "core.submit_subflow", { flow: [`flow: Save job`, `step open: open the job`, `  node: web.browser-navigate`, `  url: ${JSON.stringify(viewJob)}`, `step save: save the job`, `  node: web.dom.click`, `  target: ${heartHandle}`, `  consequences: modify_existing`].join("\n") });
      }
      const submitted = last("core.submit_subflow");
      if (typeof submitted?.revision !== "number" || typeof submitted.digest !== "string") throw new Error("diagnostic.submission_refused");
      const candidate = { revision: submitted.revision, digest: submitted.digest };
      if (turn.step === 5) return call("trial.unsettled", "core.test_subflow", candidate);
      if (turn.step === 6) {
        const refused = record(last("core.test_subflow"));
        tests.push(refused);
        const act = actsUnder(refused, "actsToUndo").find(entry => entry.call === "save")?.act;
        if (!act) throw new Error("diagnostic.save_act_missing");
        saveAct = act;
        return node("saved.look", "web.output.browser-navigate", { url: myJobs });
      }
      if (turn.step === 7) {
        const held = rowControl(turn.shownPage(), "Unsave job", JSON.stringify(HELD.title));
        heldTitle = held.identity;
        clicksBeforeWrong = observed.clicks();
        return node("undo.held", "web.output.dom-click", { target: { handle: held.handle } }, ["modify_existing"], { undoes: saveAct });
      }
      if (turn.step === 8) {
        wrong = record(last("core.run_node"));
        clicksAfterWrong = observed.clicks();
        return node("undo.look", "web.output.browser-navigate", { url: myJobs }, [], { undoes: saveAct, resetDestination: destinationReference });
      }
      if (turn.step === 9) {
        settlingLook = record(last("core.run_node"));
        return call("trial.settled", "core.test_subflow", candidate);
      }
      tests.push(record(last("core.test_subflow")));
      return turn.complete({ subflowKey: "main", ...candidate });
    };
    const provider = bindScriptedProvider(installed, { task: TASK, permitted: ["modify_existing"], instructionSourceId: build.instructionSourceId, maxIterations: 20, maxCallsPerRun: 30, builder });
    const { ending, failure } = await build.run();
    const savedReads = reads.filter(read => read.location?.includes("/job-board/myjobs") === true);
    const diagnostic = { ending, failure, builderStep: provider.builderSteps(), destinationReference, saveAct, heldTitle, baseline, baselineTitles, clicks: { clicksBeforeSave, clicksAfterSave, clicksBeforeWrong, clicksAfterWrong, end: observed.clicks() }, wrong, settlingLook, tests, reads, declarations: observed.declarations, outcomes: observed.outcomes, receipts: provider.receipts, gatewayErrors: installed.gatewayErrors, pages };
    await keepDiagnostic(testInfo, "reset-job.json", diagnostic);
    console.log(JSON.stringify({ resetDiagnostic: { ending, failure, tests: tests.map(trialCode), wrong: wrong.code } }));
    expect(ending).toBe("proposed");
    // My jobs is a plain list: read complete with no aria set attributes, its two saved jobs, and a ref issued.
    expect(destinationReference).toMatch(/^destination-[1-9][0-9]{0,3}$/u);
    expect(baseline).toMatch(/^[a-f0-9]{20}$/u);
    const original = reads.find(read => read.hash === baseline);
    expect(original?.sizes).toEqual([2]);
    expect(baselineTitles).toEqual(expect.arrayContaining([JSON.stringify(HELD.title)]));
    // The save: declared modify_existing, admitted, dispatched once; the board failed it itself.
    const save = observed.declarations.find(declaration => declaration.call === "save");
    expect(save?.consequences).toEqual(["modify_existing"]);
    expect(save?.permitted).toBe(true);
    expect(clicksAfterSave).toBe(clicksBeforeSave + 1);
    // The trial is refused: the press has no list of its own, and its settle names the ref to name.
    expect(trialCode(tests[0])).toBe("candidate.trial_reset_required");
    const settle = actsUnder(tests[0], "actsToUndo").find(entry => entry.act === saveAct)?.settle ?? "";
    expect(settle).toContain("resetDestination");
    expect(settle).toContain(`${destinationReference} (2 items`);
    // The undo aimed at a job saved before the build: refused unrun, no click dispatched.
    expect(heldTitle).toBe(JSON.stringify(HELD.title));
    expect(wrong.ok).toBe(false);
    expect(wrong.code).toBe("candidate.undo_unproved");
    expect(clicksAfterWrong).toBe(clicksBeforeWrong);
    const held = observed.declarations.find(declaration => declaration.call === "undo.held");
    expect(held?.permitted).toBe(false);
    expect(original?.subjects).toContain(held?.subject);
    // The look naming the ref under undoes landed and settled the press: the refused undo kept it, and a kept
    // strict act refuses every trial until it settles, so the next trial being admitted is the settlement.
    expect(settlingLook.ok).toBe(true);
    expect(trialCode(tests[1])).toBe("yes");
    expect(actsUnder(tests[1], "actsToUndo")).toEqual([]);
    expect(actsUnder(tests[1], "actsToRestore")).toEqual([]);
    const steps = (record(tests[1]?.feedback).steps as JsonObject[] | undefined) ?? [];
    expect(steps.some(step => step.label === "save the job" && step.status === "succeeded")).toBe(true);
    // My jobs: every read shows the list exactly as the build found it.
    expect(savedReads.length).toBeGreaterThanOrEqual(3);
    for (const read of savedReads) expect(read.hash).toBe(baseline);
  } finally {
    await build.stop();
    await installed.close();
  }
});
