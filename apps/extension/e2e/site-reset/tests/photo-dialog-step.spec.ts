import type { JsonObject } from "fluxiq/core";
import { STUDIO, gridFor } from "../../../../scenario-lab/src/scenarios/photo-social/data/index.js";
import { expect, test } from "../../fixtures/extension-context";
import { judgeLog, retiredCodesIn } from "../change-proof";
import { actsUnder, bindInstrumentedRuntime, digest, keepDiagnostic, bindScriptedProvider, handleBefore, projectBuild, startInstalledBuild, startedWithActs, trialCode, type BuilderTurn } from "../index";

const TASK = "Like one post.";
const ROOT = "/scenarios/photo-social/";
/** The studio's grid: its pinned posts first, then the rest newest first. The Flow likes the first unpinned post. */
const GRID = gridFor(STUDIO);
const LIKED = GRID.find(post => !post.pinned)!;
/** The post's own action control `label`: its actions row draws Like, then Comment; every comment carries a Like of its own elsewhere. */
const postActionHandle = (view: string, label: string) => handleBefore(view, label, "Comment");
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
/** The post's own action control drawn by its labelled graphic, as the page shows it in `state`. */
const postShows = (state: "Like" | "Unlike") => `article section > [role="button"]:has(> svg[aria-label="${state}"])`;

/** Every string inside a value, reading JSON text carried inside strings too. */
function textsIn(value: unknown): string[] {
  if (typeof value === "string") {
    if (value.startsWith("{") || value.startsWith("[")) {
      try { return textsIn(JSON.parse(value)); } catch { /* plain text */ }
    }
    return [value];
  }
  if (Array.isArray(value)) return value.flatMap(textsIn);
  if (typeof value === "object" && value !== null) return Object.values(value).flatMap(textsIn);
  return [];
}

/** The first `endView` a judge request carries, anywhere in it: the page view Core took after the Flow's last step. */
function endViewIn(value: unknown): unknown {
  if (typeof value === "string") {
    if (!value.startsWith("{") && !value.startsWith("[")) return undefined;
    try { return endViewIn(JSON.parse(value)); } catch { return undefined; }
  }
  if (Array.isArray(value)) return value.map(endViewIn).find(found => found !== undefined);
  if (typeof value !== "object" || value === null) return undefined;
  const entries = record(value);
  if (entries.endView !== undefined) return entries.endView;
  return Object.values(entries).map(endViewIn).find(found => found !== undefined);
}

/**
 * Where a page view shows the post's own action control in `state` (the control `state` whose next control is Comment,
 * as `postActionHandle` finds it): how many inside a dialog region (`[... dialog tN ...]`, the domain's structure
 * markers) and how many outside one, and whether the view's header names a dialog.
 */
function postActionWhere(view: unknown, state: "Like" | "Unlike"): { inDialog: number; outside: number; dialogHeader: boolean } {
  const lines = textsIn(view).join("\n").split("\n");
  const controls: Array<{ line: string; region: string }> = [];
  let region = "";
  for (const line of lines) {
    if (/^\[[^\]]*\]$/u.test(line.trim())) region = line.trim();
    else if (/^t\d+ /u.test(line)) controls.push({ line, region });
  }
  let inDialog = 0, outside = 0;
  controls.forEach((control, index) => {
    if (!control.line.includes(JSON.stringify(state)) || controls[index + 1]?.line.includes(JSON.stringify("Comment")) !== true) return;
    if (/\bdialog\b/u.test(control.region)) inDialog += 1; else outside += 1;
  });
  return { inDialog, outside, dialogHeader: lines.some(line => line.startsWith("DIALOG")) };
}

/** One candidate node the domain resolved for Core: opaque tokens, counts and codes only, never page words. */
type ObservedResolution = {
  node: string;
  reach: unknown;
  /** How many plan steps Core said stand before this node, or null when it said none. */
  preceding: number | null;
  /** The steps Core said stand before this node: each one's node and the handles its parameters name. */
  precedingSteps: Array<{ node: unknown; handles: string[] }>;
  handles: string[];
  /** The node's written target (a handle, and the page it was written for where one was). */
  target: unknown;
  status: unknown;
  inDialog: boolean;
  selector: string;
  views: Array<{ handle: unknown; view: unknown; location: unknown }>;
};

