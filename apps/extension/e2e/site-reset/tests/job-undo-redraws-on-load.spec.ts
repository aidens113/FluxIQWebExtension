import type { JsonObject } from "fluxiq/core";
import { postingById } from "../../../../scenario-lab/src/scenarios/job-board/catalog/index.js";
import { viewJobHref } from "../../../../scenario-lab/src/scenarios/job-board/board/index.js";
import { expect, test } from "../../fixtures/extension-context";
import { judgeLog, retiredCodesIn } from "../change-proof";
import { bindInstrumentedRuntime, keepDiagnostic, bindScriptedProvider, pageHandleWhere, projectBuild, rowControl, rowTitles, startInstalledBuild, type BuilderTurn, type ScriptedAnswer } from "../index";

const TASK = "Save three jobs to my saved jobs.";
/** Three jobs nobody saved: the build saves each, so three lasting acts stand on the saved-jobs list. */
const TARGETS = [postingById("m1"), postingById("d1"), postingById("m2")];
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};

/**
 * Job-board rerun round 6 (`run-mvrj7qg9-b6dc94f6`, root cause 1): My jobs is
 * a plain list the build read complete before it saved three jobs. The board's
 * Unsave on My jobs commits on the server and repaints the heart, but keeps the
 * row in the list until the next load. After one undo landed from that page,
 * the in-place read of the list still shows the row, and Core listed every
 * other act under `actsUnsettleable` (`gate_unsatisfiable`, `no_admissible_undo`)
 * from it, so a reset builder gave up on acts it had not even tried.
 *
 * Expected: an answer taken after an in-place read never lists an act the build
 * can still undo under `actsUnsettleable`; after a load the undone act settles
 * and the other two stay in `actsToUndo`; the reset completes once each is
 * undone, and the trial is then admitted.
 *
 * Since Core t811 (2026-10-30) a yes on the judged whole run completes the brief before any further builder turn, so a
 * build holds one judged trial, not the two this script once ran in a row. Each of the two moments the spec proves is
 * therefore its own test, with the same script up to its trial: the trial run after two undos with the third act still in
 * place, and the trial run after the last undo on the restored site. Each trial's verdict is read from the supervisor's
 * `project.dispatch` answer, since its own answer no longer reaches the builder. Core also refuses a save step on the heart
 * without `ensureState` (`candidate.toggle_state_required`, 2026-10-30): the step names the state the press left.
 */
