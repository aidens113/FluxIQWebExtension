import type { JsonObject } from "fluxiq/core";
import { STUDIO, gridFor } from "../../../../scenario-lab/src/scenarios/photo-social/data/index.js";
import { expect, test } from "../../fixtures/extension-context";
import { bindScriptedProvider, keepDiagnostic, projectBuild, startInstalledBuild, type BuilderTurn, type ScriptedAnswer } from "../index";
import { offlineFirstVerify, twoPartPlan, type OfflineFirstJudged } from "../offline-first-build";
import { PHOTO_ROOT, bindDetectingRuntime, gridCellHandle, gridColumns, openPhotoProfile } from "../photo-build";
import type { SupervisorTurn } from "../scripted-provider";

const OPEN = "Open the studio's profile";
const LIST = "list the first twenty-four post links in its grid, in grid order as relative URL paths";
const TASK = `${OPEN} and ${LIST}.`;
/** The studio's first grid tile: the grid is detected from it. */
const FIRST = gridFor(STUDIO)[0]!;
/** Core's refusal of a whole test while the failing step has not passed a from-step run (`subflow-trial-gate.ts`). */
const FROM_STEP_FIRST = "subflow.trial_from_step_first";
/** An address the site has no page at: the part's second step goes there and fails. */
const WRONG_PATH = `${PHOTO_ROOT}no-such-page/`;
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
const text = (value: unknown): string => JSON.stringify(value ?? null);

/**
 * t804 acceptance, photo-social: Core's repair-from-step rule through the real
 * subflow trial gate and ports, headed and provider-free. The second subflow,
 * `posts`, has two steps: `first` reads the studio's grid, and `second` reads
 * a missing page address at `second`, so it fails there.
 *
 * 1. The first whole test fails at `second`: its answer names that step.
 * 2. A second whole test at once is refused `subflow.trial_from_step_first`
 *    naming `second`; no command reaches the site for it.
 * 3. The build repairs live on `second` from the page the test left (the right
 *    profile address), submits the fix, and runs `core.test_subflow` with
 *    `from:` the step key the refusal names: only that step runs (no arrival, no reset, no judge),
 *    and the answer says `fromStep: true`.
 * 4. One whole test of the latest revision passes, judged yes, and the brief
 *    Core completes on it without another provider decision.
 *
 * Whole runs are counted (2) and from-step runs (1) and printed.
 */
