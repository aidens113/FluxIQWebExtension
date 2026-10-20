import type { JsonObject } from "fluxiq/core";
import { postingById } from "../../../../scenario-lab/src/scenarios/job-board/catalog/index.js";
import { viewJobHref } from "../../../../scenario-lab/src/scenarios/job-board/board/index.js";
import { expect, test } from "../../fixtures/extension-context";
import { actsUnder, bindInstrumentedRuntime, keepDiagnostic, bindScriptedProvider, pageHandleWhere, projectBuild, rowTitles, startInstalledBuild, startedWithActs, trialCode, type BuilderTurn } from "../index";

const TASK = "Save one job to my saved jobs.";
/** A job nobody saved: the build presses its heart, and the board's first save of a page load fails. */
const TARGET = postingById("g1");
/** A job already on the saved list when the build began (`job-board/state.ts`, `ALREADY_SAVED`). */
const HELD = postingById("hv2");
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};

/**
 * Job shapes D and F (job r1/r2), and rerun round 2 (`run-mvgf4pk5-55343613`):
 * My jobs is a plain list the domain vouches complete by its own continuation
 * detectors, so its read issues a ref. The save sits in no list and its heart
 * states no state, so before the build's first lasting act Core refuses it
 * unrun until it names that ref (`candidate.reset_witness_required`). Named,
 * the save is admitted, the board fails it itself, and Core's own look at My
 * jobs before the trial settles it as left unchanged, so the trial runs.
 */
test("installed gateway project build refuses a save with no witness, then settles it on the plain list's ref it names", async ({ extensionSession }, testInfo) => {
  test.setTimeout(240_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const myJobs = new URL("/scenarios/job-board/myjobs", installed.origin).href;
  const viewJob = new URL(viewJobHref(TARGET), installed.origin).href;
  const build = projectBuild(installed, "Installed reset job", TASK);
  const pages: Record<string, string> = {};
  let destinationReference = "", heartHandle = "";
  let baseline: string | undefined, baselineTitles: string[] = [];
  let clicksBeforeRefused = 0, clicksAfterRefused = 0, clicksBeforeSave = 0, clicksAfterSave = 0;
  let refused: JsonObject = {};
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
        clicksBeforeRefused = observed.clicks();
        // The build's first lasting press, naming no ref: nothing could ever show it put back.
        return node("save.unwitnessed", "web.output.dom-click", { target: { handle: heartHandle } }, ["modify_existing"]);
      }
      if (turn.step === 4) {
        refused = record(last("core.run_node"));
        clicksAfterRefused = observed.clicks();
        clicksBeforeSave = observed.clicks();
        // Retried naming the ref the earlier complete read of My jobs issued.
        return node("save", "web.output.dom-click", { target: { handle: heartHandle } }, ["modify_existing"], { resetDestination: destinationReference });
      }
      if (turn.step === 5) {
        clicksAfterSave = observed.clicks();
        return call("submit", "core.submit_subflow", { flow: [`flow: Save job`, `step open: open the job`, `  node: web.browser-navigate`, `  url: ${JSON.stringify(viewJob)}`, `step save: save the job`, `  node: web.dom.click`, `  target: ${heartHandle}`, `  consequences: modify_existing`].join("\n") });
      }
      const submitted = last("core.submit_subflow");
      if (typeof submitted?.revision !== "number" || typeof submitted.digest !== "string") throw new Error("diagnostic.submission_refused");
      const candidate = { revision: submitted.revision, digest: submitted.digest };
      if (turn.step === 6) return call("trial.settled", "core.test_subflow", candidate);
      tests.push(record(last("core.test_subflow")));
      return turn.complete({ subflowKey: "main", ...candidate });
    };
    const provider = bindScriptedProvider(installed, { task: TASK, permitted: ["modify_existing"], instructionSourceId: build.instructionSourceId, maxIterations: 20, maxCallsPerRun: 30, builder });
    const { ending, failure } = await build.run();
    const savedReads = reads.filter(read => read.location?.includes("/job-board/myjobs") === true);
    const diagnostic = { ending, failure, builderStep: provider.builderSteps(), destinationReference, baseline, baselineTitles, clicks: { clicksBeforeRefused, clicksAfterRefused, clicksBeforeSave, clicksAfterSave, end: observed.clicks() }, refused, tests, reads, declarations: observed.declarations, outcomes: observed.outcomes, receipts: provider.receipts, gatewayErrors: installed.gatewayErrors, pages };
    await keepDiagnostic(testInfo, "reset-job.json", diagnostic);
    console.log(JSON.stringify({ resetDiagnostic: { ending, failure, tests: tests.map(trialCode), refused: refused.code } }));
    expect(ending).toBe("proposed");
    // My jobs is a plain list: read complete with no aria set attributes, its two saved jobs, and a ref issued.
    expect(destinationReference).toMatch(/^destination-[1-9][0-9]{0,3}$/u);
    expect(baseline).toMatch(/^[a-f0-9]{20}$/u);
    const original = reads.find(read => read.hash === baseline);
    expect(original?.sizes).toEqual([2]);
    expect(baselineTitles).toEqual(expect.arrayContaining([JSON.stringify(HELD.title)]));
    // The save naming no ref: refused unrun before the seal, no click dispatched, nothing recorded.
    expect(refused.ok).toBe(false);
    expect(refused.code).toBe("candidate.reset_witness_required");
    expect(clicksAfterRefused).toBe(clicksBeforeRefused);
    expect(observed.declarations.find(declaration => declaration.call === "save.unwitnessed")?.permitted).toBe(false);
    // The save naming the ref: declared modify_existing, admitted, dispatched once; the board failed it itself.
    const save = observed.declarations.find(declaration => declaration.call === "save");
    expect(save?.consequences).toEqual(["modify_existing"]);
    expect(save?.permitted).toBe(true);
    expect(clicksAfterSave).toBe(clicksBeforeSave + 1);
    // Core's own look at My jobs settled it as left unchanged: the trial ran with it in place and nothing to undo.
    expect(trialCode(tests[0])).toBe("yes");
    expect(startedWithActs(tests[0]).some(act => act.call === "save")).toBe(true);
    expect(startedWithActs(tests[0]).some(act => act.call === "save.unwitnessed")).toBe(false);
    expect(actsUnder(tests[0], "actsToUndo")).toEqual([]);
    expect(actsUnder(tests[0], "actsToRestore")).toEqual([]);
    const steps = (record(tests[0]?.feedback).steps as JsonObject[] | undefined) ?? [];
    expect(steps.some(step => step.label === "save the job" && step.status === "succeeded")).toBe(true);
    // My jobs: every read shows the list exactly as the build found it.
    expect(savedReads.length).toBeGreaterThanOrEqual(2);
    for (const read of savedReads) expect(read.hash).toBe(baseline);
  } finally {
    await build.stop();
    await installed.close();
  }
});
