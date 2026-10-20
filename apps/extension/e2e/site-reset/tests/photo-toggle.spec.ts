import type { JsonObject } from "fluxiq/core";
import { STUDIO, gridFor } from "../../../../scenario-lab/src/scenarios/photo-social/data/index.js";
import { expect, test } from "../../fixtures/extension-context";
import { actsUnder, bindInstrumentedRuntime, keepDiagnostic, bindScriptedProvider, handleBefore, projectBuild, startInstalledBuild, startedWithActs, trialCode, type BuilderTurn } from "../index";

const TASK = "Like one post.";
const ROOT = "/scenarios/photo-social/";
/** The studio's grid: its pinned posts first, then the rest newest first. The build likes the first unpinned post; another post is the next one. */
const GRID = gridFor(STUDIO);
const LIKED = GRID.find(post => !post.pinned)!;
const OTHER = GRID[GRID.indexOf(LIKED) + 1]!;
/** The post's own action control `label`: its actions row draws Like, then Comment; every comment carries a Like of its own elsewhere. */
const postActionHandle = (view: string, label: string) => handleBefore(view, label, "Comment");
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
/** The post's own Like, drawn by its labelled graphic, as the page shows it when the post is not liked. */
const POST_SHOWS_LIKE = `article section > [role="button"]:has(> svg[aria-label="Like"])`;
/** Core's settle for a toggle whose control, at `page` where Core knows it, still shows the state its act set (Core `site-reset`, `settlement-shapes.test.ts`). */
const controlSettle = (page?: string) => `Its control${page ? ` at ${page}` : ""} still shows the state this act set: press that same control back once, naming this act under undoes.`;

/**
 * Photo shape G (photo r2): a toggle pressed in a post's dialog over the
 * profile grid, pressed back on the post's own page. The test is refused
 * while the control still shows the state the Like set; the Unlike on the
 * post's own page under `undoes` is admitted and dispatched once; an undo
 * aimed at another post's control is refused unrun; and the next test is
 * admitted on the restored post. The Like is a `div role=button` drawn by an
 * inner `svg aria-label`, so this also proves the capture names a control
 * from its labelled graphic (`l1-d3-browser-proof.md`, photo G).
 *
 * The Flow likes the post where exploration saved its control: it opens the
 * profile, opens the post's dialog from the grid, and presses the Like inside
 * it. A saved control is matched only in the dialog context it was saved in,
 * so a Flow that opened the post's standalone page instead could not find it.
 * The trial that passes leaves its own Like on the site, as photo r2's trials
 * did, so the build then puts it back as its reset did the explored one: the
 * gate, asked again, lists the trial's act with a `settle` naming its control,
 * the Unlike on the post's own page under `undoes` naming that trial act is
 * admitted -- its toggle witnessed by the trial step's own change -- and the
 * build tests once more: admitted on the restored post, then completes on the
 * passing revision. The trial act's settle names its page (L1 d7): the step's
 * controls carry the location its page token is built from, since the
 * supervisor's ledger that records a single-subflow plan's judged run has
 * read no page of it when the gate first lists it.
 */
