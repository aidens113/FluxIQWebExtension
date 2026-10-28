import type { JsonObject } from "fluxiq/core";
import { STUDIO, gridFor } from "../../../../scenario-lab/src/scenarios/photo-social/data/index.js";
import { expect, test } from "../../fixtures/extension-context";
import { actsWithOutcome, canonicalJson, ensureStatesIn, judgeLog, retiredCodesIn } from "../change-proof";
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
/** A trial's own steps: its first is the entry's arrival at the start location (no label); the Flow's own steps are the labelled ones. */
const labelledSteps = (trial: JsonObject | undefined): JsonObject[] => ((record(trial?.feedback).steps as JsonObject[] | undefined) ?? []).filter(step => step.label !== undefined);
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
 *
 * t775 (trials judged by their change, no reset before a trial): the first
 * test runs with the explored Like in place, and its like step, tied to the
 * explored press, holds `ensureState`, so it is skipped `already_in_state` and
 * the post stays liked. The ledger still lists the explored act with a
 * `settle` naming its control; the targeted undo is then exercised as before.
 * A repeat of a single-subflow revision whose yes stands is answered with that
 * judged run and not run again (Core t679, `supervisor/whole-trial.ts`), so
 * each later trial that must run is a changed revision (a trailing look, as
 * `judged-change-add-to-cart.spec.ts` does). The second trial, on the restored
 * post, presses the Like and leaves it. The ledger lists the trial's act with a
 * `settle` naming its control and its page (L1 d7), and the Unlike on the
 * post's own page under `undoes` naming it is admitted. Core's look after a
 * trial reloads the post's page, which numbers its controls anew, so a later
 * submission naming the Like's handle from before it is refused
 * `web.handle.renumbered_by_reload` (t775 H4); the build looks again where the
 * Flow acts -- the post's dialog opened from the grid -- and submits the
 * handles that look printed. That third trial runs on the restored post and
 * presses the Like, and a last test of the passing revision is answered with
 * its judged run. A trial run with a like in place is the first one.
 */
