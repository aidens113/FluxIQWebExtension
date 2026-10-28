import type { JsonObject } from "fluxiq/core";
import { postingById } from "../../../../scenario-lab/src/scenarios/job-board/catalog/index.js";
import { viewJobHref } from "../../../../scenario-lab/src/scenarios/job-board/board/index.js";
import { expect, test } from "../../fixtures/extension-context";
import { actsUnder, bindInstrumentedRuntime, bindScriptedProvider, keepDiagnostic, pageHandleWhere, projectBuild, rowControl, startInstalledBuild, startedWithActs, trialCode, type BuilderTurn, type NamedAct, type ScriptedAnswer } from "../index";

const TASK = "Save one job to my saved jobs.";
/** A job nobody saved: the build's save presses its heart (the board fails the first save of each page load). */
const TARGET = postingById("g1");
/** The step the submitted Flow saves the job with, never pressed while exploring before the first test. */
const SAVE_STEP = "save";
const SAVE_LABEL = "save the job";
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
const list = (value: unknown): JsonObject[] => Array.isArray(value) ? value.map(record) : [];
const feedbackSteps = (tested: JsonObject | undefined) => list(record(tested?.feedback).steps);

/**
 * Job rerun round 5 (`run-mvhibk0z-1950493f`, cause 1): brief-3 submitted a
 * save whose lasting step was never pressed while exploring, and Core admitted
 * its trial (0094/0095). The trial's save was the build's first lasting act,
 * with no witness of any kind, and every later trial was refused for the rest
 * of the build. The witness rule guarded only the exploration door.
 *
 * t751 R3 (`t751-reset-by-observed-state.md`): a subflow trial whose reversible
 * lasting step carries no witness stamp is refused unrun,
 * `candidate.trial_step_unwitnessed`, `failed: no_witness`,
 * `canMeet: another_page`, naming the step; nothing is clicked and no act is
 * recorded. Pressed once while exploring, naming the My jobs ref, and
 * submitted again, the step carries the explored act's witness: the trial runs
 * once the explored act is settled, and its own save is left with a settle
 * naming My jobs.
 *
 * The builder reads My jobs complete (ref issued), opens the job and finds the
 * heart without pressing it, submits, and tests. Then it presses the heart
 * naming the ref, resubmits the same Flow text, and tests; if the gate lists
 * the explored save as still to undo, it puts it back on its own My jobs row
 * under `undoes` (as the person's reset would) and tests again. Once a trial
 * has run it asks the gate once more, to see what that trial left.
 */
