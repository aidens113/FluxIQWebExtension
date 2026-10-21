import type { JsonObject } from "fluxiq/core";
import { STUDIO, gridFor } from "../../../../scenario-lab/src/scenarios/photo-social/data/index.js";
import { expect, test } from "../../fixtures/extension-context";
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

/** One candidate node the domain resolved for Core: opaque tokens, counts and codes only, never page words. */
type ObservedResolution = {
  node: string;
  reach: unknown;
  /** How many plan steps Core said stand before this node, or null when it said none. */
  preceding: number | null;
  handles: string[];
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
    handles: JSON.stringify(input.parameters ?? {}).match(/\bt\d+\b/gu) ?? [],
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
 * 2. The trial runs its three steps to the end, and the post's Like inside the dialog is the control it pressed.
 * 3. The trial's own Like is put back on the post's own page under `undoes` (photo-toggle.spec.ts), and the next test is
 *    admitted on the restored post: the build leaves the site as it found it.
 */
test("installed gateway project build resolves a candidate's press in the dialog the step before it opened, not on the page shown last at that address", async ({ extensionSession }, testInfo) => {
  test.setTimeout(420_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page, service } = installed;
  const profile = new URL(`${ROOT}${STUDIO}/`, installed.origin).href;
  const likedPage = new URL(`${ROOT}p/${LIKED.code}/`, installed.origin).href;
  const build = projectBuild(installed, "Installed reset photo dialog step", TASK);
  const pages: Record<string, string> = {};
  const resolutions: ObservedResolution[] = [];
  let cellHandle = "", likeHandle = "", ownLikeHandle = "", trialAct = "";
  let postShowsLikeAtStart = false, dialogOnOwnPage = -1, postShowsLikeAtEnd = false;
  let dialogLikedAfterTrial = -1, dialogUnlikedAfterTrial = -1, likedAnywhereAfterTrial = -1;
  let clicksBeforeTrialUnlike = 0, clicksAfterTrialUnlike = 0;
  let submission: JsonObject = {}, trialUnlike: JsonObject = {};
  const tests: JsonObject[] = [];
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
    const builder = async (turn: BuilderTurn) => {
      const { last, node, call } = turn;
      pages[`step-${turn.step}`] = turn.shownPage();
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
        // The Flow likes the post in its dialog over the profile grid, naming the handle the own page showed last.
        return call("submit", "core.submit_subflow", { flow: [
          `flow: Like post`,
          `step profile: open the profile`, `  node: web.browser-navigate`, `  url: ${JSON.stringify(profile)}`,
          `step post: open the post`, `  node: web.dom.click`, `  target: ${cellHandle}`, `  consequences: none`,
          `step like: like the post`, `  node: web.dom.click`, `  target: ${ownLikeHandle}`, `  consequences: modify_existing`
        ].join("\n") });
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
        // The passing trial left its own Like on the site: asked again, the gate names it.
        return call("trial.after", "core.test_subflow", candidate);
      }
      if (turn.step === 8) {
        const after = record(last("core.test_subflow"));
        tests.push(after);
        const act = actsUnder(after, "actsToUndo").find(entry => entry.call === undefined)?.act;
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
        return call("trial.final", "core.test_subflow", candidate);
      }
      if (turn.step === 11) tests.push(record(last("core.test_subflow")));
      return turn.complete({ subflowKey: "main", ...candidate });
    };
    const provider = bindScriptedProvider(installed, { task: TASK, permitted: ["modify_existing"], instructionSourceId: build.instructionSourceId, maxIterations: 24, maxCallsPerRun: 36, builder });
    const { ending, failure } = await build.run();
    const { declarations, reads } = observed;
    // The candidate's like step: resolved for the submission under view_history, naming the shared handle.
    const likeStep = resolutions.find(entry => entry.reach === "view_history" && entry.node === "web.output.dom-click" && entry.handles.includes(ownLikeHandle) && !entry.handles.includes(cellHandle));
    const trialSteps = (record(tests[0]?.feedback).steps as JsonObject[] | undefined) ?? [];
    const ambiguous = JSON.stringify(tests).includes("web.target.ambiguous");
    const afterTrial = { dialogLikedAfterTrial, dialogUnlikedAfterTrial, likedAnywhereAfterTrial };
    const clicks = { clicksBeforeTrialUnlike, clicksAfterTrialUnlike, end: observed.clicks() };
    const diagnostic = { ending, failure, builderStep: provider.builderSteps(), cellHandle, likeHandle, ownLikeHandle, postShowsLikeAtStart, dialogOnOwnPage, likeStep, resolutions, afterTrial, ambiguous, trialAct, trialUnlike, postShowsLikeAtEnd, clicks, submission, tests, reads, declarations, outcomes: observed.outcomes, receipts: provider.receipts, gatewayErrors: installed.gatewayErrors, pages };
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
    expect(dialogLikedAfterTrial).toBe(1);
    expect(dialogUnlikedAfterTrial).toBe(0);
    expect(likedAnywhereAfterTrial).toBe(1);
    // 3. The trial's own Like: listed by the gate, pressed back on the post's own page under undoes, admitted and dispatched once.
    expect(trialAct).toMatch(/^act-[1-9][0-9]{0,3}$/u);
    expect(actsUnder(tests[0], "leftOnSite").map(act => act.act)).toContain(trialAct);
    expect(trialCode(tests[1])).toBe("candidate.trial_reset_required");
    expect(actsUnder(tests[1], "actsToUndo").find(entry => entry.act === trialAct)?.did).toMatch(/^trial step 3 /u);
    const trialBack = declarations.find(declaration => declaration.call === "unlike.trial");
    expect(trialBack?.consequences).toEqual(["modify_existing"]);
    expect(trialBack?.permitted).toBe(true);
    expect(trialBack?.dialog).toBeUndefined();
    expect(trialUnlike.ok).toBe(true);
    expect(clicksAfterTrialUnlike).toBe(clicksBeforeTrialUnlike + 1);
    expect(postShowsLikeAtEnd).toBe(true);
    // Tested once more on the restored post: admitted, the trial act not left to start with, and the build ends with its Flow.
    expect(tests).toHaveLength(3);
    expect(["candidate.trial_reset_required", "candidate.trial_reset_unproved"]).not.toContain(trialCode(tests[2]));
    expect(trialCode(tests[2])).toBe("yes");
    expect(startedWithActs(tests[2]).map(act => act.act)).not.toContain(trialAct);
    expect(ending).toBe("proposed");
  } finally {
    await build.stop();
    await installed.close();
  }
});
