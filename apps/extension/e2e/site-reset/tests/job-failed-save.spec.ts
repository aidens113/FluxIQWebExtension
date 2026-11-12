import type { JsonObject } from "fluxiq/core";
import { postingById } from "../../../../scenario-lab/src/scenarios/job-board/catalog/index.js";
import { viewJobHref } from "../../../../scenario-lab/src/scenarios/job-board/board/index.js";
import { expect, test } from "../../fixtures/extension-context";
import { retiredCodesIn } from "../change-proof";
import { bindInstrumentedRuntime, keepDiagnostic, bindScriptedProvider, pageHandleWhere, projectBuild, rowControl, rowTitles, startInstalledBuild, type BuilderTurn, type ScriptedAnswer } from "../index";

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
 * and its heart states no state, so the build names that ref on its first lasting act
 * (t775: an unnamed save is no longer refused at exploration).
 *
 * Named, the save is admitted. The board fails the first save of each page load
 * with only a notice in its own status region. Since t898 that press, certain to have
 * done nothing, is pressed once more inside the same click command, and the second
 * press lands. So the browser receives one click command, which presses twice: the
 * instrumented runtime counts commands, not presses. The node runs one attempt, and
 * its answer leaves `attempts` out (it is named only above one,
 * `domain/src/runtime/llm-evidence/node-run/run.ts`). Its account says the page's first
 * press brought only a notice and was pressed once more. Before t898, the first press
 * failed `web.action.page_reported_failure` and the node's retry sent a second click
 * command: two commands, two attempts. My jobs reads 2 -> 3 rows. So the act is in
 * place, and Core's settle points at My jobs: undo it there, naming it under
 * `undoes`. An undo on a row My jobs held before the build is refused unrun,
 * naming the closed condition it failed; the new row's own Unsave job is the
 * undo, admitted and landing, and My jobs reads its two rows again.
 *
 * The heart flips a class when pressed, so the save answers with the toggle states it
 * saw. Core then refuses a submitted step on that control without `ensureState`
 * (`candidate.toggle_state_required`, since 2026-10-30; the same whether the save took
 * one command or two). The Flow's save step therefore names the state the press left,
 * the saved heart, copied exactly from the save's answer. The trial then runs on a
 * clean site and answers yes.
 */