function observeResolution(input: JsonObject, answer: JsonObject): ObservedResolution {
  const parameters = record(answer.parameters);
  const preceding = input.precedingSteps;
  return {
    node: String(input.nodeDefinitionId),
    reach: input.handleReach ?? null,
    preceding: Array.isArray(preceding) ? preceding.length : null,
    precedingSteps: (Array.isArray(preceding) ? preceding : []).map(record).map(step => ({ node: step.definitionId ?? null, handles: JSON.stringify(step.parameters ?? {}).match(/\bt\d+\b/gu) ?? [] })),
    handles: JSON.stringify(input.parameters ?? {}).match(/\bt\d+\b/gu) ?? [],
    target: record(input.parameters).target ?? null,
    status: answer.status,
    inDialog: typeof record(record(parameters.element).context).dialog === "string",
    selector: digest(parameters.selector ?? null),
    views: (Array.isArray(answer.handleViews) ? answer.handleViews : []).map(record).map(view => ({ handle: view.handle, view: view.view, location: view.location }))
  };
}

/**
 * t748 U1/U1b in the browser: a candidate's step stands where the steps before it left the page.
 *
 * Exploration opens a post's dialog from the profile grid (the press pushes the post's address) and looks at it, then
 * loads that address -- the post's own page, a different document -- and is shown it last. Stable handles give the
 * post's Like one handle in both views. The candidate Flow opens the profile, presses the grid cell, and presses that
 * handle. Before the fix the page kept for the address was the own page's, so the step took the own page's identity
 * (selector under `main`, no dialog) into the dialog and failed `web.target.ambiguous` among the dialog's Likes (t743
 * e3b). Now Core sends each node `precedingSteps`, the domain folds them, and the step resolves to the control inside
 * the dialog the cell's press opened.
 *
 * 1. The like step resolves under `view_history`, told the two steps before it, to a control in a dialog, learned at the
 *    post's address.
 * 2. The trial runs its three steps to the end, and the post's Like inside the dialog is the control it pressed: the page
 *    Core viewed after the Flow's last step (the judge's `endView`) shows the post's Unlike in the dialog. Since t775 Core
 *    then reads the trial's change by loading the like's page, which closes the dialog, so the browser's page after the
 *    trial no longer shows it.
 * 3. The trial's own Like is listed by the ledger (t775: read from its answer to a claim on an unlisted act), put back on
 *    the post's own page under `undoes` (photo-toggle.spec.ts), and the next test is admitted on the restored post and
 *    runs: the build leaves the site as it found it. A repeat of a single-subflow revision whose yes stands is answered
 *    with that judged run and not run again (Core t679), so that test is a changed revision (a trailing look). The like
 *    step's control was never pressed in exploration, so it holds no `ensureState`; a trial run with the trial's like in
 *    place would press it off, so none is run here (photo-toggle.spec.ts proves one).
 */
