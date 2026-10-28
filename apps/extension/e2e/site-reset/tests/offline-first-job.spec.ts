import type { JsonObject } from "fluxiq/core";
import { postingById } from "../../../../scenario-lab/src/scenarios/job-board/catalog/index.js";
import { expect, test } from "../../fixtures/extension-context";
import { bindScriptedProvider, keepDiagnostic, pageHandleWhere, projectBuild, readStepLog, startInstalledBuild, useOfflineTrialEnvironment, type BuilderTurn, type ScriptedAnswer } from "../index";
import { offlineFirstProof, offlineFirstVerify, twoPartPlan, type OfflineFirstJudged } from "../offline-first-build";
import { bindDetectingRuntime, detectedColumns } from "../photo-build";
import type { SupervisorTurn } from "../scripted-provider";

const OPEN = "Open the job board's saved jobs page";
const LIST = "list the title of every job saved there";
const TASK = `${OPEN} and ${LIST}.`;
/** The jobs already on the saved list (`job-board/state.ts`, `ALREADY_SAVED`): the answer is both titles. */
const SAVED = [postingById("hv2"), postingById("px")];
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/**
 * Trace plan P6 acceptance (t769 B14), job-board: a headed, provider-free
 * project build whose repair iteration is checked offline, against the
 * recording of the build's own last live test, and whose final judged run runs
 * live on the site.
 *
 * Why two subflows. On a plan of one subflow the builder's test is the plan's
 * judged whole run (Core `project-agents/single-subflow/whole-test-port.ts`),
 * and a project build's judged whole run is never offline-first (P6 D40). So
 * the plan has two: `open` (open My jobs) and `titles` (read the saved list,
 * after `open`). `titles`' tests are partial trials, which are offline-first;
 * the build's final judged run is the supervisor's whole test of the assembled
 * Flow (`project.assemble`, `core.test_candidate`), live.
 *
 * Read-only task. `open`'s builder submits one navigation and tests it live
 * (no recording yet). `titles`' builder detects the saved list from a saved
 * job's title link, reads it once, then submits three revisions of one read
 * that differ only in what Core computes from the rows the read answered: the
 * record output's `process` (tier 1, computation only, so the read the page
 * is sent is the same and the recording can answer it).
 *
 * 1. Revision 1 keeps the row titled like the second saved job (a `where`
 *    condition): one row of two. Tested live, as no recording of `titles`
 *    exists yet; the judge says no, naming the first saved job as missing.
 * 2. Revision 2 keeps the row titled like the first saved job instead: still
 *    one row, the judge naming the second as missing. Tested offline against revision 1's recording;
 *    the judge says no on the recording, and the no is kept: no reset folder,
 *    nothing done on the site, `checkedAgainst: "recorded_run"`.
 * 3. Revision 3 keeps every row (no `process`). Tested offline first: it
 *    passes on the recording, then, in the same call, the site is reset and
 *    the revision runs live; the judge says yes.
 *
 * Then the supervisor assembles the Flow and tests it whole, live, after a
 * reset: the judge says yes, and only then does the build complete. The
 * scripted judge answers by what is under test, so it answers the offline
 * judge calls too. Everything is asserted from Core's step log.
 */
