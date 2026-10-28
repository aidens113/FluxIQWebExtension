import type { JsonObject } from "fluxiq/core";
import { postingById } from "../../../../scenario-lab/src/scenarios/job-board/catalog/index.js";
import { viewJobHref } from "../../../../scenario-lab/src/scenarios/job-board/board/index.js";
import { expect, test } from "../../fixtures/extension-context";
import { actsUnder, bindInstrumentedRuntime, keepDiagnostic, bindScriptedProvider, pageHandleWhere, projectBuild, rowControl, startInstalledBuild, trialCode, type BuilderTurn, type ScriptedAnswer } from "../index";

const TASK = "Save three jobs to my saved jobs.";
/** Three jobs nobody saved: the build saves each, so three lasting acts stand on the saved-jobs list. */
const TARGETS = [postingById("m1"), postingById("d1"), postingById("m2")];
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
/** The acts an answer's `actsUnsettleable` names, with the reason and the failed condition Core gave them. */
const unsettleable = (answer: JsonObject | undefined) => (Array.isArray(answer?.actsUnsettleable) ? answer.actsUnsettleable : []).map(record).map(entry => ({ act: String(entry.act ?? ""), reason: entry.reason ?? null, failed: entry.failed ?? null }));
const toStillOpen = (answer: JsonObject | undefined) => actsUnder(answer, "actsToUndo").map(entry => entry.act).sort();

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
 */
test("installed gateway project build keeps the other acts undoable after an undo that the list redraws only on load", async ({ extensionSession }, testInfo) => {
  // KNOWN GAP (t772 w11): Core's part holds (no act is listed unsettleable from the in-place read, and an act whose own
  // undo landed settles once a load shows its row gone and every other differing row is another act's own row). The per-act
  // expectations below still fail on two defects outside t772: (1) the extension records each save's subject from the
  // "Apply on company site" link beside the save control, not the posting's heading (`record.ts` `nearestTitle`), so no act
  // owns its row until its undo lands; (2) the domain's press-again rule (t513, `press-effect/settled.ts`) pressed the
  // second undo twice because the list redraws only on load, saving that job again. Remove this line once both are fixed.
  test.setTimeout(420_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const myJobs = new URL("/scenarios/job-board/myjobs", installed.origin).href;
  const viewJobs = TARGETS.map(posting => new URL(viewJobHref(posting), installed.origin).href);
  const build = projectBuild(installed, "Installed reset job redraw", TASK);
  const pages: Record<string, string> = {};
  const answers: Record<string, JsonObject> = {};
  const tests: JsonObject[] = [];
  const clicks: Record<string, { before: number; after?: number }> = {};
  let destinationReference = "", heartHandle = "";
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
      clicks[callId] = { before: observed.clicks() };
      return made;
    };
    const flow = () => [`flow: Save job`, `step open: open the job`, `  node: web.browser-navigate`, `  url: ${JSON.stringify(viewJobs[0])}`, `step save: save the job`, `  node: web.dom.click`, `  target: ${heartHandle}`, `  consequences: modify_existing`].join("\n");
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
    queue.push(turn => send("submit", turn.call("submit", "core.submit_subflow", { flow: flow() })));
    // The first gate after two undos landed on a list that redraws only on load.
    queue.push(turn => send("trial.mid", turn.call("trial.mid", "core.test_subflow", candidate())));
    open("list.reload", myJobs);
    undoRow("undo.third", 2, () => acts[2]!);
    open("list.final", myJobs);
    queue.push(turn => send("trial.final", turn.call("trial.final", "core.test_subflow", candidate())));
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
      }
      const next = queue.shift();
      if (next) return next(turn);
      tests.push(answers["trial.mid"] ?? {}, answers["trial.final"] ?? {});
      return turn.complete({ subflowKey: "main", ...(answers["submit"] ? candidate() : {}) });
    };
    const provider = bindScriptedProvider(installed, { task: TASK, permitted: ["modify_existing"], instructionSourceId: build.instructionSourceId, maxIterations: 30, maxCallsPerRun: 40, builder });
    const { ending, failure } = await build.run();
    // `pressedAgain`: the runtime pressed the control a second time because the first changed nothing it could see.
    const summary = Object.fromEntries(Object.entries(answers).map(([id, answer]) => [id, { ok: answer.ok ?? null, code: answer.code ?? answer.verdict ?? null, failed: answer.failed ?? null, toUndo: toStillOpen(answer), unsettleable: unsettleable(answer), ...(typeof answer.pressedAgain === "string" ? { pressedAgain: true } : {}) }]));
    // What each lasting call was declared about: an undo is tied to its act's row only through these subjects.
    const subjects = Object.fromEntries(observed.declarations.filter(declaration => Array.isArray(declaration.consequences) && declaration.consequences.length > 0).map(declaration => [declaration.call, { subject: declaration.subject ?? null, page: declaration.page ?? null }]));
    await keepDiagnostic(testInfo, "reset-job-redraw.json", { ending, failure, builderStep: provider.builderSteps(), acts, destinationReference, clicks, answers, tests, reads: observed.reads, declarations: observed.declarations, outcomes: observed.outcomes, receipts: provider.receipts, gatewayErrors: installed.gatewayErrors, pages });
    console.log(JSON.stringify({ resetDiagnostic: { ending, failure, acts, summary, subjects } }));

    // Three lasting acts stand: each save named the ref of the list read before them and was admitted.
    for (let index = 0; index < 3; index++) {
      expect(answers[`save.${index}`]?.ok).toBe(true);
      expect(observed.declarations.find(declaration => declaration.call === `save.${index}`)?.permitted).toBe(true);
    }
    // The first undo landed from the list page, which redraws only on load.
    expect(answers["undo.first"]?.ok).toBe(true);
    expect(clicks["undo.first"]?.after).toBe(clicks["undo.first"]!.before + 1);
    // The second undo, aimed at another act on the same unreloaded list, is admitted too.
    expect(answers["undo.second"]?.ok).toBe(true);
    // The gate after them, on the list as the board now draws it: the two undone acts settled; the third stays to undo, named by Core
    // as a call the build can make, never as an act no call can settle.
    const mid = tests[0];
    expect(unsettleable(mid)).toEqual([]);
    expect(mid?.failed).not.toBe("acts_unsettleable");
    expect(trialCode(mid)).toBe("candidate.trial_reset_required");
    expect(toStillOpen(mid)).toEqual([acts[2]]);
    // The reset completes once the last is undone: the undo is admitted, and the trial is admitted on the restored site.
    expect(answers["undo.third"]?.ok).toBe(true);
    const final = tests[1];
    expect(unsettleable(final)).toEqual([]);
    expect(actsUnder(final, "actsToUndo")).toEqual([]);
    expect(trialCode(final)).toBe("yes");
    expect(ending).toBe("proposed");
  } finally {
    await build.stop();
    await installed.close();
  }
});