test("installed gateway project build presses a dialog toggle back on its post's own page and refuses another post's control", async ({ extensionSession }, testInfo) => {
  test.setTimeout(420_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const profile = new URL(`${ROOT}${STUDIO}/`, installed.origin).href;
  const likedPage = new URL(`${ROOT}p/${LIKED.code}/`, installed.origin).href;
  const otherPage = new URL(`${ROOT}p/${OTHER.code}/`, installed.origin).href;
  const build = projectBuild(installed, "Installed reset photo", TASK);
  const pages: Record<string, string> = {};
  const captured: JsonObject = {};
  let cellHandle = "", likeHandle = "", likeAct = "", trialAct = "";
  let clicksBeforeLike = 0, clicksAfterLike = 0, clicksBeforeOther = 0, clicksAfterOther = 0, clicksBeforeUnlike = 0, clicksAfterUnlike = 0, clicksBeforeTrialUnlike = 0, clicksAfterTrialUnlike = 0;
  let other: JsonObject = {}, unlike: JsonObject = {}, trialUnlike: JsonObject = {};
  let postShowsLike = false, postShowsLikeAtEnd = false;
  const tests: JsonObject[] = [];
  try {
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
        // The grid cell of the liked post: the link to its address.
        const cell = turn.shownPage().split("\n").find(line => /^t\d+ link /u.test(line) && line.endsWith(` ~/p/${LIKED.code}/`))?.split(" ")[0];
        if (!cell) throw new Error("diagnostic.grid_cell_missing");
        cellHandle = cell;
        return node("open.post", "web.output.dom-click", { target: { handle: cell } });
      }
      if (turn.step === 3) {
        await page.getByRole("dialog").waitFor({ timeout: 6000 });
        return node("dialog.look", "web.output.dom-capture_snapshot", {});
      }
      if (turn.step === 4 || turn.step === 11) {
        // What the capture names the drawn buttons by, beside what the page view prints for them.
        const elements = (installed.latestRawSnapshot()?.interactiveElements as JsonObject[] | undefined) ?? [];
        captured[`step-${turn.step}`] = elements.filter(element => element.role === "button" && element.drawing !== undefined).slice(0, 6).map(element => ({ accessibleName: element.accessibleName ?? null, visibleText: element.visibleText ?? null, drawing: element.drawing ?? null }));
      }
      if (turn.step === 4) {
        likeHandle = postActionHandle(turn.shownPage(), "Like");
        clicksBeforeLike = observed.clicks();
        return node("like", "web.output.dom-click", { target: { handle: likeHandle } }, ["modify_existing"]);
      }
      if (turn.step === 5) {
        clicksAfterLike = observed.clicks();
        // The post is liked where its control was saved: in its dialog over the profile grid, opened as exploration opened it.
        return call("submit", "core.submit_subflow", { flow: [
          `flow: Like post`,
          `step profile: open the profile`, `  node: web.browser-navigate`, `  url: ${JSON.stringify(profile)}`,
          `step post: open the post`, `  node: web.dom.click`, `  target: ${cellHandle}`, `  consequences: none`,
          `step like: like the post`, `  node: web.dom.click`, `  target: ${likeHandle}`, `  consequences: modify_existing`
        ].join("\n") });
      }
      const submitted = last("core.submit_subflow");
      if (typeof submitted?.revision !== "number" || typeof submitted.digest !== "string") throw new Error("diagnostic.submission_refused");
      const candidate = { revision: submitted.revision, digest: submitted.digest };
      if (turn.step === 6) return call("trial.liked", "core.test_subflow", candidate);
      if (turn.step === 7) {
        const refused = record(last("core.test_subflow"));
        tests.push(refused);
        const act = actsUnder(refused, "actsToUndo").find(entry => entry.call === "like")?.act;
        if (!act) throw new Error("diagnostic.like_act_missing");
        likeAct = act;
        return node("other.open", "web.output.browser-navigate", { url: otherPage });
      }
      if (turn.step === 8) {
        clicksBeforeOther = observed.clicks();
        return node("undo.other", "web.output.dom-click", { target: { handle: postActionHandle(turn.shownPage(), "Like") } }, ["modify_existing"], { undoes: likeAct });
      }
      if (turn.step === 9) {
        other = record(last("core.run_node"));
        clicksAfterOther = observed.clicks();
        return node("own.open", "web.output.browser-navigate", { url: likedPage });
      }
      if (turn.step === 10) {
        clicksBeforeUnlike = observed.clicks();
        return node("unlike", "web.output.dom-click", { target: { handle: postActionHandle(turn.shownPage(), "Unlike") } }, ["modify_existing"], { undoes: likeAct });
      }
      if (turn.step === 11) {
        unlike = record(last("core.run_node"));
        clicksAfterUnlike = observed.clicks();
        postShowsLike = await page.locator(POST_SHOWS_LIKE).first().isVisible();
        return call("trial.restored", "core.test_subflow", candidate);
      }
      if (turn.step === 12) {
        const passed = record(last("core.test_subflow"));
        tests.push(passed);
        if (trialCode(passed) !== "yes") return turn.complete({ subflowKey: "main", ...candidate });
        // The passing trial left its own Like on the site: asked again, the gate says what is still to put back.
        return call("trial.after", "core.test_subflow", candidate);
      }
      if (turn.step === 13) {
        const after = record(last("core.test_subflow"));
        tests.push(after);
        const act = actsUnder(after, "actsToUndo").find(entry => entry.act !== likeAct && entry.call === undefined)?.act;
        if (!act) return turn.complete({ subflowKey: "main", ...candidate });
        trialAct = act;
        return node("own.again", "web.output.browser-navigate", { url: likedPage });
      }
      if (turn.step === 14) {
        clicksBeforeTrialUnlike = observed.clicks();
        return node("unlike.trial", "web.output.dom-click", { target: { handle: postActionHandle(turn.shownPage(), "Unlike") } }, ["modify_existing"], { undoes: trialAct });
      }
      if (turn.step === 15) {
        trialUnlike = record(last("core.run_node"));
        clicksAfterTrialUnlike = observed.clicks();
        postShowsLikeAtEnd = await page.locator(POST_SHOWS_LIKE).first().isVisible();
        // The trial act is pressed back: tested once more, the gate admits the test on the restored post.
        return call("trial.final", "core.test_subflow", candidate);
      }
      if (turn.step === 16) tests.push(record(last("core.test_subflow")));
      return turn.complete({ subflowKey: "main", ...candidate });
    };
    const provider = bindScriptedProvider(installed, { task: TASK, permitted: ["modify_existing"], instructionSourceId: build.instructionSourceId, maxIterations: 24, maxCallsPerRun: 36, builder });
    const { ending, failure } = await build.run();
    const { declarations, reads } = observed;
    const clicks = { clicksBeforeLike, clicksAfterLike, clicksBeforeOther, clicksAfterOther, clicksBeforeUnlike, clicksAfterUnlike, clicksBeforeTrialUnlike, clicksAfterTrialUnlike, end: observed.clicks() };
    const diagnostic = { ending, failure, builderStep: provider.builderSteps(), likeAct, trialAct, clicks, other, unlike, trialUnlike, postShowsLike, postShowsLikeAtEnd, tests, reads, declarations, outcomes: observed.outcomes, receipts: provider.receipts, gatewayErrors: installed.gatewayErrors, pages, captured };
    await keepDiagnostic(testInfo, "reset-photo.json", diagnostic);
    console.log(JSON.stringify({ resetDiagnostic: { ending, failure, tests: tests.map(trialCode), other: other.code, unlike: unlike.ok, trialAct, trialUnlike: trialUnlike.ok ?? trialUnlike.code } }));
    expect(ending).toBe("proposed");
    // The Like: pressed in the post's dialog over the profile, declared modify_existing with its control's place and state.
    const like = declarations.find(declaration => declaration.call === "like");
    expect(like?.consequences).toEqual(["modify_existing"]);
    expect(like?.permitted).toBe(true);
    expect(like?.dialog).toBeDefined();
    expect(like?.place).toMatch(/^[a-z]+:[a-f0-9]{16,}$/u);
    expect(like?.state).toMatch(/^[a-z]+:[a-f0-9]{16,}$/u);
    expect(clicksAfterLike).toBe(clicksBeforeLike + 1);
    // The reads around it carry the control: one at its place in the Like's state before, one in another state after.
    const atPlace = reads.filter(read => read.controls?.[like!.place!] !== undefined);
    expect(atPlace.some(read => (read.controls![like!.place!]![like!.state!] ?? 0) > 0)).toBe(true);
    expect(atPlace.some(read => Object.keys(read.controls![like!.place!]!).some(state => state !== like!.state))).toBe(true);
    // The test is refused while the control still shows the state the Like set, and its settle names that control.
    expect(trialCode(tests[0])).toBe("candidate.trial_reset_required");
    const settle = actsUnder(tests[0], "actsToUndo").find(entry => entry.act === likeAct)?.settle ?? "";
    expect(settle).toBe(controlSettle(likedPage));
    // Another post's control under undoes: refused unrun, nothing clicked.
    const aimed = declarations.find(declaration => declaration.call === "undo.other");
    expect(other.ok).toBe(false);
    expect(other.code).toBe("candidate.undo_unproved");
    expect(aimed?.permitted).toBe(false);
    expect(aimed?.place).not.toBe(like?.place);
    expect(clicksAfterOther).toBe(clicksBeforeOther);
    // Unlike on the post's own page: the same place, the state the Like set, admitted, dispatched once, and the post shows Like.
    const back = declarations.find(declaration => declaration.call === "unlike");
    expect(back?.permitted).toBe(true);
    expect(back?.place).toBe(like?.place);
    expect(back?.state).not.toBe(like?.state);
    expect(back?.dialog).toBeUndefined();
    expect(unlike.ok).toBe(true);
    expect(clicksAfterUnlike).toBe(clicksBeforeUnlike + 1);
    expect(postShowsLike).toBe(true);
    // The next test is admitted on the restored post, with nothing left to say it started with, and the trial runs to its end.
    expect(trialCode(tests[1])).toBe("yes");
    expect(startedWithActs(tests[1]).map(act => act.act)).not.toContain(likeAct);
    const trialSteps = (record(tests[1]!.feedback).steps as JsonObject[] | undefined) ?? [];
    expect(trialSteps.map(step => step.status)).toEqual(["succeeded", "succeeded", "succeeded"]);
    expect(trialSteps[2]?.control).toBe("Like");
    // The passing trial left its own Like on the site: the gate, asked again, lists that trial act with a settle naming its control.
    expect(trialAct).toMatch(/^act-[1-9][0-9]{0,3}$/u);
    expect(actsUnder(tests[1], "leftOnSite").map(act => act.act)).toContain(trialAct);
    expect(trialCode(tests[2])).toBe("candidate.trial_reset_required");
    const trialOpen = actsUnder(tests[2], "actsToUndo").find(entry => entry.act === trialAct);
    expect(trialOpen?.did).toMatch(/^trial step 3 /u);
    // The trial step's controls carry its page's location, so its settle names the page as an explored act's does (L1 d7).
    expect(trialOpen?.settle).toBe(controlSettle(likedPage));
    // The Unlike under undoes naming the trial act: the same place in the state the trial set, admitted and dispatched once, and the post shows Like.
    const trialBack = declarations.find(declaration => declaration.call === "unlike.trial");
    expect(trialBack?.permitted).toBe(true);
    expect(trialBack?.place).toBe(like?.place);
    expect(trialBack?.state).not.toBe(like?.state);
    expect(trialUnlike.ok).toBe(true);
    expect(clicksAfterTrialUnlike).toBe(clicksBeforeTrialUnlike + 1);
    expect(postShowsLikeAtEnd).toBe(true);
    // Tested once more on the restored post: the builder's reset gate admits it, not refused, with the trial act not left to start with.
    // Past that gate the whole test of this revision already stands yes, so Core answers that judged run without running it again (Core t679).
    expect(tests).toHaveLength(4);
    expect(["candidate.trial_reset_required", "candidate.trial_reset_unproved"]).not.toContain(trialCode(tests[3]));
    expect(trialCode(tests[3])).toBe("yes");
    expect(startedWithActs(tests[3]).map(act => act.act)).not.toContain(trialAct);
    expect(tests[3]!.trialRunId).toBe(tests[1]!.trialRunId);
  } finally {
    await build.stop();
    await installed.close();
  }
});
