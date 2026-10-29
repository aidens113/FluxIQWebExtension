import type { JsonObject } from "fluxiq/core";
import { postingById } from "../../../../../../scenario-lab/src/scenarios/job-board/catalog/index.js";
import { viewJobHref } from "../../../../../../scenario-lab/src/scenarios/job-board/board/index.js";
import { expect, test } from "../../../../fixtures/extension-context";
import { bindScriptedProvider, keepDiagnostic, pageHandleWhere, projectBuild, startInstalledBuild, trialCode, type BuilderTurn, type ScriptedAnswer } from "../../../index";
import { actsWithOutcome, judgeLog, retiredCodesIn, supervisorWithEffect } from "../../../change-proof";
import { bindDetectingRuntime } from "../../../photo-build";

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const TASK = "Save one job to my saved jobs, then read my saved jobs.";
/** A job nobody saved: exploration saves it and leaves it saved. */
const TARGET = postingById("g1");
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};

/**
 * Job-board save then read, judged with no reset (t775). Exploration saves the job and leaves it saved. The Flow
 * (open the job, save it, open My jobs, read the list) is tested twice, the second time as a changed revision. Both
 * trials begin with the job saved (by exploration, then still), so Core's `ensureState` on the save step, tied to the
 * explored press and its class-state toggle signature (the heart's name never flips), skips it `already_in_state`, the
 * read returns the saved rows, and each judge request's `siteChange` lists the skipped save with its pass. The builder
 * never undoes anything and no retired reset code appears in the step log.
 */
