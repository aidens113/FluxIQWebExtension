import type { JsonObject } from "fluxiq/core";
import { postingById } from "../../../../scenario-lab/src/scenarios/job-board/catalog/index.js";
import { viewJobHref } from "../../../../scenario-lab/src/scenarios/job-board/board/index.js";
import { expect, test } from "../../fixtures/extension-context";
import { bindInstrumentedRuntime, bindScriptedProvider, keepDiagnostic, pageHandleWhere, projectBuild, startInstalledBuild, trialCode, type BuilderTurn, type ScriptedAnswer } from "../index";
import type { SupervisorTurn } from "../scripted-provider";

const TASK = "Open the job board's saved jobs page and look at the jobs saved there.";
/** The job whose page the Flow opens. */
const TARGET = postingById("g1");
/** A job already on the saved list (`job-board/state.ts`, `ALREADY_SAVED`): its title link is on My jobs and nowhere on TARGET's page. */
const HELD = postingById("hv2");
/** Core's own title for a build the supervisor ended blocked (`service/project-build/run.ts`, `ENDED_WORDS.blocked`). */
const ENDED_BLOCKED = "FluxIQ could not finish the Flow.";
/** Core's refusal of an ending while a failed subflow has had no changed brief (`supervisor/completion.ts`, t743). */
const REPAIR_FIRST = "project.completion_repair_first";
/** Where the loop shows a refused completion (`llm/evidence-loop/completion-check.ts`). */
const COMPLETION_CHECK = "core.completion_check";
/** The supervisor's own words for each ending: plain, no codes, so the build's ending can be told from a guard's. */
const FIRST_ENDING = "The saved job could not be opened from the job's own page.";
const SECOND_ENDING = "The saved job still could not be opened from the job's own page after one more try.";
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
const firstReturn = (answer: JsonObject | undefined): JsonObject => record((answer?.returns as unknown[] | undefined)?.[0]);

/** One event of Core's activity stream, as much of it as this proof reads. */
type ActivityEvent = { label?: string; subject?: { projectId?: string }; detail?: { title?: string; text?: string; status?: string } };

/**
 * Subscribes to Core's activity stream: the chat's rows, where Core says why a build ended (`service/project-build/run.ts`,
 * `ENDED_WORDS`). A kept draft is not promoted, so the build's run resolves and only this row and the build record say who
 * ended it; the record is not on the public surface. The hub is Core's public one (`fluxiq/automation-studio`), the same
 * module instance the running Core publishes to.
 */
async function subscribeActivity(listener: (event: ActivityEvent) => void): Promise<() => void> {
  const { automationStudioActivityHub } = await import("fluxiq/automation-studio");
  return automationStudioActivityHub.subscribe((event) => listener(event as ActivityEvent));
}

/**
 * Rerun round 4 (photo; social, job and office earlier): the supervisor ended
 * the build right after one failed brief, with most of its money left. t743
 * c3 added `project.completion_repair_first`: with money and at least three
 * supervisor turns left, an ending is refused once per failed subflow until it
 * has had one changed brief (a repair, or a brief under an amended plan),
 * unless its return carries a closed `terminalReason`.
 *
 * Read-only task on the job board. The scripted supervisor writes a one-part
 * plan and sends one build brief. Its builder looks at My jobs, then submits a
 * Flow that opens TARGET's page and clicks HELD's title link, a link only My
 * jobs has, so its subflow trial really fails; the builder ends blocked with
 * that trial listed. The supervisor ends blocked: refused repair-first, naming
 * the subflow and the failing brief. It sends a repair naming that trial; its
 * builder (Core refuses a builder's ending before it tries anything) submits
 * the same Flow, tests it, and ends blocked again. The supervisor ends again: accepted, and the
 * build ends with the supervisor's own reason, not a guard's.
 */
