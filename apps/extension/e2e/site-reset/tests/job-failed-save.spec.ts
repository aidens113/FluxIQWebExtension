import type { JsonObject } from "fluxiq/core";
import { postingById } from "../../../../scenario-lab/src/scenarios/job-board/catalog/index.js";
import { viewJobHref } from "../../../../scenario-lab/src/scenarios/job-board/board/index.js";
import { expect, test } from "../../fixtures/extension-context";
import { actsUnder, bindInstrumentedRuntime, keepDiagnostic, bindScriptedProvider, pageHandleWhere, projectBuild, rowControl, rowTitles, startInstalledBuild, startedWithActs, trialCode, type BuilderTurn, type ScriptedAnswer } from "../index";

const TASK = "Save one job to my saved jobs.";
/** A job nobody saved: the build presses its heart, and the board's first save of a page load fails. */
const TARGET = postingById("g1");
/** A job already on the saved list when the build began (`job-board/state.ts`, `ALREADY_SAVED`). */
const HELD = postingById("hv2");
/** The build's first lasting act: Core numbers acts from 1 and never reuses a number. */
const SAVE_ACT = "act-1";
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};

/**
 * Job shapes D and F (job r1/r2), rerun round 2 (`run-mvgf4pk5-55343613`) and
 * t743 d4: My jobs is a plain list the domain vouches complete by its own
 * continuation detectors, so its read issues a ref. The save sits in no list
 * and its heart states no state, so before the build's first lasting act Core
 * refuses it unrun until it names that ref (`candidate.reset_witness_required`).
 *
 * Named, the save is admitted. The board fails the first save of each page load
 * with only a notice in its own status region; since t743 d4 that press fails
 * `web.action.page_reported_failure` and is pressed again, and the retry lands:
 * two clicks for one call, and My jobs reads 2 -> 3 rows. So the act is in
 * place, and Core's settle points at My jobs: undo it there, naming it under
 * `undoes`. An undo on a row My jobs held before the build is refused unrun,
 * naming the closed condition it failed; the new row's own Unsave job is the
 * undo, admitted and landing, and My jobs reads its two rows again. The trial
 * then runs on a clean site and answers yes.
 */
