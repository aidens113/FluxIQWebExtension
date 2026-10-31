import type { JsonObject } from "fluxiq/core";
import { STUDIO, gridFor } from "../../../../scenario-lab/src/scenarios/photo-social/data/index.js";
import { expect, test } from "../../fixtures/extension-context";
import { actsWithOutcome, ensureStatesIn, judgeLog } from "../change-proof";
import { bindInstrumentedRuntime, bindScriptedProvider, handleBefore, keepDiagnostic, startInstalledBuild, trialCode, type BuilderTurn } from "../index";
import { photoObstructionVerifier, photoProjectBuild } from "./photo-first-row-toggle/index";

const TASK = "Open one post, then open the studio's other post and like it.";
const ROOT = "/scenarios/photo-social/";
const GRID = gridFor(STUDIO);
/** The post the build likes, and the one whose dialog the Flow opens first and so stands over the grid when the liked post's cell is pressed. */
const LIKED = GRID.find(post => !post.pinned)!;
const COVERING = GRID[GRID.indexOf(LIKED) + 1]!;
/** The post's own Like, drawn by its labelled graphic, as the page shows it once the post is liked. */
const POST_SHOWS_UNLIKE = `article section > [role="button"]:has(> svg[aria-label="Unlike"])`;
/** A trial's own steps: its first is the entry's arrival at the start location (no label); the Flow's own steps are the labelled ones. */
const labelledSteps = (trial: JsonObject | undefined): JsonObject[] => list(record(trial?.feedback).steps).filter(step => step.label !== undefined);
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
const list = (value: unknown): JsonObject[] => Array.isArray(value) ? value.map(record) : [];
/** The text of a judge request around the first handler node it shows (the Flow's plan as the judge was shown it), or none. */
const handlerSlice = (request: string): string | null => {
  const at = request.indexOf("control.handler");
  return at < 0 ? null : request.slice(Math.max(0, at - 300), at + 2500);
};

type ActivityEvent = { label?: string; nodeId?: string; subject?: { projectId?: string }; detail?: { kind?: string; title?: string; text?: string; status?: string; recovery?: JsonObject } };
/** Core's activity stream: the chat's rows (`runtime/activity`). */
async function subscribeActivity(listener: (event: ActivityEvent) => void): Promise<() => void> {
  const { automationStudioActivityHub } = await import("fluxiq/automation-studio");
  return automationStudioActivityHub.subscribe(event => listener(event as ActivityEvent));
}

/** Every `clearedLayers` and `obstruction` value anywhere in a client answer, reduced to the keys present and the kind: no page text. */
function layersIn(value: unknown, path = "$"): Array<{ path: string; keys: string[]; kind?: unknown; hasControlRef?: boolean; ways?: unknown }> {
  if (Array.isArray(value)) return value.flatMap((item, index) => layersIn(item, `${path}[${index}]`));
  if (typeof value !== "object" || value === null) return [];
  const found: Array<{ path: string; keys: string[]; kind?: unknown; hasControlRef?: boolean; ways?: unknown }> = [];
  for (const [key, inner] of Object.entries(value as JsonObject)) {
    if (key === "clearedLayers" && Array.isArray(inner)) {
      for (const layer of inner.map(record)) found.push({ path: `${path}.clearedLayers`, keys: Object.keys(layer), kind: layer.kind, hasControlRef: layer.controlRef !== undefined, ways: layer.wayOutDefinitionId });
    } else if (key === "obstruction" && typeof inner === "object" && inner !== null) {
      const obstruction = record(inner);
      found.push({ path: `${path}.obstruction`, keys: Object.keys(obstruction), kind: obstruction.kind, ways: list(obstruction.dismiss).map(way => [way.intent, way.definitionId, way.controlRef !== undefined]) });
    } else found.push(...layersIn(inner, `${path}.${key}`));
  }
  return found;
}

/**
 * t799 / W6 headed proof, provider-free, on photo-social.
 *
 * (b) Idempotent like. The build likes a post in its dialog and explicitly copies that press's observed state into the
 * Flow's `ensureState`, so the first trial, run over the post already liked, skips the step `already_in_state` and the post still
 * shows Unlike afterwards. Every judge request names the step's `ensureState`.
 *
 * (a) Layers closed while a trial runs. photo-social has no layer the client leaves standing over a press: its in-page
 * defence closes the post dialog, the consent overlay and the upsell itself (the run-opened rule spares only a layer tied
 * to the pressed control by containment, `aria-controls` or `aria-expanded`, and none of these is), so the client never
 * reports `obstruction` and Core's `clear_interference` rung is not reached on this site. What this spec proves is the
 * nearest path: a trial meets the first post's dialog over the grid when it presses the next cell and, once the Lab is
 * put back to a first visit, the named consent overlay; the client closes each and reports the overlay with its `id`
 * and `controlRef`, and the activity shows the interference rows as recoveries that succeeded and no failed card.
 * learns that close as a `trial_close` handler on the `obstruction` fact (asserted from the Flow the judge is shown after trial 2).
 * The scripted verifier deliberately returns unsure for the first two completed trials, then verifies the final one.
 * Before every answer it independently asserts the actual liked post; this is controlled provider-free uncertainty,
 * not a failed site execution or evidence about a historical model. The first confirmed yes completes normally.
 */