const VARIANTS = [
  { name: "installed gateway project build keeps the other acts undoable after an undo that the list redraws only on load", restored: false },
  { name: "installed gateway project build admits the trial on the restored site once the last undo lands after a list that redraws only on load", restored: true }
];
for (const variant of VARIANTS) test(variant.name, async ({ extensionSession }, testInfo) => {
  test.setTimeout(420_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const myJobs = new URL("/scenarios/job-board/myjobs", installed.origin).href;
  const viewJobs = TARGETS.map(posting => new URL(viewJobHref(posting), installed.origin).href);
  const build = projectBuild(installed, "Installed reset job redraw", TASK, () => installed.page.url());
  const pages: Record<string, string> = {};
  const answers: Record<string, JsonObject> = {};
  const judge = judgeLog();
  const clicks: Record<string, { before: number; after?: number }> = {};
  let destinationReference = "", heartHandle = "";
  /** My jobs as the build found it, before any save. */
  let baselineTitles: string[] = [];
  /** The heart's state after a save's press, as that save's answer observed it: the save step's `ensureState`. */
  let savedState: JsonObject = {};
  /** What the supervisor's dispatch answered once the build brief returned: how the brief's trial ended. */
  let dispatched: JsonObject | undefined;
  let trialActionsStart = -1;
  /** Core numbers acts from 1 in the order the build made them and never reuses a number. */
  const acts = ["act-1", "act-2", "act-3"];
  try {
    await page.goto(new URL("/scenarios/job-board/", installed.origin).href);
    await page.getByRole("button", { name: "Accept all", exact: true }).click();
    await page.locator("rf-assistant .fa-min").waitFor({ timeout: 9000 });
    await page.locator("rf-assistant .fa-min").click();
    await page.goto(viewJobs[0]!);
    await installed.pair();
    const observed = bindInstrumentedRuntime(installed);
    let pending = "";
    const send = (callId: string, made: ScriptedAnswer) => {
      pending = callId;
      if (callId.startsWith("trial.")) trialActionsStart = observed.actions.length;
      clicks[callId] = { before: observed.clicks() };
      return made;
    };
    const flow = () => [`flow: Save job`, `step open: open the job`, `  node: web.browser-navigate`, `  url: ${JSON.stringify(viewJobs[0])}`, `step save: save the job`, `  node: web.dom.click`, `  target: ${heartHandle}`, `  consequences: modify_existing`, `  ensureState: ${JSON.stringify(savedState)}`].join("\n");
    /** What the builder does next, in order; each makes one call when its turn comes. */
    const queue: Array<(turn: BuilderTurn) => ScriptedAnswer> = [];
    const open = (id: string, url: string) => queue.push(turn => send(id, turn.node(id, "web.output.browser-navigate", { url })));
    // The board's results page shows each job's address, so the build may navigate to it afterwards.
    open("home", new URL("/scenarios/job-board/", installed.origin).href);
    open("results", new URL("/scenarios/job-board/jobs?q=Rust%20engineer", installed.origin).href);
    TARGETS.forEach((_, index) => {
      open(`job.${index}`, viewJobs[index]!);
      queue.push(turn => {
        const found = pageHandleWhere(turn.shownPage(), /\bicon\b/u);
        if (!found) throw new Error("diagnostic.heart_missing");
        heartHandle = heartHandle || found;
        return send(`save.${index}`, turn.node(`save.${index}`, "web.output.dom-click", { target: { handle: found } }, ["modify_existing"], { resetDestination: destinationReference }));
      });
    });
    open("list.look", myJobs);
    const undoRow = (id: string, index: number, act: () => string) => queue.push(turn => {
      const own = rowControl(turn.shownPage(), "Unsave job", JSON.stringify(TARGETS[index]!.title));
      return send(id, turn.node(id, "web.output.dom-click", { target: { handle: own.handle } }, ["modify_existing"], { undoes: act() }));
    });
    // The first undo lands from the list page, which keeps the row until the next load; the second is aimed at another act on the same unreloaded list.
    undoRow("undo.first", 0, () => acts[0]!);
    undoRow("undo.second", 1, () => acts[1]!);
    const candidate = () => {
      const submitted = answers["submit"];
      if (typeof submitted?.revision !== "number" || typeof submitted.digest !== "string") throw new Error("diagnostic.submission_refused");
      return { revision: submitted.revision, digest: submitted.digest };
    };
    const submit = () => queue.push(turn => {
      // Core refuses a step on a toggling control without `ensureState` (`candidate.toggle_state_required`, 2026-10-30): the save step names the state the press left, copied from the save's own answer.
      savedState = record(record(answers["save.0"]?.toggle).signature);
      if (!Object.keys(savedState).length) throw new Error("diagnostic.observed_toggle_state_missing");
      return send("submit", turn.call("submit", "core.submit_subflow", { flow: flow() }));
    });
    if (variant.restored) {
      // The last undo lands after a load, and the one trial runs on the restored site.
      open("list.reload", myJobs);
      undoRow("undo.third", 2, () => acts[2]!);
      open("list.final", myJobs);
      submit();
      queue.push(turn => send("trial.final", turn.call("trial.final", "core.test_subflow", candidate())));
    } else {
      // The one trial runs after two undos landed on a list that redraws only on load (t775: it runs, with the third act in place).
      submit();
      queue.push(turn => send("trial.mid", turn.call("trial.mid", "core.test_subflow", candidate())));
    }
    const builder = (turn: BuilderTurn) => {
      pages[`step-${turn.step}`] = turn.shownPage();
      if (pending) {
        answers[pending] = record([...turn.evidence].reverse().find(entry => entry.callId === pending)?.value);
        clicks[pending]!.after = observed.clicks();
        pending = "";
      }
      if (turn.step === 1) return send("saved.original", turn.node("saved.original", "web.output.browser-navigate", { url: myJobs }));
      if (turn.step === 2) {
        const destinations = record(turn.last("core.run_node")?.resetDestinations).collections as JsonObject[] | undefined;
        const reference = destinations?.[0]?.ref;
        if (typeof reference !== "string") throw new Error("diagnostic.plain_list_ref_missing");
        destinationReference = reference;
        baselineTitles = rowTitles(turn.shownPage());
      }
      const next = queue.shift();
      if (next) return next(turn);
      return turn.complete({ subflowKey: "main", ...(answers["submit"] ? candidate() : {}) });
    };
    const provider = bindScriptedProvider(installed, { task: TASK, permitted: ["modify_existing"], instructionSourceId: build.instructionSourceId, maxIterations: 30, maxCallsPerRun: 40, builder, verify: judge.verify,
      supervisor: turn => {
        if (turn.step === 1) return turn.call("plan", "project.write_plan", turn.plan());
        if (turn.step === 2) {
          const brief = { kind: "build", subflowKey: "main", parts: ["p1"], entry: { caseId: "observed-current", predecessors: [] }, permittedActs: ["modify_existing"], maxIterations: 30 };
          return turn.call("dispatch", "project.dispatch", { reason: "Exercise the transport.", briefs: [brief] });
        }
        dispatched = turn.last("project.dispatch");
        return turn.complete(record(dispatched?.complete));
      }
    });
    const { ending, failure } = await build.run();
    const trialActions = observed.actions.slice(trialActionsStart);
    // The site as the build left it: My jobs, loaded fresh, says which of the three saves still stand.
    await page.goto(myJobs);
    const standing = await Promise.all(TARGETS.map(async posting => (await page.getByText(posting.title, { exact: true }).count()) > 0));
    const baselineStanding = await Promise.all(baselineTitles.map(async title => (await page.getByText(JSON.parse(title) as string, { exact: true }).count()) > 0));
    // `pressedAgain`: the runtime pressed the control a second time because the first changed nothing it could see.
    const summary = Object.fromEntries(Object.entries(answers).map(([id, answer]) => [id, { ok: answer.ok ?? null, code: answer.code ?? answer.verdict ?? null, failed: answer.failed ?? null,
      stillOpen: (record(answer.resetSettlement).actsStillOpen as JsonObject[] | undefined)?.map(act => act.act),
      ...(typeof answer.pressedAgain === "string" ? { pressedAgain: true } : {}) }]));
    // What each lasting call was declared about: an undo is tied to its act's row only through these subjects.
    const subjects = Object.fromEntries(observed.declarations.filter(declaration => Array.isArray(declaration.consequences) && declaration.consequences.length > 0).map(declaration => [declaration.call, { subject: declaration.subject ?? null, page: declaration.page ?? null }]));
    await keepDiagnostic(testInfo, "reset-job-redraw.json", { ending, failure, builderStep: provider.builderSteps(), acts, destinationReference, clicks, answers, dispatched, trialActionsStart, trialActions, baselineTitles, standing, judged: judge.requests, siteChanges: judge.siteChanges(), reads: observed.reads, declarations: observed.declarations, outcomes: observed.outcomes, receipts: provider.receipts, gatewayErrors: installed.gatewayErrors, pages });
    console.log(JSON.stringify({ resetDiagnostic: { ending, failure, acts, summary, subjects } }));

    // Three lasting acts stand: each save named the ref of the list read before them and was admitted.
    for (let index = 0; index < 3; index++) {
      expect(answers[`save.${index}`]?.ok).toBe(true);
      expect(observed.declarations.find(declaration => declaration.call === `save.${index}`)?.permitted).toBe(true);
    }
    // The first undo landed from the list page, which redraws only on load.
    expect(answers["undo.first"]?.ok).toBe(true);
    expect(answers["undo.first"]?.resetSettlement).toMatchObject({ open: acts[0],
      actsStillOpen: acts.map(act => expect.objectContaining({ act, settle: expect.any(String) })) });
    expect(clicks["undo.first"]?.after).toBe(clicks["undo.first"]!.before + 1);
    // The second undo, aimed at another act on the same unreloaded list, is admitted too.
    expect(answers["undo.second"]?.ok).toBe(true);
    expect(answers["undo.second"]?.resetSettlement).toMatchObject({ open: acts[1],
      actsStillOpen: acts.map(act => expect.objectContaining({ act, settle: expect.any(String) })) });
    expect(clicks["undo.second"]?.after).toBe(clicks["undo.second"]!.before + 1);
    expect(retiredCodesIn(answers, observed.outcomes, provider.receipts)).toEqual([]);
    expect(trialActionsStart).toBeGreaterThanOrEqual(0);
    expect(trialActions.filter(action => action.action === "web.dom.click")).toEqual([expect.objectContaining({ status: "succeeded", skipped: undefined })]);
    // Core completes the brief on the trial's yes, so its answer is the dispatch's: one trial, answered yes, for the submitted revision.
    const returned = (dispatched?.returns as JsonObject[] | undefined) ?? [];
    expect(returned.map(entry => entry.outcome)).toEqual(["done"]);
    expect((returned[0]?.trialsAnswered as JsonObject[] | undefined)?.map(entry => entry.verdict)).toEqual(["yes"]);
    expect(record(returned[0]?.proposal).revision).toBe(answers["submit"]?.revision);
    expect(record(dispatched?.complete).revision).toBe(answers["submit"]?.revision);
    expect(judge.requests).toHaveLength(2);
    expect(judge.siteChanges()).toHaveLength(1);
    const left = judge.siteChanges()[0]?.leftFromEarlier;
    expect(Array.isArray(left)).toBe(true);
    for (const shown of judge.requests) {
      const summary = record(record(JSON.parse(shown)).context).resultSummary as JsonObject;
      const inherited = ((summary.startedWith as unknown[] | undefined) ?? []).map(String);
      expect(inherited.map(entry => entry.match(/\(act-[0-9]+\)/u)?.[0]).filter(Boolean)).toEqual(variant.restored ? [] : ["(act-3)"]);
    }
    if (!variant.restored) {
      // The trial after the two undos, on the list as the board now draws it: the two undone acts settled, so the third is the one act left in
      // place. t775: the trial is no longer refused for it. It runs, and the judge's `siteChange` lists that one act under `leftFromEarlier`.
      expect(Array.isArray(left) ? left.length : -1).toBe(1);
    } else {
      // The reset completes once the last is undone: the undo is admitted, and the trial is admitted on the restored site, leaving nothing in place.
      expect(answers["undo.third"]?.ok).toBe(true);
      expect(answers["undo.third"]?.resetSettlement).toMatchObject({ open: acts[2],
        actsStillOpen: acts.map(act => expect.objectContaining({ act, settle: expect.any(String) })) });
      expect(left).toEqual([]);
    }
    // The site's own state is where the undone acts are proven settled, which the trial's answer (`actsToUndo`, `unsettleable`)
    // once showed and no longer reaches this builder (Core t811). Every row the build found is still there, and none of the
    // three jobs was there before the build. The first and second acts were undone and the trial's own save made the first
    // again; the third stands when the trial ran with it in place and is undone otherwise.
    expect(baselineTitles.length).toBeGreaterThan(0);
    expect(baselineStanding.every(Boolean)).toBe(true);
    for (const title of TARGETS.map(posting => JSON.stringify(posting.title))) expect(baselineTitles).not.toContain(title);
    expect(standing).toEqual([true, false, !variant.restored]);
    expect(ending).toBe("proposed");
  } finally {
    await build.stop();
    await installed.close();
  }
});