test("installed gateway project build refuses an ending after one failed brief until a repair has been sent", async ({ extensionSession }, testInfo) => {
  test.setTimeout(420_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const myJobs = new URL("/scenarios/job-board/myjobs", installed.origin).href;
  const viewJob = new URL(viewJobHref(TARGET), installed.origin).href;
  const build = projectBuild(installed, "Installed reset repair first", TASK);
  /** Each dispatch's answer and each completion refusal, in the order the supervisor saw them. */
  const dispatches: JsonObject[] = [];
  const refusals: Array<{ step: number; callId: string; value: JsonObject }> = [];
  /** What each brief's builder did, by brief and step. */
  const builderLog: Array<{ brief: number; step: number; answered: unknown; code: unknown; did: string }> = [];
  const tests: Array<{ brief: number; value: JsonObject }> = [];
  const submissions: Array<{ brief: number; value: JsonObject }> = [];
  const pages: Record<string, string> = {};
  let brief = 0, briefStep = 0, heldLink = "";
  let repairSent: JsonObject | undefined;
  /** What the build's run resolved with, by its keys and status only. */
  let resolved: JsonObject | undefined;
  const generate = installed.service.generateFlowBootstrapAdaptation.bind(installed.service);
  installed.service.generateFlowBootstrapAdaptation = (async (...args: Parameters<typeof generate>) => {
    const value = await generate(...args);
    resolved = record(value);
    return value;
  }) as typeof installed.service.generateFlowBootstrapAdaptation;
  const activity: ActivityEvent[] = [];
  const unsubscribe = await subscribeActivity(event => { activity.push(event); });
  try {
    await page.goto(new URL("/scenarios/job-board/", installed.origin).href);
    await page.getByRole("button", { name: "Accept all", exact: true }).click();
    await page.locator("rf-assistant .fa-min").waitFor({ timeout: 9000 });
    await page.locator("rf-assistant .fa-min").click();
    await page.goto(viewJob);
    await installed.pair();
    const observed = bindInstrumentedRuntime(installed);
    /** The Flow both builders submit: it opens TARGET's page and clicks HELD's title link, which only My jobs has. */
    const failingFlow = () => [`flow: Saved job`, `step open: open the job's page`, `  node: web.browser-navigate`, `  url: ${JSON.stringify(viewJob)}`,
      `step saved: open the saved job`, `  node: web.dom.click`, `  target: ${heldLink}`, `  consequences: none`].join("\n");
    const supervisor = (turn: SupervisorTurn): ScriptedAnswer => {
      // Every refusal of a supervisor ending, whatever its code, the first turn it was shown.
      for (const entry of turn.evidence) {
        if (entry.toolId !== COMPLETION_CHECK || refusals.some(seen => seen.callId === entry.callId)) continue;
        refusals.push({ step: turn.step, callId: entry.callId, value: entry.value });
      }
      if (turn.step === 1) {
        const plan = turn.plan();
        const parts = (record(plan.taskSpec).parts as JsonObject[]).map(part => ({ ...part, goalFacts: ["The jobs on the saved jobs page were looked at"] }));
        return turn.call("plan", "project.write_plan", { ...plan, taskSpec: { ...record(plan.taskSpec), parts }, subflows: [{ key: "main", name: "Saved jobs", parts: ["p1"] }] });
      }
      const buildBrief = { kind: "build", subflowKey: "main", parts: ["p1"], entry: { caseId: "observed-current", predecessors: [] }, permittedActs: [], maxIterations: 12 };
      if (turn.step === 2) {
        brief = 1;
        briefStep = 0;
        return turn.call("dispatch.build", "project.dispatch", { reason: "Build the subflow.", briefs: [buildBrief] });
      }
      if (turn.step === 3) {
        dispatches.push(record(turn.last("project.dispatch")));
        return turn.complete({ ended: "blocked", reason: FIRST_ENDING });
      }
      if (turn.step === 4) {
        const returned = firstReturn(dispatches[0]);
        const trials = (returned.trials as JsonObject[] | undefined) ?? [];
        const failingReceipt = record(record(returned.repairFrom).failingReceipt).receiptId ? record(record(returned.repairFrom).failingReceipt) : trials.at(-1);
        if (!failingReceipt) throw new Error("diagnostic.no_trial_listed");
        repairSent = failingReceipt;
        brief = 2;
        briefStep = 0;
        const repair = { kind: "repair", subflowKey: "main", parts: ["p1"], entry: { caseId: "observed-current", predecessors: [] }, permittedActs: [], maxIterations: 12, failingReceipt };
        return turn.call("dispatch.repair", "project.dispatch", { reason: "Repair the subflow from the trial that failed.", briefs: [repair] });
      }
      if (turn.step === 5) dispatches.push(record(turn.last("project.dispatch")));
      return turn.complete({ ended: "blocked", reason: SECOND_ENDING });
    };
    const builder = (turn: BuilderTurn): ScriptedAnswer => {
      briefStep++;
      const previous = [...turn.evidence].reverse().find(entry => !["core.budget", "core.route_state", "core.evidence_history"].includes(entry.toolId));
      const log = (did: string) => builderLog.push({ brief, step: briefStep, answered: previous?.toolId ?? null, code: previous?.value.code ?? previous?.value.verdict ?? null, did });
      pages[`brief-${brief}-step-${briefStep}`] = turn.shownPage();
      const submitted = () => {
        const value = turn.last("core.submit_subflow");
        if (typeof value?.revision !== "number" || typeof value.digest !== "string") throw new Error("diagnostic.submission_refused");
        return { revision: value.revision, digest: value.digest };
      };
      if (brief === 1) {
        if (briefStep === 1) {
          log("look at My jobs");
          return turn.node("saved", "web.output.browser-navigate", { url: myJobs });
        }
        if (briefStep === 2) {
          // HELD's title link, as the page view shows it on My jobs: a link TARGET's page does not have.
          const found = pageHandleWhere(turn.shownPage(), new RegExp(`^t\\d+ (?:h[1-6] )?link ${JSON.stringify(HELD.title).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`, "u"));
          if (!found) throw new Error("diagnostic.held_link_missing");
          heldLink = found;
          log("back to the job's page");
          return turn.node("job", "web.output.browser-navigate", { url: viewJob });
        }
        if (briefStep === 3) {
          log("submit a Flow whose click has no target on its page");
          return turn.call("submit.build", "core.submit_subflow", { flow: failingFlow() });
        }
        if (briefStep === 4) {
          submissions.push({ brief, value: record(turn.last("core.submit_subflow")) });
          log("test it");
          return turn.call("trial.build", "core.test_subflow", submitted());
        }
        tests.push({ brief, value: record(turn.last("core.test_subflow")) });
        log("end blocked");
        return turn.complete({ ended: "blocked", reason: "The saved job's link is not on the job's own page, so the Flow cannot open it." });
      }
      // The repair: Core refuses a builder's ending before it has tried anything (`subflow.ending_too_soon`), so it submits
      // the same Flow, tests it once, and ends blocked.
      if (briefStep === 1) {
        log("submit the same Flow");
        return turn.call("submit.repair", "core.submit_subflow", { flow: failingFlow() });
      }
      if (briefStep === 2) {
        submissions.push({ brief, value: record(turn.last("core.submit_subflow")) });
        log("test it");
        return turn.call("trial.repair", "core.test_subflow", submitted());
      }
      tests.push({ brief, value: record(turn.last("core.test_subflow")) });
      log("end blocked");
      return turn.complete({ ended: "blocked", reason: "The saved job's link is still not on the job's own page." });
    };
    const provider = bindScriptedProvider(installed, { task: TASK, permitted: [], instructionSourceId: build.instructionSourceId, maxIterations: 12, maxCallsPerRun: 40, builder, supervisor });
    const { ending, failure } = await build.run();

    const own = activity.filter(event => event.subject?.projectId === resolved?.projectId);
    const endedRows = own.filter(event => event.label === ENDED_BLOCKED || event.detail?.title === ENDED_BLOCKED).map(event => ({ status: event.detail?.status ?? null, text: event.detail?.text ?? "" }));
    const sent = dispatches.map(firstReturn);
    const repairRefusals = refusals.filter(entry => entry.value.code === REPAIR_FIRST);
    const summary = {
      ending, failure, status: resolved?.status ?? null, activity: own.length, endedRows: endedRows.map(row => ({ status: row.status, bySupervisor: row.text.includes("still could not be opened") })), supervisorSteps: provider.supervisorSteps(), builderSteps: provider.builderSteps(),
      briefs: sent.map(returned => ({ briefId: returned.briefId ?? null, kind: returned.kind ?? null, outcome: returned.outcome ?? null, trials: Array.isArray(returned.trials) ? returned.trials.length : null, terminalReason: returned.terminalReason ?? null })),
      refusals: refusals.map(entry => ({ step: entry.step, code: entry.value.code ?? null, unrepaired: entry.value.unrepaired ?? null })),
      tests: tests.map(entry => ({ brief: entry.brief, verdict: trialCode(entry.value) ?? null })),
      supervisorReceipts: provider.receipts
    };
    await keepDiagnostic(testInfo, "reset-repair-first.json", { ...summary, endedRows, resolved, heldLink, repairSent, dispatches, refusalValues: refusals, builderLog, submissions, tests, outcomes: observed.outcomes, gatewayErrors: installed.gatewayErrors, pages });
    console.log(JSON.stringify({ resetDiagnostic: summary }));

    // Brief 1 was a build: its trial really failed, and it came back blocked with that trial listed.
    expect(heldLink).toMatch(/^t\d+$/u);
    expect(tests[0]?.brief).toBe(1);
    expect(trialCode(tests[0]?.value)).not.toBe("yes");
    expect(sent[0]?.kind).toBe("build");
    expect(sent[0]?.outcome).toBe("blocked");
    expect((sent[0]?.trials as unknown[] | undefined)?.length).toBeGreaterThanOrEqual(1);
    expect(sent[0]?.terminalReason).toBeUndefined();
    // The supervisor's first ending was refused repair-first, once, naming the subflow and the failing brief.
    expect(repairRefusals).toHaveLength(1);
    expect(repairRefusals[0]!.step).toBe(4);
    expect(repairRefusals[0]!.value.unrepaired).toEqual([{ subflowKey: "main", failingBrief: sent[0]!.briefId }]);
    // The repair named that trial, and its builder ended blocked again.
    expect(sent[1]?.kind).toBe("repair");
    expect(sent[1]?.subflowKey).toBe("main");
    expect(sent[1]?.outcome).toBe("blocked");
    const listed = ((sent[0]?.trials as JsonObject[] | undefined) ?? []).map(trial => trial.receiptId);
    expect(listed).toContain(repairSent?.receiptId);
    // Two briefs in all, a build then a repair, and no other refusal of any supervisor decision.
    expect(sent.map(returned => returned.kind)).toEqual(["build", "repair"]);
    expect(refusals.map(entry => entry.value.code)).toEqual([REPAIR_FIRST]);
    // The second ending was accepted (no sixth supervisor decision), and Core's one ended row says the supervisor's second
    // reason, not a guard's.
    expect(provider.supervisorSteps()).toBe(5);
    expect(own.length).toBeGreaterThan(0);
    expect(endedRows).toHaveLength(1);
    expect(endedRows[0]!.status).toBe("failed");
    expect(endedRows[0]!.text).toContain("still could not be opened from the job's own page after one more try");
    expect(endedRows[0]!.text).not.toContain(FIRST_ENDING.slice(0, -1));
    // The build kept its draft and promoted nothing: the run resolves, with no failure.
    expect(ending).toBe("proposed");
    expect(failure).toEqual({});
    expect(resolved?.status).toBe("draft");
    expect(resolved?.promotionAllowed).toBe(false);
    expect(provider.builderSteps()).toBe(8);
  } finally {
    unsubscribe();
    await build.stop();
    await installed.close();
  }
});