test("installed gateway project build: layers over a press are closed in the run without a failed card, and a like over a liked post stays liked", async ({ extensionSession }, testInfo) => {
  test.setTimeout(420_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const profile = new URL(`${ROOT}${STUDIO}/`, installed.origin).href;
  const build = photoProjectBuild(installed, "Installed obstruction photo", TASK);
  const pages: Record<string, string> = {};
  const tests: JsonObject[] = [];
  const judge = judgeLog();
  const verifier = photoObstructionVerifier(installed, judge, LIKED.code, POST_SHOWS_UNLIKE);
  const activity: ActivityEvent[] = [];
  const unsubscribe = await subscribeActivity(event => { activity.push(event); });
  let coveringCell = "", likedCell = "", likeHandle = "";
  let selectedState: JsonObject = {};
  let refusedSubmission: JsonObject = {};
  const submissions: JsonObject[] = [];
  let postShowsUnlikeAfterSkip = false;
  const layerReports: Array<{ action: string; found: unknown[] }> = [];
  try {
    await page.goto(new URL(ROOT, installed.origin).href);
    await page.getByTestId("cookie-policy-manage-dialog-decline-button").click();
    await page.getByRole("button", { name: "Not Now", exact: true }).click();
    await page.goto(profile);
    await page.locator(`fl-dock [part="collapse-button"]`).waitFor({ timeout: 9000 });
    await page.locator(`fl-dock [part="collapse-button"]`).click();
    await installed.pair();
    const observed = bindInstrumentedRuntime(installed);
    // What the client answered each press with, as far as layers go: the cleared layers and the obstruction, by their keys and kinds.
    const gateway = installed.fluxiq.programs.automationStudioClientGateway;
    const executeAction = gateway.executeAction.bind(gateway);
    gateway.executeAction = (async (...args: Parameters<typeof executeAction>) => {
      const answer = await executeAction(...args);
      const found = layersIn(answer);
      if (found.length) layerReports.push({ action: String(record(args[1]).actionType ?? ""), found });
      return answer;
    }) as typeof gateway.executeAction;
    const cellOf = (view: string, code: string) => view.split("\n").find(line => /^t\d+ link /u.test(line) && line.endsWith(` ~/p/${code}/`))?.split(" ")[0];
    const builder = async (turn: BuilderTurn) => {
      const { node, call } = turn;
      pages[`step-${turn.step}`] = turn.shownPage();
      if (turn.step === 1) return node("profile", "web.output.browser-navigate", { url: profile });
      if (turn.step === 2) {
        const liked = cellOf(turn.shownPage(), LIKED.code), covering = cellOf(turn.shownPage(), COVERING.code);
        if (!liked || !covering) throw new Error("diagnostic.grid_cell_missing");
        likedCell = liked;
        coveringCell = covering;
        return node("open.post", "web.output.dom-click", { target: { handle: liked } });
      }
      if (turn.step === 3) {
        await page.getByRole("dialog").waitFor({ timeout: 6000 });
        return node("dialog.look", "web.output.dom-capture_snapshot", {});
      }
      if (turn.step === 4) {
        likeHandle = handleBefore(turn.shownPage(), "Like", "Comment");
        return node("like", "web.output.dom-click", { target: { handle: likeHandle } }, ["modify_existing"]);
      }
      if (turn.step === 5) {
        selectedState = record(record(turn.last("core.run_node")?.toggle).signature);
        if (!Object.keys(selectedState).length) throw new Error("diagnostic.observed_toggle_state_missing");
      }
      const flow = (looks: number) => [
        `flow: Cover and like`,
        `step profile: open the profile`, `  node: web.browser-navigate`, `  url: ${JSON.stringify(profile)}`,
        `step first: open the other post`, `  node: web.dom.click`, `  target: ${coveringCell}`, `  consequences: none`,
        `step post: open the post`, `  node: web.dom.click`, `  target: ${likedCell}`, `  consequences: none`,
        `step like: like the post`, `  node: web.dom.click`, `  target: ${likeHandle}`, `  consequences: modify_existing`, `  ensureState: ${JSON.stringify(selectedState)}`,
        ...Array.from({ length: looks }, (_, index) => [`step check${index + 1}: look at the post`, `  node: web.dom.capture_snapshot`]).flat()
      ].join("\n");
      if (turn.step === 5) return call("submit", "core.submit_subflow", { flow: flow(0) });
      const submitted = record(turn.last("core.submit_subflow"));
      if (typeof submitted.revision !== "number" || typeof submitted.digest !== "string") {
        refusedSubmission = submitted;
        throw new Error("diagnostic.submission_refused");
      }
      if (turn.step <= 7) submissions.push(submitted);
      if (turn.step === 6) {
        verifier.request("first");
        return call("trial", "core.test_subflow", { revision: submitted.revision, digest: submitted.digest });
      }
      if (turn.step === 7) {
        tests.push(record(turn.last("core.test_subflow")));
        postShowsUnlikeAfterSkip = await page.locator(POST_SHOWS_UNLIKE).first().isVisible();
        // The site is a first visit again (consent unanswered, nothing liked): the next trial meets the consent layer, and the
        // client closes it while it runs.
        await installed.resetLab();
        return call("submit.again", "core.submit_subflow", { flow: flow(1) });
      }
      submissions.push(submitted);
      const again = { revision: submitted.revision, digest: submitted.digest };
      if (turn.step === 8) {
        verifier.request("second");
        return call("trial.again", "core.test_subflow", again);
      }
      if (turn.step === 9) {
        tests.push(record(turn.last("core.test_subflow")));
        return call("submit.last", "core.submit_subflow", { flow: flow(2) });
      }
      submissions.push(submitted);
      const last = { revision: submitted.revision, digest: submitted.digest };
      if (turn.step === 10) {
        verifier.request("final");
        return call("trial.last", "core.test_subflow", last);
      }
      throw new Error("diagnostic.confirmed_trial_did_not_complete_brief");
    };
    const provider = bindScriptedProvider(installed, { task: TASK, permitted: ["modify_existing"], instructionSourceId: build.instructionSourceId, maxIterations: 24, maxCallsPerRun: 36, builder, verify: verifier.verify });
    verifier.restoreBinding();
    const { ending, failure } = await build.run();
    const finalTrial = ending === "proposed" ? build.finalTrial() : undefined;
    const finalSession = finalTrial ? await build.finalSession() : undefined;
    const diagnostic = { ending, failure, builderStep: provider.builderSteps(), tests, finalTrial, finalTrace: finalSession?.trace, verifierChecks: verifier.checks, submissions, layerReports, handlerSlices: judge.requests.map(handlerSlice), refusedSubmission, siteChanges: judge.siteChanges(), ensureStates: judge.requests.map(ensureStatesIn), activity: activity.map(event => ({ label: event.label, nodeId: event.nodeId, detail: event.detail })), declarations: observed.declarations, outcomes: observed.outcomes, receipts: provider.receipts, gatewayErrors: installed.gatewayErrors, siteCommands: installed.siteCommands(), pages };
    await keepDiagnostic(testInfo, "obstruction-toggle.json", diagnostic);
    console.log(JSON.stringify({ obstructionDiagnostic: { ending, failure, tests: [...tests.map(trialCode), finalTrial?.verdict] } }));
    expect(ending).toBe("proposed");
    expect([...tests.map(trialCode), finalTrial?.verdict]).toEqual(["unsure", "unsure", "yes"]);
    expect(finalTrial?.runId).toBeTruthy();
    expect(finalSession?.status).toBe("succeeded");
    expect([...new Set(verifier.checks.map(check => check.trial))]).toEqual(["first", "second", "final"]);
    // (b) Trial 1 ran over the post the build had liked: the like step is skipped already in state, never pressed, and the post still shows Unlike.
    const first = labelledSteps(tests[0]);
    expect(first.map(step => step.status)).toEqual(["succeeded", "succeeded", "succeeded", "succeeded"]);
    expect(first[3]?.skipped).toBe("Its control already showed the asked state, so it was not pressed.");
    expect(first.slice(0, 3).map(step => typeof step.skipped)).toEqual(["undefined", "undefined", "undefined"]);
    expect(actsWithOutcome(judge.siteChanges()[0], "already_in_state")).toHaveLength(1);
    expect(postShowsUnlikeAfterSkip).toBe(true);
    // The like step carries Core's ensureState in every trial's judge request.
    expect(judge.requests.length).toBeGreaterThanOrEqual(3);
    for (const request of judge.requests) expect(ensureStatesIn(request).length).toBeGreaterThan(0);
    // Trial 3 runs after trial 2 liked the post, so it is skipped already in state again.
    const finalSkipped = finalSession?.trace?.attempts.filter(attempt => attempt.definitionId === "web.output.dom-click" && attempt.skipped?.reason === "already_in_state");
    expect(finalSkipped).toHaveLength(1);
    const skippedResult = record(record(finalSkipped?.[0]?.outputs.result).result);
    expect(skippedResult.actionType).toBe("web.dom.click");
    expect(skippedResult.url).toBe(new URL(`${ROOT}p/${LIKED.code}/`, installed.origin).href);
    // (a) The trial that met the dialog over the grid, and the one that met the consent overlay, closed them in the run.
    const interruptions = (trial: JsonObject | undefined) => labelledSteps(trial).flatMap(step => list(step.interruptions)).map(entry => entry.kind);
    expect(interruptions(tests[0])).toEqual(["other"]);
    expect(interruptions(tests[1]).sort()).toEqual(["other", "overlay"]);
    const rows = activity.map(event => event.label ?? "");
    expect(rows.filter(row => row === "Recovered: Closed a dialog the page put in the way")).toHaveLength(3);
    expect(rows.filter(row => row === "Recovered: Closed something the page put over itself")).toHaveLength(1);
    const failedRows = activity.filter(event => event.detail?.status === "failed" || /didn't work/iu.test(`${event.label ?? ""} ${event.detail?.title ?? ""}`));
    const uncertainRows = [
      { label: "Couldn't confirm the result answers the request", kind: "check", title: "Result check" },
      { label: "Couldn't confirm the whole Flow's test", kind: "note", title: "Couldn't confirm the whole Flow's test" },
      { label: "Testing one part of the Flow — didn't pass", kind: "tool", title: "Testing one part of the Flow" }
    ].map(row => ({ ...row, status: "failed", nodeId: undefined, recovery: undefined }));
    expect(failedRows.map(event => ({ label: event.label, kind: event.detail?.kind, title: event.detail?.title,
      status: event.detail?.status, nodeId: event.nodeId, recovery: event.detail?.recovery }))).toEqual([...uncertainRows, ...uncertainRows]);
    expect(failedRows.filter(event => event.nodeId !== undefined || event.detail?.recovery !== undefined)).toEqual([]);
    for (const event of failedRows.filter(event => event.detail?.kind === "tool")) expect(event.detail?.text).toContain("subflow.trial_unsure");
    expect(activity.filter(event => event.detail?.recovery?.kind === "interference").map(event => event.detail?.recovery?.outcome)).toEqual(["succeeded", "succeeded", "succeeded", "succeeded"]);
    // Core learned trial 2's close of the named consent overlay as a handler: the Flow the judge was shown after it (the
    // requests of trial 3) holds a `builtin.control.handler` waiting for the `obstruction` fact on the overlay's name, whose press
    // is the click on the decline control the client reported; the earlier trials' Flows hold none.
    expect(judge.requests).toHaveLength(verifier.checks.length);
    const earlierRequests = judge.requests.filter((_request, index) => verifier.checks[index]?.trial !== "final");
    const finalRequests = judge.requests.filter((_request, index) => verifier.checks[index]?.trial === "final");
    expect(earlierRequests.map(handlerSlice)).toEqual(earlierRequests.map(() => null));
    expect(finalRequests).toHaveLength(2);
    for (const request of finalRequests) {
      const shown = request.replaceAll(String.raw`\"`, `"`);
      expect(shown).toContain(`"definitionId":"builtin.control.handler"`);
      expect(shown).toContain(`"fact":"obstruction","op":"visible","value":"Allow the use of cookies from Framelight on this browser?"`);
      expect(shown).toContain(`"definitionId":"web.output.dom-click","label":"Close what covered the page"`);
      expect(shown).toContain(`"testId":"cookie-policy-manage-dialog-decline-button"`);
      expect(shown).toContain(`"definitionId":"builtin.control.handler-end"`);
    }
    // Trial 3 did not meet the overlay (trial 2 had answered consent), so it shows no handler press: only the dialog over the grid was closed, by the defence.
    expect(rows.filter(row => /Close what covered the page/u.test(row))).toEqual([]);
    // The client reported each closed layer with a durable id and control (CC7); the overlay carries its name. It reported no obstruction here.
    const reported = layerReports.flatMap(report => report.found as Array<{ path: string; keys: string[]; kind?: unknown; hasControlRef?: boolean }>);
    expect(reported.filter(layer => layer.path.endsWith(".obstruction"))).toEqual([]);
    expect(reported.map(layer => [layer.kind, layer.hasControlRef, layer.keys.includes("id")])).toEqual([["other", true, true], ["overlay", true, true], ["other", true, true], ["other", true, true]]);
    expect(reported.find(layer => layer.kind === "overlay")?.keys).toContain("name");
  } finally {
    verifier.restoreBinding();
    unsubscribe();
    await build.stop();
    await installed.close();
  }
});