test("installed gateway project build repairs a failed step by running from it before another whole test", async ({ extensionSession }, testInfo) => {
  test.setTimeout(420_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const profile = new URL(`${PHOTO_ROOT}${STUDIO}/`, installed.origin).href;
  const build = projectBuild(installed, "Installed repair from step photo", TASK);
  const pages: Record<string, string> = {};
  const answers: Record<string, JsonObject> = {};
  const sent: string[] = [];
  const judged: OfflineFirstJudged[] = [];
  /** Commands that reached the site during each scripted call, by call id. */
  const siteActs: Record<string, string[] | number> = {};
  let testing = "", brief = "", handle = "";
  let columns: { link?: string; pin?: string } = {};
  const completions: Array<{ brief: string; after: string }> = [];
  const dispatches: Record<string, JsonObject> = {};
  let coreCompletions = 0;
  const { automationStudioActivityHub } = await import("fluxiq/automation-studio");
  const unsubscribe = automationStudioActivityHub.subscribe(event => {
    if (event.detail?.text?.includes("Core finished this part of the task because the latest version passed its test, so nothing was left to decide.")) coreCompletions++;
  });
  try {
    await openPhotoProfile(page, installed.origin, profile);
    await installed.pair();
    bindDetectingRuntime(installed);
    const openFlow = () => ["flow: Open the profile", "part open: open the studio's profile", "  step profile: open the profile", "    node: web.browser.navigate", `    url: ${JSON.stringify(profile)}`, "end"].join("\n");
    /** `posts`: `first` reads the grid; `second` goes to `address`, the step the repair changes. */
    const postsFlow = (address: string) => [
      "flow: Post links",
      "part posts: list the links of the posts",
      "  step first: read the posts' links",
      "    node: web.dom.extract_list",
      `    extractList: ${JSON.stringify({ handle, fields: { link: columns.link } })}`,
      `    recordOutput: ${JSON.stringify({ datasetId: "post-links", writeMode: "replace" })}`,
      "  step second: go back to the studio's profile",
      "    node: web.browser.navigate",
      `    url: ${JSON.stringify(address)}`,
      "end"
    ].join("\n");
    let pending = "";
    const send = (callId: string, made: ScriptedAnswer) => {
      pending = callId;
      sent.push(callId);
      return made;
    };
    const supervisor = (turn: SupervisorTurn): ScriptedAnswer => {
      const assembled = record(turn.last("project.assemble")?.complete);
      if (turn.step === 3 || turn.step === 4) {
        const key = turn.step === 3 ? "open" : "posts";
        const returned = record((turn.last("project.dispatch")?.returns as unknown[] | undefined)?.[0]);
        dispatches[key] = returned;
        if (returned.outcome === "done") completions.push({ brief: key, after: key === "open" ? "open.test" : "test-3" });
        const from = siteActs[pending];
        if (typeof from === "number") siteActs[pending] = installed.siteCommands().slice(from);
      }
      switch (turn.step) {
        case 1:
          return turn.call("plan", "project.write_plan", twoPartPlan(turn.plan(), [
            { key: "open", name: "Open the profile", quote: OPEN, goal: "The studio's profile is open" },
            { key: "posts", name: "Post links", quote: LIST, goal: "The links of the studio's posts are listed" }
          ]));
        case 2:
          brief = "open";
          pending = "";
          return turn.call("dispatch.open", "project.dispatch", { reason: "Build the first subflow.", briefs: [{ kind: "build", subflowKey: "open", parts: ["p1"], entry: { caseId: "observed-current", predecessors: [] }, permittedActs: [], maxIterations: 8 }] });
        case 3:
          brief = "posts";
          pending = "";
          return turn.call("dispatch.posts", "project.dispatch", { reason: "Build the second subflow.", briefs: [{ kind: "build", subflowKey: "posts", parts: ["p2"], entry: { caseId: "observed-current", predecessors: ["open"] }, permittedActs: [], maxIterations: 24 }] });
        case 4:
          return turn.call("assemble", "project.assemble", {});
        case 5:
          testing = "whole";
          return turn.call("whole", "core.test_candidate", assembled);
        default:
          completions.push({ brief: "supervisor", after: String(turn.last("core.test_candidate")?.verdict ?? "none") });
          return turn.complete(assembled);
      }
    };
    const builder = (turn: BuilderTurn): ScriptedAnswer => {
      const { node, call } = turn;
      pages[`${brief}-step-${turn.step}`] = turn.shownPage();
      const previous = pending;
      if (pending) {
        answers[pending] = record([...turn.evidence].reverse().find(entry => entry.callId === pending)?.value);
        const from = siteActs[pending];
        if (typeof from === "number") siteActs[pending] = installed.siteCommands().slice(from);
        pending = "";
      }
      const submitted = (callId: string) => {
        const value = answers[callId];
        if (typeof value?.revision !== "number" || typeof value.digest !== "string") throw new Error(`diagnostic.submission_refused:${callId}:${text(value).slice(0, 600)}`);
        return { revision: value.revision, digest: value.digest };
      };
      const acting = (callId: string, made: () => ScriptedAnswer) => {
        siteActs[callId] = installed.siteCommands().length;
        return send(callId, made());
      };
      const gridCell = (view: string) => {
        const cell = gridCellHandle(view, FIRST.code);
        if (!cell) throw new Error("diagnostic.grid_cell_missing");
        return cell;
      };
      if (brief === "open") {
        switch (previous) {
          case "":
            return send("open.profile", node("open.profile", "web.output.browser-navigate", { url: profile }));
          case "open.profile":
            return send("open.submit", call("open.submit", "core.submit_subflow", { flow: openFlow() }));
          case "open.submit":
            testing = "open";
            return send("open.test", call("open.test", "core.test_subflow", submitted("open.submit")));
          default:
            throw new Error("diagnostic.provider_asked_after_open_yes");
        }
      }
      switch (previous) {
        case "":
          return send("profile", node("profile", "web.output.browser-navigate", { url: profile }));
        case "profile":
          return send("detect", call("detect", "web.detect_repeating_structure", { target: gridCell(turn.shownPage()) }));
        case "detect": {
          const packet = answers["detect"];
          handle = typeof packet?.extraction === "string" ? packet.extraction : "";
          columns = gridColumns(packet);
          if (!handle || !columns.link || !columns.pin) throw new Error("diagnostic.grid_undetected");
          return send("read", node("read", "web.output.dom-extract_list", { extractList: { handle, fields: { link: columns.link } } }));
        }
        case "read":
          return send("submit-1", call("submit-1", "core.submit_subflow", { flow: postsFlow(new URL(WRONG_PATH, installed.origin).href) }));
        case "submit-1":
          // 1. The judged whole test: it fails at `second`.
          testing = "posts-1";
          return acting("test-1", () => call("test-1", "core.test_subflow", submitted("submit-1")));
        case "test-1":
          // 2. Another whole test of the same revision at once: refused, nothing runs on the site.
          return acting("test-2", () => call("test-2", "core.test_subflow", submitted("submit-1")));
        case "test-2":
          // 3. The repair is made live from the page the failed test left: the right address is tried there.
          return send("repair", node("repair", "web.output.browser-navigate", { url: profile }));
        case "repair":
          return send("submit-2", call("submit-2", "core.submit_subflow", { flow: postsFlow(profile) }));
        case "submit-2":
          // The step key Core named in its refusal, as a model reading that refusal sends it (the plan's key, not the script's label).
          return acting("from-step", () => call("from-step", "core.test_subflow", { ...submitted("submit-2"), from: String(answers["test-2"]?.repairStep ?? "") }));
        case "from-step":
          // 4. One judged whole test of the latest revision.
          testing = "posts-2";
          return acting("test-3", () => call("test-3", "core.test_subflow", submitted("submit-2")));
        default:
          throw new Error("diagnostic.provider_asked_after_posts_yes");
      }
    };
    const verify = offlineFirstVerify(() => testing, judged, { yes: "The links of the studio's posts were listed.", no: () => undefined });
    const provider = bindScriptedProvider(installed, { task: TASK, permitted: [], instructionSourceId: build.instructionSourceId, maxIterations: 24, maxCallsPerRun: 80, builder, supervisor, verify });
    const { ending, failure } = await build.run();

    // Core completes on the yes before another provider decision. Read that final receipt from its dispatch return.
    const trials = dispatches.posts?.trialsAnswered as JsonObject[] | undefined;
    const first = answers["test-1"] ?? {}, refused = answers["test-2"] ?? {}, fromStep = answers["from-step"] ?? {}, passing = [...(trials ?? [])].reverse().find(trial => trial.verdict === "yes") ?? {};
    /** A `posts` test call that ran as a whole test, passed or failed: it carries a verdict, and is neither a refusal nor a from-step run. */
    const wholeRuns = [first, refused, passing].filter(answer => answer.code !== FROM_STEP_FIRST && answer.fromStep !== true && answer.verdict !== undefined);
    const fromStepRuns = ["test-1", "test-2", "from-step", "test-3"].filter(callId => answers[callId]?.fromStep === true);
    const counts = { wholeRuns: wholeRuns.length, fromStepRuns: fromStepRuns.length };
    const summary = { ending, failure, counts, completions, coreCompletions, dispatches, sent, siteActs, first, refused, fromStep, passing, submissions: ["submit-1", "submit-2"].map(callId => ({ callId, revision: answers[callId]?.revision ?? null, ok: answers[callId]?.ok ?? null, code: answers[callId]?.code ?? null })), judged, supervisorSteps: provider.supervisorSteps(), builderSteps: provider.builderSteps(), gatewayErrors: installed.gatewayErrors };
    await keepDiagnostic(testInfo, "photo-repair-from-step.json", { ...summary, answers, pages });
    console.log(JSON.stringify({ repairFromStepCounts: counts }));
    console.log(JSON.stringify({ repairFromStepDiagnostic: { ending, failure, completions, sent, siteActs, judged, first: text(first).slice(0, 1500), refused: text(refused).slice(0, 1500), fromStep: text(fromStep).slice(0, 1500), passing: text(passing).slice(0, 600) } }));

    expect(ending).toBe("proposed");
    expect(failure).toEqual({});
    const readRows = record(answers["read"]?.read).extracted;
    const expectedRows = gridFor(STUDIO).slice(0, 24).map(post => ({ link: `${PHOTO_ROOT}p/${post.code}/` }));
    expect(expectedRows).toHaveLength(24);
    expect(Array.isArray(readRows)).toBe(true);
    expect(readRows).toEqual(expectedRows);
    // 1. The first whole test failed at the part's second step, and its answer names it.
    expect(first.verdict).toBe("execution_failed");
    expect(record(record(first.feedback).stoppedBy).label).toBe("go back to the studio's profile");
    expect(first.fromStep).toBeUndefined();
    // 2. The second whole test is refused, names that step by its plan key and its words, and sent nothing to the site.
    expect(refused.ok).toBe(false);
    expect(refused.code).toBe(FROM_STEP_FIRST);
    const repairStep = String(refused.repairStep);
    expect(repairStep).toMatch(/^s\d+$/u);
    expect(text(refused)).toContain("go back to the studio's profile");
    expect(siteActs["test-2"]).toEqual([]);
    // 3. The from-step run: only the failing step, flagged, never judged.
    expect(fromStep.fromStep).toBe(true);
    expect(fromStep.passed).toBe(true);
    expect(fromStep.from).toBe(repairStep);
    expect(fromStep.passedKeys).toEqual([repairStep]);
    const wholeCommands = siteActs["test-1"], fromCommands = siteActs["from-step"];
    if (!Array.isArray(wholeCommands) || !Array.isArray(fromCommands)) throw new Error("diagnostic.site_commands_missing");
    expect(fromCommands.length).toBeGreaterThan(0);
    expect(fromCommands.length).toBeLessThan(wholeCommands.length);
    // Only the failing step's own command: the grid read of `first` is not sent again.
    expect(fromCommands.some(type => /extract_list/u.test(type))).toBe(false);
    expect(judged.filter(call => call.label === "posts-1")).toEqual([]);
    // 4. One judged whole test passes; the brief completes on that revision.
    expect(passing.verdict).toBe("yes");
    expect(passing.fromStep).toBeUndefined();
    // Core confirms a lone yes with a second ask before completing, so the judged test may be asked twice; every answer is yes.
    const judgedPassing = judged.filter(call => call.label === "posts-2");
    expect(judgedPassing.length).toBeGreaterThan(0);
    expect(judgedPassing.every(call => call.answersRequest === "yes")).toBe(true);
    expect(completions).toContainEqual({ brief: "posts", after: "test-3" });
    expect(coreCompletions).toBe(2);
    expect(counts).toEqual({ wholeRuns: 2, fromStepRuns: 1 });
  } finally {
    unsubscribe();
    await build.stop();
    await installed.close();
  }
});