test("installed gateway project build resolves a candidate's press in the dialog the step before it opened, not on the page shown last at that address", async ({ extensionSession }, testInfo) => {
  test.setTimeout(420_000);
  // Known product defect (t775 H4, defect B): the domain's dialog view keeps only its newest capture's controls
  // (`domain/src/runtime/llm-evidence/plan-resolution/step-views/views.ts`, `captured`). A trial's capture of the dialog
  // with the post liked gives the toggled control another handle, so the builder's current handle for the Like falls out
  // of the dialog view and the step resolves on the own page, `web.target.ambiguous`. Remove this line once it is fixed.
  test.fail(true, "a toggled control's handle drops out of the dialog view after a trial's capture (t775 H4 defect B)");
  const installed = await startInstalledBuild(extensionSession);
  const { page, service } = installed;
  const profile = new URL(`${ROOT}${STUDIO}/`, installed.origin).href;
  const likedPage = new URL(`${ROOT}p/${LIKED.code}/`, installed.origin).href;
  const build = projectBuild(installed, "Installed reset photo dialog step", TASK, () => installed.page.url());
  const pages: Record<string, string> = {};
  /** The newest evidence entries each builder turn was shown: call, tool, and code or verdict. */
  const seen: Record<string, string[]> = {};
  const resolutions: ObservedResolution[] = [];
  let cellHandle = "", likeHandle = "", ownLikeHandle = "", trialAct = "";
  let postShowsLikeAtStart = false, dialogOnOwnPage = -1, postShowsLikeAtEnd = false;
  let dialogLikedAfterTrial = -1, dialogUnlikedAfterTrial = -1, likedAnywhereAfterTrial = -1;
  let clicksBeforeTrialUnlike = 0, clicksAfterTrialUnlike = 0;
  let submission: JsonObject = {}, trialUnlike: JsonObject = {}, actList: JsonObject = {};
  const tests: JsonObject[] = [];
  const judge = judgeLog();
  try {
    // Every candidate node the domain resolves, observed as the domain answered it (the instrumented runtime binds through this).
    const bind = service.bindLlmEvidenceRuntime.bind(service);
    service.bindLlmEvidenceRuntime = runtime => {
      const resolve = runtime.resolvePlanNodeParameters?.bind(runtime);
      if (resolve) runtime.resolvePlanNodeParameters = async input => {
        const answer = await resolve(input);
        resolutions.push(observeResolution(record(input), record(answer)));
        return answer;
      };
      return bind(runtime);
    };
    await page.goto(new URL(ROOT, installed.origin).href);
    await page.getByTestId("cookie-policy-manage-dialog-decline-button").click();
    await page.getByRole("button", { name: "Not Now", exact: true }).click();
    await page.goto(profile);
    await page.locator(`fl-dock [part="collapse-button"]`).waitFor({ timeout: 9000 });
    await page.locator(`fl-dock [part="collapse-button"]`).click();
    await installed.pair();
    const observed = bindInstrumentedRuntime(installed);
    // The Flow likes the post in its dialog over the profile grid, naming the handle the own page showed last; `look` adds a
    // trailing look, a changed revision that runs as a trial of its own (header).
    const flow = (look: boolean) => [
      `flow: Like post`,
      `step profile: open the profile`, `  node: web.browser-navigate`, `  url: ${JSON.stringify(profile)}`,
      `step post: open the post`, `  node: web.dom.click`, `  target: ${cellHandle}`, `  consequences: none`,
      `step like: like the post`, `  node: web.dom.click`, `  target: ${ownLikeHandle}`, `  consequences: modify_existing`,
      ...(look ? [`step check: look at the post`, `  node: web.dom.capture_snapshot`] : [])
    ].join("\n");
    const builder = async (turn: BuilderTurn) => {
      const { last, node, call } = turn;
      pages[`step-${turn.step}`] = turn.shownPage();
      seen[`step-${turn.step}`] = turn.evidence.slice(-4).map(entry => `${entry.callId} ${entry.toolId} ${String(entry.value.code ?? entry.value.verdict ?? entry.value.ok)}`);
      if (turn.step === 1) return node("profile", "web.output.browser-navigate", { url: profile });
      if (turn.step === 2) {
        // The grid cell of the post: the link to its address.
        const cell = turn.shownPage().split("\n").find(line => /^t\d+ link /u.test(line) && line.endsWith(` ~/p/${LIKED.code}/`))?.split(" ")[0];
        if (!cell) throw new Error("diagnostic.grid_cell_missing");
        cellHandle = cell;
        return node("open.post", "web.output.dom-click", { target: { handle: cell } });
      }
      if (turn.step === 3) {
        await page.getByRole("dialog").waitFor({ timeout: 6000 });
        return node("dialog.look", "web.output.dom-capture_snapshot", {});
      }
      if (turn.step === 4) {
        likeHandle = postActionHandle(turn.shownPage(), "Like");
        // The post's own page at the address the dialog pushed: a different document, and the view shown last.
        return node("own.open", "web.output.browser-navigate", { url: likedPage });
      }
      if (turn.step === 5) {
        ownLikeHandle = postActionHandle(turn.shownPage(), "Like");
        postShowsLikeAtStart = await page.locator(postShows("Like")).first().isVisible();
        dialogOnOwnPage = await page.getByRole("dialog").count();
        return call("submit", "core.submit_subflow", { flow: flow(false) });
      }
      const submitted = last("core.submit_subflow");
      submission = record(submitted);
      if (typeof submitted?.revision !== "number" || typeof submitted.digest !== "string") throw new Error("diagnostic.submission_refused");
      const candidate = { revision: submitted.revision, digest: submitted.digest };
      if (turn.step === 6) return call("trial.dialog", "core.test_subflow", candidate);
      if (turn.step === 7) {
        const tested = record(last("core.test_subflow"));
        tests.push(tested);
        // Where the trial's press landed, as the browser now shows it: the post's Like inside the dialog, or elsewhere.
        const dialog = page.getByRole("dialog");
        dialogLikedAfterTrial = await dialog.locator(postShows("Unlike")).count();
        dialogUnlikedAfterTrial = await dialog.locator(postShows("Like")).count();
        likedAnywhereAfterTrial = await page.locator(postShows("Unlike")).count();
        if (trialCode(tested) !== "yes") return turn.complete({ subflowKey: "main", ...candidate });
        // The passing trial left its own Like on the site. The act is read from the refusal of a claim on an unlisted act:
        // the ledger answers with the acts in place (t775: no trial is refused for them).
        return node("act.list", "web.output.browser-navigate", { url: likedPage }, [], { undoes: "act-9999" });
      }
      if (turn.step === 8) {
        actList = record(last("core.run_node"));
        // The trial's like is its step 4: the entry's arrival at the start location is step 1, then the Flow's three steps.
        const act = actsUnder(actList, "actsToUndo").find(entry => entry.call === undefined && /^trial step 4 "like the post"/u.test(entry.did ?? ""))?.act;
        if (!act) return turn.complete({ subflowKey: "main", ...candidate });
        trialAct = act;
        return node("own.again", "web.output.browser-navigate", { url: likedPage });
      }
      if (turn.step === 9) {
        clicksBeforeTrialUnlike = observed.clicks();
        return node("unlike.trial", "web.output.dom-click", { target: { handle: postActionHandle(turn.shownPage(), "Unlike") } }, ["modify_existing"], { undoes: trialAct });
      }
      if (turn.step === 10) {
        trialUnlike = record(last("core.run_node"));
        clicksAfterTrialUnlike = observed.clicks();
        postShowsLikeAtEnd = await page.locator(postShows("Like")).first().isVisible();
        // The trial act is pressed back: a changed revision is tested on the restored post (header).
        return call("submit.final", "core.submit_subflow", { flow: flow(true) });
      }
      if (turn.step === 11) return call("trial.final", "core.test_subflow", candidate);
      if (turn.step === 12) tests.push(record(last("core.test_subflow")));
      return turn.complete({ subflowKey: "main", ...candidate });
    };
    const provider = bindScriptedProvider(installed, { task: TASK, permitted: ["modify_existing"], instructionSourceId: build.instructionSourceId, maxIterations: 24, maxCallsPerRun: 36, builder, verify: judge.verify });
    const { ending, failure } = await build.run();
    const { declarations, reads } = observed;
    // The candidate's like step: resolved for the submission under view_history, naming the shared handle.
    const likeStep = resolutions.find(entry => entry.reach === "view_history" && entry.node === "web.output.dom-click" && entry.handles.includes(ownLikeHandle) && !entry.handles.includes(cellHandle));
    // The first step of a trial is the entry's arrival at the start location (no label); the Flow's own steps are the labelled ones.
    const trialSteps = (((record(tests[0]?.feedback).steps as JsonObject[] | undefined) ?? []).filter(step => step.label !== undefined));
    const ambiguous = JSON.stringify(tests[0] ?? {}).includes("web.target.ambiguous");
    // The page Core viewed after the first trial's last step, as its judge was shown it (header, 2).
    const firstEndView = endViewIn(judge.requests[0]);
    const endUnlike = postActionWhere(firstEndView, "Unlike");
    const endLike = postActionWhere(firstEndView, "Like");
    const afterTrial = { dialogLikedAfterTrial, dialogUnlikedAfterTrial, likedAnywhereAfterTrial, endUnlike, endLike };
    const clicks = { clicksBeforeTrialUnlike, clicksAfterTrialUnlike, end: observed.clicks() };
    const diagnostic = { ending, failure, builderStep: provider.builderSteps(), cellHandle, likeHandle, ownLikeHandle, postShowsLikeAtStart, dialogOnOwnPage, likeStep, resolutions, afterTrial, ambiguous, trialAct, trialUnlike, postShowsLikeAtEnd, clicks, submission, tests, actList, siteChanges: judge.siteChanges(), firstEndView: firstEndView ?? null, reads, declarations, outcomes: observed.outcomes, receipts: provider.receipts, gatewayErrors: installed.gatewayErrors, seen, pages };
    await keepDiagnostic(testInfo, "reset-photo-dialog-step.json", diagnostic);
    console.log(JSON.stringify({ resetDiagnostic: { ending, failure, sharedHandle: likeHandle === ownLikeHandle, likeStep: likeStep ? { preceding: likeStep.preceding, inDialog: likeStep.inDialog, views: likeStep.views.length } : null, tests: tests.map(trialCode), steps: trialSteps.map(step => [step.status, step.failureCode ?? null]), ambiguous, afterTrial, trialAct, trialUnlike: trialUnlike.ok ?? trialUnlike.code ?? null } }));
    // Exploration: one stable handle names the post's Like in its dialog and on its own page, the own page shown last, not liked.
    expect(likeHandle).toMatch(/^t[0-9]+$/u);
    expect(ownLikeHandle).toBe(likeHandle);
    expect(dialogOnOwnPage).toBe(0);
    expect(postShowsLikeAtStart).toBe(true);
    // 1. The like step resolved for the submission, told the two steps before it, to the control inside the dialog the cell's press opened.
    expect(likeStep?.status).toBe("resolved");
    expect(likeStep?.preceding).toBe(2);
    expect(likeStep?.inDialog).toBe(true);
    expect(likeStep?.views.map(view => [view.handle, view.location])).toEqual([[ownLikeHandle, likedPage]]);
    // 2. The trial ran its three steps to the end, never ambiguous, and pressed the post's Like inside the dialog.
    expect(ambiguous).toBe(false);
    expect(trialSteps.map(step => [step.status, step.failureCode ?? null])).toEqual([["succeeded", null], ["succeeded", null], ["succeeded", null]]);
    expect(trialSteps[2]?.control).toBe("Like");
    expect(trialCode(tests[0])).toBe("yes");
    // The view after the Flow's last step: a dialog open, the post's own control in it showing Unlike, its Like gone, and no
    // post action outside it. In the browser afterwards Core's after-look has loaded the post's own page, liked (header, 2).
    expect(endUnlike).toEqual({ inDialog: 1, outside: 0, dialogHeader: true });
    expect(endLike.inDialog).toBe(0);
    expect(likedAnywhereAfterTrial).toBe(1);
    // 3. The trial's own Like: listed by the ledger, pressed back on the post's own page under undoes, admitted and dispatched once.
    expect(trialAct).toMatch(/^act-[1-9][0-9]{0,3}$/u);
    const trialBack = declarations.find(declaration => declaration.call === "unlike.trial");
    expect(trialBack?.consequences).toEqual(["modify_existing"]);
    expect(trialBack?.permitted).toBe(true);
    expect(trialBack?.dialog).toBeUndefined();
    expect(trialUnlike.ok).toBe(true);
    expect(clicksAfterTrialUnlike).toBe(clicksBeforeTrialUnlike + 1);
    expect(postShowsLikeAtEnd).toBe(true);
    // Tested once more on the restored post (a changed revision): admitted and run, the trial act not left to start with, judged
    // by its change, and the build ends with its Flow.
    expect(tests).toHaveLength(2);
    expect(retiredCodesIn(tests, observed.outcomes, provider.receipts, failure)).toEqual([]);
    // The changed revision's like step resolves, like the first, to the control inside the dialog the cell's press opened, so its
    // trial is never ambiguous there (t775 H3: it resolved to the post's own page, viewed last, and failed web.target.ambiguous).
    // The handle is the one the build's newest view, the restored own page, prints for the Like, as at the first submission. t775
    // H4 traced the failure to the domain: the dialog view a press led to keeps only its newest capture's controls
    // (`domain/.../plan-resolution/step-views/views.ts`, `captured`). A capture of the dialog taken during trial 1 showed the post
    // liked, its control under another handle, so the dialog no longer holds this one (the dialog's Comment and Close still
    // resolve there) and the step falls back to the own page.
    const finalLike = resolutions.filter(entry => entry.reach === "view_history" && entry.node === "web.output.dom-click" && entry.handles.includes(ownLikeHandle) && !entry.handles.includes(cellHandle)).at(-1);
    expect(finalLike?.inDialog).toBe(true);
    expect(JSON.stringify(tests[1] ?? {}).includes("web.target.ambiguous")).toBe(false);
    expect(trialCode(tests[1])).toBe("yes");
    expect(tests[1]!.trialRunId).not.toBe(tests[0]!.trialRunId);
    expect(startedWithActs(tests[1]).map(act => act.act)).not.toContain(trialAct);
    const finalSteps = ((record(tests[1]!.feedback).steps as JsonObject[] | undefined) ?? []).filter(step => step.label !== undefined);
    expect(finalSteps.map(step => [step.status, step.failureCode ?? null])).toEqual([["succeeded", null], ["succeeded", null], ["succeeded", null], ["succeeded", null]]);
    expect(judge.siteChanges()).toHaveLength(2);
    expect(judge.siteChanges()[1]).toBeDefined();
    expect(ending).toBe("proposed");
  } finally {
    await build.stop();
    await installed.close();
  }
});