test("installed gateway project build presses a dialog toggle back on its post's own page and refuses another post's control", async ({ extensionSession }, testInfo) => {
  test.setTimeout(420_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const profile = new URL(`${ROOT}${STUDIO}/`, installed.origin).href;
  const likedPage = new URL(`${ROOT}p/${LIKED.code}/`, installed.origin).href;
  const otherPage = new URL(`${ROOT}p/${OTHER.code}/`, installed.origin).href;
  const build = projectBuild(installed, "Installed reset photo", TASK, () => installed.page.url());
  const pages: Record<string, string> = {};
  /** The newest evidence entries each builder turn was shown: call, tool, and code or verdict. */
  const seen: Record<string, string[]> = {};
  const captured: JsonObject = {};
  let cellHandle = "", likeHandle = "", likeAct = "", trialAct = "";
  let clicksBeforeLike = 0, clicksAfterLike = 0, clicksBeforeOther = 0, clicksAfterOther = 0, clicksBeforeUnlike = 0, clicksAfterUnlike = 0, clicksBeforeTrialUnlike = 0, clicksAfterTrialUnlike = 0;
  let other: JsonObject = {}, unlike: JsonObject = {}, trialUnlike: JsonObject = {}, likeAnswer: JsonObject = {};
  let postShowsLike = false, postShowsLikeAtEnd = false;
  const tests: JsonObject[] = [];
  const judge = judgeLog();
  let actList: JsonObject = {}, trialList: JsonObject = {}, refusedSubmission: JsonObject = {};
  /** The grid cell's and the Like's handles as the build's look after the trial act's undo printed them. */
  const freshHandles = { cell: "", like: "" };
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
      seen[`step-${turn.step}`] = turn.evidence.slice(-4).map(entry => `${entry.callId} ${entry.toolId} ${String(entry.value.code ?? entry.value.verdict ?? entry.value.ok)}`);
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
      // The post is liked where its control was saved: in its dialog over the profile grid, opened as exploration opened it.
      // `looks` trailing looks make a changed revision that runs as a trial of its own (header); `handles`, the grid cell and
      // Like as the build's newest look at them printed them.
      const flow = (looks: number, handles = { cell: cellHandle, like: likeHandle }) => [
        `flow: Like post`,
        `step profile: open the profile`, `  node: web.browser-navigate`, `  url: ${JSON.stringify(profile)}`,
        `step post: open the post`, `  node: web.dom.click`, `  target: ${handles.cell}`, `  consequences: none`,
        `step like: like the post`, `  node: web.dom.click`, `  target: ${handles.like}`, `  consequences: modify_existing`,
        ...Array.from({ length: looks }, (_, index) => [`step check${index + 1}: look at the post`, `  node: web.dom.capture_snapshot`]).flat()
      ].join("\n");
      if (turn.step === 5) {
        clicksAfterLike = observed.clicks();
        likeAnswer = record(last("core.run_node"));
        return call("submit", "core.submit_subflow", { flow: flow(0) });
      }
      const submitted = last("core.submit_subflow");
      if (typeof submitted?.revision !== "number" || typeof submitted.digest !== "string") {
        refusedSubmission = record(submitted);
        throw new Error("diagnostic.submission_refused");
      }
      const candidate = { revision: submitted.revision, digest: submitted.digest };
      if (turn.step === 6) return call("trial.liked", "core.test_subflow", candidate);
      if (turn.step === 7) {
        tests.push(record(last("core.test_subflow")));
        // t775: the trial is no longer refused while the like stands, so the act is read from the refusal of a claim on an
        // unlisted act, which the ledger answers with the acts in place and each one's settle.
        return node("act.list", "web.output.browser-navigate", { url: likedPage }, [], { undoes: "act-9999" });
      }
      if (turn.step === 8) {
        actList = record(last("core.run_node"));
        const act = actsUnder(actList, "actsToUndo").find(entry => entry.call === "like")?.act;
        if (!act) throw new Error("diagnostic.like_act_missing");
        likeAct = act;
        return node("other.open", "web.output.browser-navigate", { url: otherPage });
      }
      if (turn.step === 9) {
        clicksBeforeOther = observed.clicks();
        return node("undo.other", "web.output.dom-click", { target: { handle: postActionHandle(turn.shownPage(), "Like") } }, ["modify_existing"], { undoes: likeAct });
      }
      if (turn.step === 10) {
        other = record(last("core.run_node"));
        clicksAfterOther = observed.clicks();
        return node("own.open", "web.output.browser-navigate", { url: likedPage });
      }
      if (turn.step === 11) {
        clicksBeforeUnlike = observed.clicks();
        return node("unlike", "web.output.dom-click", { target: { handle: postActionHandle(turn.shownPage(), "Unlike") } }, ["modify_existing"], { undoes: likeAct });
      }
      if (turn.step === 12) {
        unlike = record(last("core.run_node"));
        clicksAfterUnlike = observed.clicks();
        postShowsLike = await page.locator(POST_SHOWS_LIKE).first().isVisible();
        // The explored act is put back: a changed revision runs as its own trial on the restored post (header).
        return call("submit.restored", "core.submit_subflow", { flow: flow(1) });
      }
      if (turn.step === 13) return call("trial.restored", "core.test_subflow", candidate);
      if (turn.step === 14) {
        const passed = record(last("core.test_subflow"));
        tests.push(passed);
        if (trialCode(passed) !== "yes") return turn.complete({ subflowKey: "main", ...candidate });
        // The passing trial left its own Like on the site: the ledger names it in its answer to a claim on an unlisted act.
        return node("act.list.trial", "web.output.browser-navigate", { url: likedPage }, [], { undoes: "act-9999" });
      }
      if (turn.step === 15) {
        trialList = record(last("core.run_node"));
        const act = actsUnder(trialList, "actsToUndo").find(entry => entry.act !== likeAct && entry.call === undefined)?.act;
        if (!act) return turn.complete({ subflowKey: "main", ...candidate });
        trialAct = act;
        return node("own.again", "web.output.browser-navigate", { url: likedPage });
      }
      if (turn.step === 16) {
        clicksBeforeTrialUnlike = observed.clicks();
        return node("unlike.trial", "web.output.dom-click", { target: { handle: postActionHandle(turn.shownPage(), "Unlike") } }, ["modify_existing"], { undoes: trialAct });
      }
      if (turn.step === 17) {
        trialUnlike = record(last("core.run_node"));
        clicksAfterTrialUnlike = observed.clicks();
        postShowsLikeAtEnd = await page.locator(POST_SHOWS_LIKE).first().isVisible();
        // The trial's look after it reloaded the post's page, so the Like's handle from before it is refused as renumbered
        // (`web.handle.renumbered_by_reload`). As a builder must, the build looks again where the Flow acts -- the post's
        // dialog over the profile, opened from the grid -- and writes the handles that look printed (header).
        return node("profile.again", "web.output.browser-navigate", { url: profile });
      }
      if (turn.step === 18) {
        const cell = turn.shownPage().split("\n").find(line => /^t\d+ link /u.test(line) && line.endsWith(` ~/p/${LIKED.code}/`))?.split(" ")[0];
        if (!cell) throw new Error("diagnostic.grid_cell_missing_again");
        freshHandles.cell = cell;
        return node("open.again", "web.output.dom-click", { target: { handle: cell } });
      }
      if (turn.step === 19) {
        await page.getByRole("dialog").waitFor({ timeout: 6000 });
        return node("dialog.again", "web.output.dom-capture_snapshot", {});
      }
      if (turn.step === 20) {
        freshHandles.like = postActionHandle(turn.shownPage(), "Like");
        return call("submit.final", "core.submit_subflow", { flow: flow(2, freshHandles) });
      }
      if (turn.step === 21) return call("trial.final", "core.test_subflow", candidate);
      if (turn.step === 22) {
        tests.push(record(last("core.test_subflow")));
        // The same revision tested again: its judged run answers it (Core t679).
        return call("trial.repeat", "core.test_subflow", candidate);
      }
      if (turn.step === 23) tests.push(record(last("core.test_subflow")));
      return turn.complete({ subflowKey: "main", ...candidate });
    };
    const provider = bindScriptedProvider(installed, { task: TASK, permitted: ["modify_existing"], instructionSourceId: build.instructionSourceId, maxIterations: 32, maxCallsPerRun: 48, builder, verify: judge.verify });
    const { ending, failure } = await build.run();
    const { declarations, reads } = observed;
    const clicks = { clicksBeforeLike, clicksAfterLike, clicksBeforeOther, clicksAfterOther, clicksBeforeUnlike, clicksAfterUnlike, clicksBeforeTrialUnlike, clicksAfterTrialUnlike, end: observed.clicks() };
    const diagnostic = { ending, failure, builderStep: provider.builderSteps(), likeAct, trialAct, likeHandle, cellHandle, freshHandles, clicks, other, unlike, trialUnlike, postShowsLike, postShowsLikeAtEnd, tests, siteChanges: judge.siteChanges(), ensureStates: judge.requests.map(ensureStatesIn), likeToggle: likeAnswer.toggle ?? null, unlikeToggle: unlike.toggle ?? null, actList, trialList, reads, declarations, outcomes: observed.outcomes, receipts: provider.receipts, gatewayErrors: installed.gatewayErrors, refusedSubmission, seen, pages, captured };
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
    // t775: the test is not refused while the control still shows the state the Like set. It runs, its judge request names the
    // explored like under `leftFromEarlier`, its like step holds ensureState and is skipped already in state (the post stays
    // liked, never toggled off), and the ledger still lists that act with a settle naming its control.
    expect(trialCode(tests[0])).toBe("yes");
    const changes = judge.siteChanges();
    const leftFirst = changes[0]?.leftFromEarlier;
    expect(Array.isArray(leftFirst) ? leftFirst.length : 0).toBeGreaterThan(0);
    expect(labelledSteps(tests[0]).map(step => [step.status, typeof step.skipped])).toEqual([["succeeded", "undefined"], ["succeeded", "undefined"], ["succeeded", "string"]]);
    expect(actsWithOutcome(changes[0], "already_in_state").map(act => act.step)).toHaveLength(1);
    const settle = actsUnder(actList, "actsToUndo").find(entry => entry.act === likeAct)?.settle ?? "";
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
    // The next test (a changed revision) is admitted on the restored post, with nothing left to say it started with, and the trial
    // runs to its end: its like step finds the post unliked and presses it.
    expect(trialCode(tests[1])).toBe("yes");
    expect(tests[1]!.trialRunId).not.toBe(tests[0]!.trialRunId);
    expect(startedWithActs(tests[1]).map(act => act.act)).not.toContain(likeAct);
    // Every trial's like step holds the explored Like's own signature as its ensureState, never that of the Unlike pressed back under
    // undoes on the same control (t775 H3: Core ties the step to the newest press on its control, which an undo then is).
    const likeSignature = canonicalJson(record(likeAnswer.toggle).signature ?? null);
    expect(likeSignature).not.toBe("null");
    expect(judge.requests.map(request => [...new Set(ensureStatesIn(request))])).toEqual(judge.requests.map(() => [likeSignature]));
    const trialSteps = labelledSteps(tests[1]);
    expect(trialSteps.map(step => [step.status, typeof step.skipped])).toEqual([["succeeded", "undefined"], ["succeeded", "undefined"], ["succeeded", "undefined"], ["succeeded", "undefined"]]);
    expect(trialSteps[2]?.control).toBe("Like");
    expect(actsWithOutcome(changes[1], "already_in_state")).toEqual([]);
    // The passing trial left its own Like on the site; the ledger lists that trial act with a settle naming its control.
    expect(trialAct).toMatch(/^act-[1-9][0-9]{0,3}$/u);
    expect(actsUnder(tests[1], "leftOnSite").map(act => act.act)).toEqual([trialAct]);
    const trialOpen = actsUnder(trialList, "actsToUndo").find(entry => entry.act === trialAct);
    // The trial's like is its step 4: the entry's arrival at the start location is step 1, then the Flow's three steps.
    expect(trialOpen?.did).toMatch(/^trial step 4 "like the post"/u);
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
    // The build looked again where the Flow acts and submitted the handles that look printed: a changed revision, admitted, run on
    // the restored post as its own trial, with the trial act not left to start with; its like step, tied to the explored press
    // (its ensureState is checked with every judge request above), finds the post unliked and presses it.
    expect(freshHandles.like).toMatch(/^t[0-9]+$/u);
    expect(trialCode(tests[2])).toBe("yes");
    expect(tests[2]!.trialRunId).not.toBe(tests[1]!.trialRunId);
    expect(startedWithActs(tests[2]).map(act => act.act)).not.toContain(trialAct);
    expect(labelledSteps(tests[2]).map(step => [step.status, typeof step.skipped])).toEqual([["succeeded", "undefined"], ["succeeded", "undefined"], ["succeeded", "undefined"], ["succeeded", "undefined"], ["succeeded", "undefined"]]);
    expect(labelledSteps(tests[2])[2]?.control).toBe("Like");
    expect(changes).toHaveLength(3);
    expect(actsWithOutcome(changes[2], "already_in_state")).toEqual([]);
    const leftByFinal = actsUnder(tests[2], "leftOnSite").map(act => act.act);
    expect(leftByFinal).toHaveLength(1);
    expect(leftByFinal).not.toContain(trialAct);
    // Tested once more: the whole test of this revision already stands yes, so Core answers that judged run without running it
    // again (Core t679), and no judge is asked.
    expect(tests).toHaveLength(4);
    expect(retiredCodesIn(tests, observed.outcomes, provider.receipts, failure)).toEqual([]);
    expect(trialCode(tests[3])).toBe("yes");
    expect(tests[3]!.trialRunId).toBe(tests[2]!.trialRunId);
    expect(judge.siteChanges()).toHaveLength(3);
  } finally {
    await build.stop();
    await installed.close();
  }
});