test("installed gateway project build judges a save then read by the change, with the save skipped already in state", async ({ extensionSession }, testInfo) => {
  test.setTimeout(420_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const myJobs = new URL("/scenarios/job-board/myjobs", installed.origin).href;
  const viewJob = new URL(viewJobHref(TARGET), installed.origin).href;
  const build = projectBuild(installed, "Installed change job save then read", TASK, viewJob);
  const judge = judgeLog();
  const pages: Record<string, string> = {};
  const answers: Record<string, JsonObject> = {};
  let destinationReference = "", heartHandle = "", detected = "", rowColumn = "";
  try {
    await page.goto(new URL("/scenarios/job-board/", installed.origin).href);
    await page.getByRole("button", { name: "Accept all", exact: true }).click();
    await page.locator("rf-assistant .fa-min").waitFor({ timeout: 9000 });
    await page.locator("rf-assistant .fa-min").click();
    await page.goto(viewJob);
    await installed.pair();
    const observed = bindDetectingRuntime(installed);
    let pending = "";
    const send = (callId: string, made: ScriptedAnswer) => {
      pending = callId;
      return made;
    };
    const flow = (second: boolean) => [`flow: Save job`, `step open: open the job`, `  node: web.browser-navigate`, `  url: ${JSON.stringify(viewJob)}`,
      `step save: save the job`, `  node: web.dom.click`, `  target: ${heartHandle}`, `  consequences: modify_existing`,
      `step saved: open my saved jobs`, `  node: web.browser-navigate`, `  url: ${JSON.stringify(myJobs)}`,
      `step read: read my saved jobs`, `  node: web.dom.extract_list`, `  extractList: ${JSON.stringify({ handle: detected, fields: { title: rowColumn } })}`,
      ...(second ? [`step check: look at my saved jobs`, `  node: web.dom.capture_snapshot`] : [])].join("\n");
    const builder = (turn: BuilderTurn) => {
      const { last, node, call } = turn;
      pages[`step-${turn.step}`] = turn.shownPage();
      if (pending) {
        answers[pending] = record([...turn.evidence].reverse().find(entry => entry.callId === pending)?.value);
        pending = "";
      }
      if (turn.step === 1) return send("saved.original", node("saved.original", "web.output.browser-navigate", { url: myJobs }));
      if (turn.step === 2) {
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
        return send("save", node("save", "web.output.dom-click", { target: { handle: heartHandle } }, ["modify_existing"], { resetDestination: destinationReference }));
      }
      // The saved list as exploration left it, read once so the Flow's read can name its rows.
      if (turn.step === 4) return send("saved.look", node("saved.look", "web.output.browser-navigate", { url: myJobs }));
      if (turn.step === 5) {
        // The saved list, detected from the saved job's title link as the page view shows it (the Unsave button is no list cell).
        detected = pageHandleWhere(turn.shownPage(), new RegExp(`^t\\d+ (?:h[1-6] )?link ${escaped(JSON.stringify(TARGET.title))}`, "u")) ?? "";
        if (!detected) throw new Error("diagnostic.saved_title_missing");
        return send("detect", call("detect", "web.detect_repeating_structure", { target: detected }));
      }
      if (turn.step === 6) {
        const packet = answers["detect"];
        detected = typeof packet?.extraction === "string" ? packet.extraction : "";
        const field = (Array.isArray(packet?.fields) ? packet.fields as JsonObject[] : []).find(entry => typeof entry.key === "string");
        rowColumn = typeof field?.key === "string" ? field.key : "";
        if (!detected || !rowColumn) throw new Error("diagnostic.saved_list_not_detected");
        return send("submit", call("submit", "core.submit_subflow", { flow: flow(false) }));
      }
      const submitted = answers["submit"];
      if (typeof submitted?.revision !== "number" || typeof submitted.digest !== "string") throw new Error("diagnostic.submission_refused");
      const candidate = { revision: submitted.revision, digest: submitted.digest };
      if (turn.step === 7) return send("trial.first", call("trial.first", "core.test_subflow", candidate));
      if (turn.step === 8) return send("submit.second", call("submit.second", "core.submit_subflow", { flow: flow(true) }));
      const second = answers["submit.second"];
      if (typeof second?.revision !== "number" || typeof second.digest !== "string") throw new Error("diagnostic.second_submission_refused");
      const next = { revision: second.revision, digest: second.digest };
      if (turn.step === 9) return send("trial.second", call("trial.second", "core.test_subflow", next));
      return turn.complete({ subflowKey: "main", ...next });
    };
    const provider = bindScriptedProvider(installed, {
      task: TASK, permitted: ["modify_existing"], instructionSourceId: build.instructionSourceId, maxIterations: 24, maxCallsPerRun: 36, builder, verify: judge.verify,
      supervisor: supervisorWithEffect({ permitted: ["modify_existing"], maxIterations: 24, effect: { kind: "end_state", state: "the job is on my saved jobs" } })
    });
    const { ending, failure } = await build.run();
    const siteChanges = judge.siteChanges();
    const retired = retiredCodesIn(answers, observed.outcomes, provider.receipts, failure);
    await keepDiagnostic(testInfo, "change-job-save-then-read.json", { ending, failure, answers, retired, siteChanges, outcomes: observed.outcomes, receipts: provider.receipts, pages });

    // No retired reset code anywhere in the step log, no undo named, and every judge request carries the site's change.
    expect(retired).toEqual([]);
    expect(observed.declarations.filter(declaration => declaration.call.startsWith("undo"))).toEqual([]);
    expect([trialCode(answers["trial.first"]), trialCode(answers["trial.second"])]).toEqual(["yes", "yes"]);
    expect(judge.requests.length).toBeGreaterThanOrEqual(2);
    for (const siteChange of siteChanges) expect(siteChange).toBeDefined();
    // Each trial began with the job saved: its save step is skipped already in state, with its pass, and never pressed
    // (a press would unsave it: the toggle's second press).
    expect(siteChanges).toHaveLength(2);
    for (const siteChange of siteChanges) expect(actsWithOutcome(siteChange, "already_in_state").length).toBeGreaterThanOrEqual(1);
    for (const siteChange of siteChanges) expect(actsWithOutcome(siteChange, "changed")).toEqual([]);
    // The read returned the saved rows (at least the job the build saved).
    expect(observed.reads.some(read => read.location?.includes("/job-board/myjobs") === true && read.sizes.some(size => size >= 3))).toBe(true);
  } finally {
    await build.stop();
    await installed.close();
  }
});