test("installed gateway project build checks a computation-only repair offline against the last live test and judges the final run live", async ({ extensionSession }, testInfo) => {
  test.setTimeout(420_000);
  const stepsDirectory = testInfo.outputPath("steps");
  const restoreEnvironment = useOfflineTrialEnvironment(stepsDirectory);
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const myJobs = new URL("/scenarios/job-board/myjobs", installed.origin).href;
  const build = projectBuild(installed, "Installed offline-first job", TASK);
  const pages: Record<string, string> = {};
  /** Each scripted call's own answer, by call id. */
  const answers: Record<string, JsonObject> = {};
  const sent: string[] = [];
  const judged: OfflineFirstJudged[] = [];
  /** How many commands reached the site during each `titles` test (each command's action type), by its call id. */
  const siteActs: Record<string, string[] | number> = {};
  /** What the judge was first shown about each thing under test, for the diagnostic file only. */
  const shownBy: Record<string, string> = {};
  /** What is under test now, for the scripted judge: `open`, `titles-N`, or `whole`. */
  let testing = "", brief = "", handle = "", title = "";
  let resolved: JsonObject | undefined;
  const completions: Array<{ brief: string; after: string }> = [];
  const generate = installed.service.generateFlowBootstrapAdaptation.bind(installed.service);
  installed.service.generateFlowBootstrapAdaptation = (async (...args: Parameters<typeof generate>) => {
    const value = await generate(...args);
    resolved = record(value);
    return value;
  }) as typeof installed.service.generateFlowBootstrapAdaptation;
  try {
    await page.goto(new URL("/scenarios/job-board/", installed.origin).href);
    await page.getByRole("button", { name: "Accept all", exact: true }).click();
    await page.locator("rf-assistant .fa-min").waitFor({ timeout: 9000 });
    await page.locator("rf-assistant .fa-min").click();
    await installed.pair();
    const observed = bindDetectingRuntime(installed);
    // Each subflow is callable (a plan of two), so its steps are written inside its own `part <key>:` block.
    const openFlow = () => ["flow: Open saved jobs", "part open: open the saved jobs page", "  step saved: open the saved jobs page", "    node: web.browser.navigate", `    url: ${JSON.stringify(myJobs)}`, "end"].join("\n");
    /** `titles`' Flow at each revision: one read, its record output's `process` alone differing. */
    const titlesFlow = (process: JsonObject | undefined) => [
      "flow: Saved job titles",
      "part titles: read the saved jobs' titles",
      "  step read: read the saved jobs' titles",
      "    node: web.dom.extract_list",
      `    extractList: ${JSON.stringify({ handle, fields: { title } })}`,
      `    recordOutput: ${JSON.stringify({ datasetId: "saved-job-titles", writeMode: "replace", ...(process ? { process } : {}) })}`,
      "end"
    ].join("\n");
    // Revisions 1 and 2 each keep one saved job of two, by a condition on its title; revision 3 keeps both.
    const revisions: Array<JsonObject | undefined> = [{ where: [{ field: "title", contains: SAVED[1]!.title }] }, { where: [{ field: "title", contains: SAVED[0]!.title }] }, undefined];
    /** The saved job each failing revision leaves out, which its judge's no names. */
    const missing: Record<string, string> = { "titles-1": SAVED[0]!.title, "titles-2": SAVED[1]!.title };
    let pending = "";
    const send = (callId: string, made: ScriptedAnswer) => {
      pending = callId;
      sent.push(callId);
      return made;
    };
    const supervisor = (turn: SupervisorTurn): ScriptedAnswer => {
      const assembled = record(turn.last("project.assemble")?.complete);
      switch (turn.step) {
        case 1:
          return turn.call("plan", "project.write_plan", twoPartPlan(turn.plan(), [
            { key: "open", name: "Open saved jobs", quote: OPEN, goal: "The saved jobs page is open" },
            { key: "titles", name: "Saved job titles", quote: LIST, goal: "Every saved job's title is listed" }
          ]));
        case 2:
          brief = "open";
          pending = "";
          return turn.call("dispatch.open", "project.dispatch", { reason: "Build the first subflow.", briefs: [{ kind: "build", subflowKey: "open", parts: ["p1"], entry: { caseId: "observed-current", predecessors: [] }, permittedActs: [], maxIterations: 8 }] });
        case 3:
          brief = "titles";
          pending = "";
          return turn.call("dispatch.titles", "project.dispatch", { reason: "Build the second subflow.", briefs: [{ kind: "build", subflowKey: "titles", parts: ["p2"], entry: { caseId: "observed-current", predecessors: ["open"] }, permittedActs: [], maxIterations: 16 }] });
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
        if (typeof value?.revision !== "number" || typeof value.digest !== "string") throw new Error(`diagnostic.submission_refused:${callId}`);
        return { revision: value.revision, digest: value.digest };
      };
      const done = (callId: string) => {
        completions.push({ brief, after: previous });
        return turn.complete({ subflowKey: brief, ...submitted(callId) });
      };
      if (brief === "open") {
        switch (previous) {
          case "":
            return send("open.saved", node("open.saved", "web.output.browser-navigate", { url: myJobs }));
          case "open.saved":
            return send("open.submit", call("open.submit", "core.submit_subflow", { flow: openFlow() }));
          case "open.submit":
            testing = "open";
            return send("open.test", call("open.test", "core.test_subflow", submitted("open.submit")));
          default:
            return done("open.submit");
        }
      }
      switch (previous) {
        case "":
          return send("saved", node("saved", "web.output.browser-navigate", { url: myJobs }));
        case "saved": {
          // The saved list, detected from a saved job's title link as the page view shows it.
          const cell = SAVED.map(job => pageHandleWhere(turn.shownPage(), new RegExp(`^t\\d+ (?:h[1-6] )?link ${escaped(JSON.stringify(job.title))}`, "u"))).find(Boolean);
          if (!cell) throw new Error("diagnostic.saved_title_missing");
          return send("detect", call("detect", "web.detect_repeating_structure", { target: cell }));
        }
        case "detect": {
          const packet = answers["detect"];
          handle = typeof packet?.extraction === "string" ? packet.extraction : "";
          const columns = detectedColumns(packet);
          const titles = new Set(SAVED.map(job => job.title));
          title = (columns.find(column => titles.has(column.sample ?? "")) ?? columns.find(column => column.kind === "text") ?? columns[0])?.key ?? "";
          if (!handle || !title) throw new Error("diagnostic.saved_list_undetected");
          // One read of the list, as the Flow reads it.
          return send("read", node("read", "web.output.dom-extract_list", { extractList: { handle, fields: { title } } }));
        }
        case "read":
          return send("submit-1", call("submit-1", "core.submit_subflow", { flow: titlesFlow(revisions[0]) }));
        case "submit-1":
          testing = "titles-1";
          siteActs["test-1"] = installed.siteCommands().length;
          return send("test-1", call("test-1", "core.test_subflow", submitted("submit-1")));
        case "test-1":
          return send("submit-2", call("submit-2", "core.submit_subflow", { flow: titlesFlow(revisions[1]) }));
        case "submit-2":
          testing = "titles-2";
          siteActs["test-2"] = installed.siteCommands().length;
          return send("test-2", call("test-2", "core.test_subflow", submitted("submit-2")));
        case "test-2":
          return send("submit-3", call("submit-3", "core.submit_subflow", { flow: titlesFlow(revisions[2]) }));
        case "submit-3":
          testing = "titles-3";
          siteActs["test-3"] = installed.siteCommands().length;
          return send("test-3", call("test-3", "core.test_subflow", submitted("submit-3")));
        default:
          return done("submit-3");
      }
    };
    // `titles` revisions 1 and 2 keep one saved job of two: no. Everything else answers the request: yes.
    const verify = offlineFirstVerify(() => testing, judged, {
      yes: "Every saved job's title was listed.",
      no: (label) => missing[label] === undefined ? undefined : {
        expected: "Every saved job's title is listed.",
        observed: `Only one of the two saved jobs' titles was listed: "${missing[label]}" is missing; the read's condition left it out.`,
        changed: "Remove the read's condition on the title, so every saved job's row is kept.",
        defects: [{ kind: "asked_missing", row: missing[label]!, requestWords: LIST }]
      }
    }, shownBy);
    const provider = bindScriptedProvider(installed, { task: TASK, permitted: [], instructionSourceId: build.instructionSourceId, maxIterations: 16, maxCallsPerRun: 60, builder, supervisor, verify });
    const { ending, failure } = await build.run();

    const proof = offlineFirstProof(await readStepLog(stepsDirectory));
    const tests = ["test-1", "test-2", "test-3"].map(callId => answers[callId]);
    const summary = {
      ending, failure, status: resolved?.status ?? null, sent, completions, siteActs, judged: proof.judgedRuns(judged),
      supervisorSteps: provider.supervisorSteps(), builderSteps: provider.builderSteps(), supervisorReceipts: provider.receipts,
      submissions: ["open.submit", "submit-1", "submit-2", "submit-3"].map(callId => ({ callId, revision: answers[callId]?.revision ?? null, ok: answers[callId]?.ok ?? null, code: answers[callId]?.code ?? null })),
      tests: ["open.test", "test-1", "test-2", "test-3"].map(callId => ({ callId, ...proof.testShape(answers[callId]) })),
      steps: proof.listing
    };
    await keepDiagnostic(testInfo, "offline-first-job.json", { ...summary, resolved, answers, shownBy, outcomes: observed.outcomes, gatewayErrors: installed.gatewayErrors, pages });
    console.log(JSON.stringify({ offlineFirstDiagnostic: summary }));

    proof.assertAcceptance({ ending, failure, resolved, open: answers["open.test"], tests, judged, completions, subflow: "titles", siteActs: ["test-1", "test-2", "test-3"].map(callId => siteActs[callId]).map(sent => Array.isArray(sent) ? sent : undefined) });
  } finally {
    await build.stop();
    await installed.close();
    restoreEnvironment();
  }
});