test("installed gateway project build refuses a trial of a lasting step never pressed while exploring, then runs it once explored", async ({ extensionSession }, testInfo) => {
  test.setTimeout(420_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const myJobs = new URL("/scenarios/job-board/myjobs", installed.origin).href;
  const viewJob = new URL(viewJobHref(TARGET), installed.origin).href;
  const build = projectBuild(installed, "Installed reset job unexplored", TASK);
  const pages: Record<string, string> = {};
  /** Each scripted call's own answer, by call id. */
  const answers: Record<string, JsonObject> = {};
  /** Clicks dispatched just before each scripted call and just after its answer. */
  const clicks: Record<string, { before: number; after?: number }> = {};
  /** The calls the builder made, in order. */
  const sent: string[] = [];
  const tests: Array<{ call: string; answer: JsonObject }> = [];
  let destinationReference = "", heartHandle = "", exploredAct = "";
  /** My jobs as the build found it, and as it reads just after the first test. */
  let baseline: string | undefined, afterTest: string | undefined;
  let candidate: { revision: number; digest: string } | undefined;
  let resubmitted: { revision: number; digest: string } | undefined;
  try {
    await page.goto(new URL("/scenarios/job-board/", installed.origin).href);
    await page.getByRole("button", { name: "Accept all", exact: true }).click();
    await page.locator("rf-assistant .fa-min").waitFor({ timeout: 9000 });
    await page.locator("rf-assistant .fa-min").click();
    await page.goto(viewJob);
    await installed.pair();
    const observed = bindInstrumentedRuntime(installed);
    let pending = "";
    const send = (callId: string, made: ScriptedAnswer) => {
      pending = callId;
      sent.push(callId);
      clicks[callId] = { before: observed.clicks() };
      return made;
    };
    const flow = () => [`flow: Save job`, `step open: open the job`, `  node: web.browser-navigate`, `  url: ${JSON.stringify(viewJob)}`, `step ${SAVE_STEP}: ${SAVE_LABEL}`, `  node: web.dom.click`, `  target: ${heartHandle}`, `  consequences: modify_existing`].join("\n");
    const revisionOf = (answer: JsonObject | undefined) => typeof answer?.revision === "number" && typeof answer.digest === "string" ? { revision: answer.revision, digest: answer.digest } : undefined;
    let finished = false;
    const ranTrial = () => tests.some(entry => trialCode(entry.answer) === "yes");
    const builder = (turn: BuilderTurn): ScriptedAnswer => {
      const { last, node, call } = turn;
      pages[`step-${turn.step}`] = turn.shownPage();
      const previous = pending;
      if (pending) {
        answers[pending] = record([...turn.evidence].reverse().find(entry => entry.callId === pending)?.value);
        clicks[pending]!.after = observed.clicks();
        if (pending.startsWith("trial.")) tests.push({ call: pending, answer: answers[pending]! });
        pending = "";
      }
      const done = () => {
        finished = true;
        return turn.complete({ subflowKey: "main", ...(resubmitted ?? candidate ?? {}) });
      };
      // A later brief (the supervisor dispatching again after a refused ending) is not scripted: it completes at once.
      if (finished) return done();
      switch (previous) {
        case "":
          return send("saved.original", node("saved.original", "web.output.browser-navigate", { url: myJobs }));
        case "saved.original": {
          const destinations = list(record(last("core.run_node")?.resetDestinations).collections);
          const reference = destinations[0]?.ref;
          if (typeof reference !== "string") throw new Error("diagnostic.plain_list_ref_missing");
          destinationReference = reference;
          baseline = observed.reads.at(-1)?.hash;
          return send("job", node("job", "web.output.browser-navigate", { url: viewJob }));
        }
        case "job": {
          // The heart is found on the job's page and never pressed: the save step is authored unexplored, as brief-3's was.
          const found = pageHandleWhere(turn.shownPage(), /\bicon\b/u);
          if (!found) throw new Error("diagnostic.heart_missing");
          heartHandle = found;
          return send("submit", call("submit", "core.submit_subflow", { flow: flow() }));
        }
        case "submit":
          candidate = revisionOf(answers["submit"]);
          if (!candidate) throw new Error("diagnostic.submission_refused");
          return send("trial.unexplored", call("trial.unexplored", "core.test_subflow", candidate));
        case "trial.unexplored":
          // My jobs, read straight after the test: what the site holds tells whether the test pressed the heart.
          return send("saved.after-test", node("saved.after-test", "web.output.browser-navigate", { url: myJobs }));
        case "saved.after-test":
          afterTest = observed.reads.at(-1)?.hash;
          return send("job.again", node("job.again", "web.output.browser-navigate", { url: viewJob }));
        case "job.again":
          // Pressed once while exploring, naming the ref the complete read of My jobs issued.
          return send("save.explored", node("save.explored", "web.output.dom-click", { target: { handle: heartHandle } }, ["modify_existing"], { resetDestination: destinationReference }));
        case "save.explored":
          return send("submit.again", call("submit.again", "core.submit_subflow", { flow: flow() }));
        case "submit.again":
          resubmitted = revisionOf(answers["submit.again"]);
          return send("trial.explored", call("trial.explored", "core.test_subflow", resubmitted ?? candidate!));
        case "trial.explored": {
          const answer = answers["trial.explored"];
          if (trialCode(answer) === "yes") return send("trial.after", call("trial.after", "core.test_subflow", resubmitted ?? candidate!));
          const open = actsUnder(answer, "actsToUndo").find(act => act.call === "save.explored");
          if (!open) return done();
          exploredAct = open.act;
          return send("undo.look", node("undo.look", "web.output.browser-navigate", { url: myJobs }, [], { undoes: exploredAct }));
        }
        case "undo.look": {
          // The explored save's own row on My jobs: its Unsave job puts the act back.
          const own = rowControl(turn.shownPage(), "Unsave job", JSON.stringify(TARGET.title));
          return send("undo", node("undo", "web.output.dom-click", { target: { handle: own.handle } }, ["modify_existing"], { undoes: exploredAct }));
        }
        case "undo":
          return send("trial.clean", call("trial.clean", "core.test_subflow", resubmitted ?? candidate!));
        case "trial.clean":
          if (ranTrial()) return send("trial.after", call("trial.after", "core.test_subflow", resubmitted ?? candidate!));
          return done();
        default:
          return done();
      }
    };
    const provider = bindScriptedProvider(installed, { task: TASK, permitted: ["modify_existing"], instructionSourceId: build.instructionSourceId, maxIterations: 24, maxCallsPerRun: 36, builder });
    const { ending, failure } = await build.run();
    const coded = (callId: string) => answers[callId]?.code ?? answers[callId]?.verdict ?? (answers[callId]?.ok === true ? "ok" : undefined);
    const diagnostic = { ending, failure, builderStep: provider.builderSteps(), sent, destinationReference, baseline, afterTest, exploredAct, candidate, resubmitted, clicks, answers, tests, reads: observed.reads, declarations: observed.declarations, outcomes: observed.outcomes, receipts: provider.receipts, gatewayErrors: installed.gatewayErrors, pages };
    await keepDiagnostic(testInfo, "reset-job-unexplored.json", diagnostic);
    console.log(JSON.stringify({ resetDiagnostic: { ending, failure, sent, codes: Object.fromEntries(sent.map(callId => [callId, coded(callId) ?? null])), failed: answers["trial.unexplored"]?.failed ?? null, canMeet: answers["trial.unexplored"]?.canMeet ?? null, unexploredClicks: clicks["trial.unexplored"], tests: tests.map(entry => [entry.call, trialCode(entry.answer)]) } }));

    // My jobs is a plain list read complete: its ref issued.
    expect(destinationReference).toMatch(/^destination-[1-9][0-9]{0,3}$/u);
    // The Flow with the unexplored save step is accepted as a revision: submission itself never refuses for a witness.
    expect(candidate?.revision).toBe(1);

    // 1. Its test is refused unrun: the lasting step carries no witness, and the call that can meet it is on another page.
    const unexplored = answers["trial.unexplored"];
    expect(unexplored?.ok).toBe(false);
    expect(unexplored?.code).toBe("candidate.trial_step_unwitnessed");
    expect(unexplored?.failed).toBe("no_witness");
    expect(unexplored?.canMeet).toBe("another_page");
    const unwitnessed = list(unexplored?.stepsUnwitnessed);
    expect(unwitnessed).toHaveLength(1);
    expect([unwitnessed[0]?.step, unwitnessed[0]?.label]).toEqual(expect.arrayContaining([expect.stringMatching(new RegExp(`^(?:${SAVE_STEP}|${SAVE_LABEL})$`, "u"))]));
    // Nothing ran: no trial run id, no step, no act left, and My jobs reads exactly as the build found it. (A trial's
    // own presses do not pass through the instrumented runtime, so its click count alone could not show this.)
    expect(clicks["trial.unexplored"]?.after).toBe(clicks["trial.unexplored"]?.before);
    expect(unexplored?.trialRunId).toBeUndefined();
    expect(feedbackSteps(unexplored)).toEqual([]);
    expect(actsUnder(unexplored, "leftOnSite")).toEqual([]);
    expect(baseline).toMatch(/^[a-f0-9]{20}$/u);
    expect(afterTest).toBe(baseline);

    // 2. The heart pressed once while exploring, naming the My jobs ref: admitted and landed (the board fails the
    // first save of a page load, so the press is made again).
    const save = observed.declarations.filter(declaration => declaration.call === "save.explored");
    expect(save.map(declaration => [declaration.consequences, declaration.permitted])).toEqual([[["modify_existing"], true]]);
    expect(answers["save.explored"]?.ok).toBe(true);
    expect(answers["save.explored"]?.status).toBe("succeeded");
    // The same Flow text, submitted again, is a new revision: the explored act now lends its step a witness.
    expect(resubmitted?.revision).toBe(2);
    // The refused test recorded no act, so the explored save is the build's first.
    const named: NamedAct[] = tests.flatMap(entry => [...actsUnder(entry.answer, "actsToUndo"), ...actsUnder(entry.answer, "leftOnSite"), ...startedWithActs(entry.answer)]);
    const exploredNamed = named.filter(act => act.call === "save.explored");
    if (exploredNamed.length) expect(new Set(exploredNamed.map(act => act.act))).toEqual(new Set(["act-1"]));

    // 3. Once the explored save is settled the trial runs and answers yes; its save step succeeded.
    const ran = tests.find(entry => trialCode(entry.answer) === "yes");
    expect(ran?.call).toMatch(/^trial\.(?:explored|clean)$/u);
    expect(ran?.answer.trialRunId).toMatch(/^trial\./u);
    expect(feedbackSteps(ran?.answer).some(step => step.label === SAVE_LABEL && step.status === "succeeded")).toBe(true);
    // It did not start with the explored save still open.
    expect(actsUnder(ran?.answer, "actsToUndo").some(act => act.call === "save.explored")).toBe(false);
    // Its own save is left on the site, with a settle naming My jobs.
    const after = tests.find(entry => entry.call === "trial.after")?.answer;
    const trialActs = [...actsUnder(ran?.answer, "leftOnSite"), ...actsUnder(after, "actsToUndo")].filter(act => act.call === undefined && /^trial step \d+ /u.test(act.did));
    expect(trialActs.length).toBeGreaterThanOrEqual(1);
    expect(trialActs.some(act => (act.settle ?? "").includes(myJobs))).toBe(true);
  } finally {
    await build.stop();
    await installed.close();
  }
});