test("installed gateway project build retries the page's failed save, and undoes it on its own row", async ({ extensionSession }, testInfo) => {
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
  /** The heart's state after the save's press, as the save's answer observed it: the save step's `ensureState`. */
  let savedState: JsonObject = {};
  /** What the supervisor's dispatch answered once the build brief returned; what each trial's judge was shown. */
  let dispatched: JsonObject | undefined;
  const judged: string[] = [];
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
    // The save step names the state its press leaves: the heart saved, as the save's own answer observed it.
    const flow = (heart: string, saved: JsonObject) => [`flow: Save job`, `step open: open the job`, `  node: web.browser-navigate`, `  url: ${JSON.stringify(viewJob)}`, `step save: save the job`, `  node: web.dom.click`, `  target: ${heart}`, `  consequences: modify_existing`, `  ensureState: ${JSON.stringify(saved)}`].join("\n");
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
        // The build's first lasting press, naming the ref the earlier complete read of My jobs issued (t775: an unnamed
        // press is no longer refused at exploration, and pressing it too would save the job twice). The board answers the
        // first press with only its notice; the same command presses again and lands (t898).
        return send("save", node("save", "web.output.dom-click", { target: { handle: heartHandle } }, ["modify_existing"], { resetDestination: destinationReference }));
      }
      // Where Core's settle points: My jobs, a look naming the act (no undo of its own).
      if (turn.step === 4) return send("undo.look", node("undo.look", "web.output.browser-navigate", { url: myJobs }, [], { undoes: SAVE_ACT }));
      if (turn.step === 5) {
        // A row My jobs held before the build: not the act's own, so refused unrun.
        const held = rowControl(turn.shownPage(), "Unsave job", JSON.stringify(HELD.title));
        return send("undo.held", node("undo.held", "web.output.dom-click", { target: { handle: held.handle } }, ["modify_existing"], { undoes: SAVE_ACT }));
      }
      if (turn.step === 6) {
        // The new row the save added: its own Unsave job puts the act back.
        const own = rowControl(turn.shownPage(), "Unsave job", JSON.stringify(TARGET.title));
        return send("undo", node("undo", "web.output.dom-click", { target: { handle: own.handle } }, ["modify_existing"], { undoes: SAVE_ACT }));
      }
      if (turn.step === 7) return send("undone.look", node("undone.look", "web.output.browser-navigate", { url: myJobs }));
      if (turn.step === 8) {
        undoneHash = reads.at(-1)?.hash;
        savedState = record(record(answers["save"]?.toggle).signature);
        if (!Object.keys(savedState).length) throw new Error("diagnostic.observed_toggle_state_missing");
        return send("submit", call("submit", "core.submit_subflow", { flow: flow(heartHandle, savedState) }));
      }
      const submitted = answers["submit"];
      if (typeof submitted?.revision !== "number" || typeof submitted.digest !== "string") throw new Error("diagnostic.submission_refused");
      const candidate = { revision: submitted.revision, digest: submitted.digest };
      // The build's judged whole run. Its yes completes the brief at once, with no further builder turn (Core t811,
      // 2026-10-30): its verdict reaches the supervisor's dispatch answer, never this builder.
      if (turn.step === 9) return send("trial.clean", call("trial.clean", "core.test_subflow", candidate));
      // Reached only when the trial did not complete the brief; its answer is kept above for the diagnostic.
      return turn.complete({ subflowKey: "main", ...candidate });
    };
    const provider = bindScriptedProvider(installed, {
      task: TASK, permitted: ["modify_existing"], instructionSourceId: build.instructionSourceId, maxIterations: 20, maxCallsPerRun: 30, builder,
      // The default judge's bare yes, keeping what each trial showed it.
      verify: shown => {
        judged.push(shown);
        return { summary: "Diagnostic trial completed.", diagnosis: { answersRequest: "yes" } };
      },
      // The default one-part plan and single build brief, keeping the dispatch's answer, which says how the brief's test ended.
      supervisor: turn => {
        if (turn.step === 1) return turn.call("plan", "project.write_plan", turn.plan());
        if (turn.step === 2) {
          const brief = { kind: "build", subflowKey: "main", parts: ["p1"], entry: { caseId: "observed-current", predecessors: [] }, permittedActs: ["modify_existing"], maxIterations: 20 };
          return turn.call("dispatch", "project.dispatch", { reason: "Exercise the transport.", briefs: [brief] });
        }
        dispatched = turn.last("project.dispatch");
        return turn.complete(record(dispatched?.complete));
      }
    });
    const { ending, failure } = await build.run();
    const savedReads = reads.filter(read => read.location?.includes("/job-board/myjobs") === true);
    // The site after the build: the trial's own save, made on a clean site, is on My jobs.
    await page.goto(myJobs);
    const savedAfterTrial = await page.getByText(TARGET.title, { exact: true }).count();
    const diagnostic = { ending, failure, builderStep: provider.builderSteps(), destinationReference, baseline, baselineTitles, undoneHash, clicks, savedAfterTrial, answers, dispatched, judged, reads, declarations: observed.declarations, outcomes: observed.outcomes, receipts: provider.receipts, gatewayErrors: installed.gatewayErrors, pages };
    await keepDiagnostic(testInfo, "reset-job.json", diagnostic);
    const coded = (callId: string) => answers[callId]?.code ?? (answers[callId]?.ok === true ? "ok" : undefined);
    console.log(JSON.stringify({ resetDiagnostic: { ending, failure, saveAttempts: answers["save"]?.attempts, saveClicks: clicks["save"], submit: answers["submit"]?.issueCodes ?? (answers["submit"]?.digest ? "accepted" : undefined), undoHeld: [coded("undo.held"), answers["undo.held"]?.failed], undo: [coded("undo"), answers["undo"]?.failed], builderSteps: provider.builderSteps(), judged: judged.length, savedAfterTrial, complete: dispatched?.complete ?? null, returns: (dispatched?.returns as JsonObject[] | undefined)?.map(entry => entry.outcome) ?? null } }));

    // My jobs is a plain list: read complete with no aria set attributes, its two saved jobs, and a ref issued.
    expect(destinationReference).toMatch(/^destination-[1-9][0-9]{0,3}$/u);
    expect(baseline).toMatch(/^[a-f0-9]{20}$/u);
    const original = reads.find(read => read.hash === baseline);
    expect(original?.sizes).toEqual([2]);
    expect(baselineTitles).toEqual(expect.arrayContaining([JSON.stringify(HELD.title)]));
    expect(baselineTitles).not.toContain(JSON.stringify(TARGET.title));

    // t775: no exploration call is refused for naming no ref, and no retired reset code shows anywhere in the log.
    expect(retiredCodesIn(answers, observed.outcomes, provider.receipts)).toEqual([]);

    // The save naming the ref: declared modify_existing, admitted once; the board answered the first press with only
    // its own notice, and the same command pressed again and landed (t898). One call, one attempt (its answer names
    // attempts only above one), one click command sent to the browser, and two presses inside it, as its account says.
    const save = observed.declarations.filter(declaration => declaration.call === "save");
    expect(save.map(declaration => [declaration.consequences, declaration.permitted])).toEqual([[["modify_existing"], true]]);
    expect(answers["save"]?.ok).toBe(true);
    expect(answers["save"]?.status).toBe("succeeded");
    expect(answers["save"]?.attempts).toBeUndefined();
    expect(clicks["save"]?.after).toBe(clicks["save"]!.before + 1);
    const saveAccount = String(record(record(answers["save"]?.read).validation).actual ?? "");
    expect(saveAccount, "the page's notice-only first press was pressed once more inside the command").toContain("answered the first press with nothing but a notice in one of its own status or alert regions and left everything else exactly as before, so it was pressed once more");
    // The press flipped the heart: the save answered with the state it left, which the Flow's save step names.
    expect(Object.keys(savedState).length).toBeGreaterThan(0);
    expect(record(answers["save"]?.toggle).signature).toEqual(savedState);

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
    // existed before the build began, so no call can (t743, `reset-undo/admission.ts` destination removal).
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

    // The trial then runs on the clean site the undo left (above), and answers yes. Since Core t811 (2026-10-30) a yes on
    // the judged whole run completes the brief before any further builder turn, so the trial's own answer never reaches
    // this builder: the builder's ninth turn, the trial, is its last. The dispatch says the brief is done on one trial
    // answered yes, proposing the revision the builder submitted, and gives `complete`, which Core gives only when that
    // brief's own test was the passing whole test of the Flow assembled from it (`project-agents/supervisor/dispatch-tool.ts`,
    // `singleYes`): it names that assembly, so its digest is the assembled Flow's, not the subflow submission's.
    expect(provider.builderSteps()).toBe(9);
    const returned = (dispatched?.returns as JsonObject[] | undefined) ?? [];
    expect(returned.map(entry => entry.outcome)).toEqual(["done"]);
    expect((returned[0]?.trialsAnswered as JsonObject[] | undefined)?.map(entry => entry.verdict)).toEqual(["yes"]);
    expect(record(returned[0]?.proposal).revision).toBe(answers["submit"]?.revision);
    expect(record(dispatched?.complete).revision).toBe(answers["submit"]?.revision);
    expect(record(dispatched?.complete).digest).toMatch(/^[a-f0-9]{64}$/u);
    // The judge was asked about that trial, and then once more with the converse question that confirms a yes (Core's
    // recheck). Each time it was shown the Flow's two steps as the trial ran them, the save step having changed the page
    // to say the job was saved.
    const judgeSummaries = judged.map(shown => record(record(record(JSON.parse(shown)).context).resultSummary));
    expect(judgeSummaries.map(summary => typeof summary.recheck === "string")).toEqual([false, true]);
    for (const summary of judgeSummaries) {
      const shape = (summary.flowShape as JsonObject[] | undefined) ?? [];
      expect(shape.map(step => step.label)).toEqual(["open the job", "save the job"]);
      expect(JSON.stringify(shape[1]?.changed ?? [])).toContain("Job saved");
    }
    // The scripted judge says yes to anything, so the site is the oracle too: the job My jobs did not hold before the
    // trial (the undo restored its baseline, above) is on it afterwards. The trial's own clicks are not in `clicks`: its
    // playback does not dispatch through the instrumented evidence runtime.
    expect(savedAfterTrial).toBeGreaterThan(0);
    expect(ending).toBe("proposed");
  } finally {
    await build.stop();
    await installed.close();
  }
});