test("installed gateway project build refuses a save with no witness, retries the page's failed save, and undoes it on its own row", async ({ extensionSession }, testInfo) => {
  test.setTimeout(300_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const myJobs = new URL("/scenarios/job-board/myjobs", installed.origin).href;
  const viewJob = new URL(viewJobHref(TARGET), installed.origin).href;
  const build = projectBuild(installed, "Installed reset job", TASK);
  const pages: Record<string, string> = {};
  /** Each scripted call's own answer, by call id. */
  const answers: Record<string, JsonObject> = {};
  /** Clicks dispatched just before each scripted call and just after its answer. */
  const clicks: Record<string, { before: number; after?: number }> = {};
  let destinationReference = "", heartHandle = "";
  let baseline: string | undefined, baselineTitles: string[] = [], undoneHash: string | undefined;
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
    let pending = "";
    const send = (callId: string, made: ScriptedAnswer) => {
      pending = callId;
      clicks[callId] = { before: observed.clicks() };
      return made;
    };
    const flow = (heart: string) => [`flow: Save job`, `step open: open the job`, `  node: web.browser-navigate`, `  url: ${JSON.stringify(viewJob)}`, `step save: save the job`, `  node: web.dom.click`, `  target: ${heart}`, `  consequences: modify_existing`].join("\n");
    const builder = (turn: BuilderTurn) => {
      const { last, node, call } = turn;
      pages[`step-${turn.step}`] = turn.shownPage();
      if (pending) {
        answers[pending] = record([...turn.evidence].reverse().find(entry => entry.callId === pending)?.value);
        clicks[pending]!.after = observed.clicks();
        pending = "";
      }
      if (turn.step === 1) return send("saved.original", node("saved.original", "web.output.browser-navigate", { url: myJobs }));
      if (turn.step === 2) {
        baseline = reads.at(-1)?.hash;
        baselineTitles = rowTitles(turn.shownPage());
        const destinations = record(last("core.run_node")?.resetDestinations).collections as JsonObject[] | undefined;
        const reference = destinations?.[0]?.ref;
        if (typeof reference !== "string") throw new Error("diagnostic.plain_list_ref_missing");
        destinationReference = reference;
        return send("job", node("job", "web.output.browser-navigate", { url: viewJob }));
      }
      if (turn.step === 3) {
        const found = pageHandleWhere(turn.shownPage(), /\bicon\b/u);
        if (!found) throw new Error("diagnostic.heart_missing");
        heartHandle = found;
        // The build's first lasting press, naming no ref: nothing could ever show it put back.
        return send("save.unwitnessed", node("save.unwitnessed", "web.output.dom-click", { target: { handle: heartHandle } }, ["modify_existing"]));
      }
      // Retried naming the ref the earlier complete read of My jobs issued; the board fails the first press, the retry lands.
      if (turn.step === 4) return send("save", node("save", "web.output.dom-click", { target: { handle: heartHandle } }, ["modify_existing"], { resetDestination: destinationReference }));
      // Where Core's settle points: My jobs, a look naming the act (no undo of its own).
      if (turn.step === 5) return send("undo.look", node("undo.look", "web.output.browser-navigate", { url: myJobs }, [], { undoes: SAVE_ACT }));
      if (turn.step === 6) {
        // A row My jobs held before the build: not the act's own, so refused unrun.
        const held = rowControl(turn.shownPage(), "Unsave job", JSON.stringify(HELD.title));
        return send("undo.held", node("undo.held", "web.output.dom-click", { target: { handle: held.handle } }, ["modify_existing"], { undoes: SAVE_ACT }));
      }
      if (turn.step === 7) {
        // The new row the save added: its own Unsave job puts the act back.
        const own = rowControl(turn.shownPage(), "Unsave job", JSON.stringify(TARGET.title));
        return send("undo", node("undo", "web.output.dom-click", { target: { handle: own.handle } }, ["modify_existing"], { undoes: SAVE_ACT }));
      }
      if (turn.step === 8) return send("undone.look", node("undone.look", "web.output.browser-navigate", { url: myJobs }));
      if (turn.step === 9) {
        undoneHash = reads.at(-1)?.hash;
        return send("submit", call("submit", "core.submit_subflow", { flow: flow(heartHandle) }));
      }
      const submitted = answers["submit"];
      if (typeof submitted?.revision !== "number" || typeof submitted.digest !== "string") throw new Error("diagnostic.submission_refused");
      const candidate = { revision: submitted.revision, digest: submitted.digest };
      if (turn.step === 10) return send("trial.clean", call("trial.clean", "core.test_subflow", candidate));
      tests.push(answers["trial.clean"] ?? {});
      return turn.complete({ subflowKey: "main", ...candidate });
    };
    const provider = bindScriptedProvider(installed, { task: TASK, permitted: ["modify_existing"], instructionSourceId: build.instructionSourceId, maxIterations: 20, maxCallsPerRun: 30, builder });
    const { ending, failure } = await build.run();
    const savedReads = reads.filter(read => read.location?.includes("/job-board/myjobs") === true);
    const diagnostic = { ending, failure, builderStep: provider.builderSteps(), destinationReference, baseline, baselineTitles, undoneHash, clicks, answers, tests, reads, declarations: observed.declarations, outcomes: observed.outcomes, receipts: provider.receipts, gatewayErrors: installed.gatewayErrors, pages };
    await keepDiagnostic(testInfo, "reset-job.json", diagnostic);
    const coded = (callId: string) => answers[callId]?.code ?? (answers[callId]?.ok === true ? "ok" : undefined);
    console.log(JSON.stringify({ resetDiagnostic: { ending, failure, refused: coded("save.unwitnessed"), saveAttempts: answers["save"]?.attempts, saveClicks: clicks["save"], undoHeld: [coded("undo.held"), answers["undo.held"]?.failed], undo: [coded("undo"), answers["undo"]?.failed], tests: tests.map(trialCode) } }));

    // My jobs is a plain list: read complete with no aria set attributes, its two saved jobs, and a ref issued.
    expect(destinationReference).toMatch(/^destination-[1-9][0-9]{0,3}$/u);
    expect(baseline).toMatch(/^[a-f0-9]{20}$/u);
    const original = reads.find(read => read.hash === baseline);
    expect(original?.sizes).toEqual([2]);
    expect(baselineTitles).toEqual(expect.arrayContaining([JSON.stringify(HELD.title)]));

    // The save naming no ref: refused unrun before the seal, no click dispatched, nothing recorded.
    const refused = answers["save.unwitnessed"];
    expect(refused?.ok).toBe(false);
    expect(refused?.code).toBe("candidate.reset_witness_required");
    expect(refused?.failed).toBe("no_witness");
    expect(clicks["save.unwitnessed"]?.after).toBe(clicks["save.unwitnessed"]?.before);
    expect(observed.declarations.find(declaration => declaration.call === "save.unwitnessed")?.permitted).toBe(false);

    // The save naming the ref: declared modify_existing, admitted once; the board failed the first press with only
    // its own notice, the press was made again, and the retry landed. One call, two clicks, two attempts.
    const save = observed.declarations.filter(declaration => declaration.call === "save");
    expect(save.map(declaration => [declaration.consequences, declaration.permitted])).toEqual([[["modify_existing"], true]]);
    expect(answers["save"]?.ok).toBe(true);
    expect(answers["save"]?.status).toBe("succeeded");
    expect(answers["save"]?.attempts).toBe(2);
    expect(clicks["save"]?.after).toBe(clicks["save"]!.before + 2);

    // The save landed: My jobs now holds a third row, the two it held before kept.
    const afterSave = savedReads.find(read => read.hash !== baseline);
    expect(afterSave?.sizes).toEqual([3]);
    expect(afterSave?.subjects).toEqual(expect.arrayContaining(original?.subjects ?? ["missing"]));
    // Core's settle names the act and points at the list it changed.
    const settlement = record(answers["undo.look"]?.resetSettlement);
    expect(settlement.open).toBe(SAVE_ACT);
    expect(String(settlement.settle)).toContain(`${destinationReference.charAt(0).toUpperCase()}${destinationReference.slice(1)} at ${myJobs}`);
    expect((settlement.actsStillOpen as JsonObject[] | undefined)?.map(act => [act.act, act.call])).toEqual([[SAVE_ACT, "save"]]);

    // An undo on a row My jobs held before the build: refused unrun, naming its closed condition, nothing clicked.
    const held = answers["undo.held"];
    expect(held?.ok).toBe(false);
    expect(held?.code).toBe("candidate.undo_unproved");
    // The row sits in the list the act named, and that list held it before the build: removing it would change what
    // existed before the build began, so no call can (t743, `undo-admission.ts` destination removal).
    expect(held?.failed).toBe("subject_there_before");
    expect(held?.canMeet).toBe("no_call");
    expect(String(held?.condition ?? "")).not.toBe("");
    expect(clicks["undo.held"]?.after).toBe(clicks["undo.held"]?.before);
    expect(observed.declarations.find(declaration => declaration.call === "undo.held")?.permitted).toBe(false);

    // The new row's own Unsave job under undoes: admitted, dispatched once, and My jobs reads its two rows again.
    const undo = answers["undo"];
    expect({ ok: undo?.ok, code: undo?.code, failed: undo?.failed, canMeet: undo?.canMeet }).toEqual({ ok: true, code: undefined, failed: undefined, canMeet: undefined });
    expect(observed.declarations.find(declaration => declaration.call === "undo")?.permitted).toBe(true);
    expect(clicks["undo"]?.after).toBe(clicks["undo"]!.before + 1);
    expect(undoneHash).toBe(baseline);

    // The trial then runs on a clean site, with nothing to undo or restore, and answers yes.
    expect(trialCode(tests[0])).toBe("yes");
    expect(startedWithActs(tests[0]).some(act => act.call === "save" || act.call === "save.unwitnessed")).toBe(false);
    expect(actsUnder(tests[0], "actsToUndo")).toEqual([]);
    expect(actsUnder(tests[0], "actsToRestore")).toEqual([]);
    const steps = (record(tests[0]?.feedback).steps as JsonObject[] | undefined) ?? [];
    expect(steps.some(step => step.label === "save the job" && step.status === "succeeded")).toBe(true);
    expect(ending).toBe("proposed");
  } finally {
    await build.stop();
    await installed.close();
  }
});
