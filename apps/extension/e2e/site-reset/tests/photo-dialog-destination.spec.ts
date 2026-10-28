import type { JsonObject } from "fluxiq/core";
import { STUDIO, gridFor } from "../../../../scenario-lab/src/scenarios/photo-social/data/index.js";
import { expect, test } from "../../fixtures/extension-context";
import { actsUnder, bindInstrumentedRuntime, keepDiagnostic, bindScriptedProvider, handleBefore, projectBuild, startInstalledBuild, startedWithActs, trialCode, type BuilderTurn } from "../index";

const TASK = "Like one post.";
const ROOT = "/scenarios/photo-social/";
/** The studio's grid: its pinned posts first, then the rest newest first. The build likes the first unpinned post. */
const GRID = gridFor(STUDIO);
const LIKED = GRID.find(post => !post.pinned)!;
/** The post's own action control `label`: its actions row draws Like, then Comment; every comment carries a Like of its own elsewhere. */
const postActionHandle = (view: string, label: string) => handleBefore(view, label, "Comment");
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
/** The post's own Like, drawn by its labelled graphic, as the page shows it when the post is not liked. */
const POST_SHOWS_LIKE = `article section > [role="button"]:has(> svg[aria-label="Like"])`;
/**
 * The Like's act. The grid cell's press that opens the dialog changes the page in place (no navigation: the address is
 * pushed), so the project ledger records it first as a possibly lasting act, `act-1` (Core `site-reset/ledger.ts`,
 * t593); the Like, the build's first lasting act, is the next.
 */
const OPEN_ACT = "act-1";
const LIKE_ACT = "act-2";

/**
 * Photo rerun round 4 (`run-mvgw7320-de416190`, "Why the undo was
 * unproved"): a post opened as a dialog over the profile pushes the post's
 * address, and a list read inside that dialog issues a destination ref there.
 * The Like names that ref. Loading the pushed address gives a different
 * document -- the post's standalone page -- so Core's own look at it can
 * never read that list again.
 *
 * 1. The Like inside the dialog names the dialog's destination ref (act-2, a toggle; the press that opened the
 *    dialog is act-1, possibly lasting).
 * 2. Pressed back on the post's own page under `undoes`: admitted, lands once, the control is back.
 * 3. Pressed again under `undoes`: the control already shows the state the build found, so it is
 *    refused unrun with `candidate.undo_already_back` (`already_back`, `this_page`), nothing clicked:
 *    the act is still open on its unread list, and a look on this page, whose fresh read settles it,
 *    meets it (Core t751 R2, `site-reset/undo-admission.ts`), as step 4's look shows.
 * 4. The Flow is tested: Core's pre-trial look at the dialog's address reads the standalone
 *    page, the named list is lost, act-2 settles restored (its toggle is back and its undo landed),
 *    and the trial runs, told that the named list could not be read again.
 *
 * The Flow is written where the build last saw the Like: on the post's own page. The dialog view and
 * that page share one address, so the page view kept for that address is the standalone page's, and
 * the Like's handle (the same `tN` in both views) now names the standalone page's control -- selector
 * under `main`, no dialog. A Flow that reopened the dialog and pressed that handle took the standalone
 * identity into the dialog and failed `web.target.ambiguous` among the dialog's Likes (t743 e3b);
 * photo-toggle.spec.ts submits before leaving the dialog, so its handle still names the dialog's Like.
 */
test("installed gateway project build settles a dialog toggle whose named list cannot be read again, and refuses a press on a control already back", async ({ extensionSession }, testInfo) => {
  test.setTimeout(420_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const profile = new URL(`${ROOT}${STUDIO}/`, installed.origin).href;
  const likedPage = new URL(`${ROOT}p/${LIKED.code}/`, installed.origin).href;
  const build = projectBuild(installed, "Installed reset photo dialog", TASK);
  const pages: Record<string, string> = {};
  /** The newest evidence entries each builder turn was shown: call, tool, and code or verdict. */
  const seen: Record<string, string[]> = {};
  let cellHandle = "", likeHandle = "", ownLikeHandle = "", destinationReference = "", destinationsFrom = "";
  let destinations: JsonObject[] = [];
  let dialogLocation: unknown;
  let clicksBeforeLike = 0, clicksAfterLike = 0, clicksBeforeUnlike = 0, clicksAfterUnlike = 0, clicksBeforeAgain = 0, clicksAfterAgain = 0;
  let unlike: JsonObject = {}, again: JsonObject = {};
  let postShowsLikeAfterUnlike = false, postShowsLikeAfterAgain = false;
  let readsBeforeTest = 0;
  let submission: JsonObject = {}, trialUnlike: JsonObject = {};
  let readsAfterTest = 0, trialAct = "";
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
      seen[`step-${turn.step}`] = turn.evidence.slice(-4).map(entry => `${entry.callId} ${entry.toolId} ${String(entry.value.code ?? entry.value.verdict ?? entry.value.ok)}`);
      if (turn.step === 1) return node("profile", "web.output.browser-navigate", { url: profile });
      if (turn.step === 2) {
        const cell = turn.shownPage().split("\n").find(line => /^t\d+ link /u.test(line) && line.endsWith(` ~/p/${LIKED.code}/`))?.split(" ")[0];
        if (!cell) throw new Error("diagnostic.grid_cell_missing");
        cellHandle = cell;
        return node("open.post", "web.output.dom-click", { target: { handle: cell } });
      }
      if (turn.step === 3) {
        await page.getByRole("dialog").waitFor({ timeout: 6000 });
        return node("dialog.read", "web.output.dom-capture_snapshot", {});
      }
      if (turn.step === 4) {
        // The lists the dialog view read complete: refs issued at the dialog's pushed address.
        for (const callId of ["dialog.read", "open.post"]) {
          const answer = [...turn.evidence].reverse().find(entry => entry.callId === callId)?.value;
          const collections = record(answer?.resetDestinations).collections as JsonObject[] | undefined;
          if (collections?.length) {
            destinations = collections;
            destinationsFrom = callId;
            dialogLocation = answer?.location;
            break;
          }
        }
        const reference = destinations[0]?.ref;
        if (typeof reference !== "string") throw new Error("diagnostic.dialog_destination_ref_missing");
        destinationReference = reference;
        likeHandle = postActionHandle(turn.shownPage(), "Like");
        clicksBeforeLike = observed.clicks();
        return node("like", "web.output.dom-click", { target: { handle: likeHandle } }, ["modify_existing"], { resetDestination: destinationReference });
      }
      if (turn.step === 5) {
        clicksAfterLike = observed.clicks();
        return node("own.open", "web.output.browser-navigate", { url: likedPage });
      }
      if (turn.step === 6) {
        clicksBeforeUnlike = observed.clicks();
        return node("unlike", "web.output.dom-click", { target: { handle: postActionHandle(turn.shownPage(), "Unlike") } }, ["modify_existing"], { undoes: LIKE_ACT });
      }
      if (turn.step === 7) {
        unlike = record(last("core.run_node"));
        clicksAfterUnlike = observed.clicks();
        postShowsLikeAfterUnlike = await page.locator(POST_SHOWS_LIKE).first().isVisible();
        clicksBeforeAgain = observed.clicks();
        // The control already shows the state the build found: pressing it would like the post again.
        return node("unlike.again", "web.output.dom-click", { target: { handle: postActionHandle(turn.shownPage(), "Like") } }, ["modify_existing"], { undoes: LIKE_ACT });
      }
      if (turn.step === 8) {
        again = record(last("core.run_node"));
        clicksAfterAgain = observed.clicks();
        postShowsLikeAfterAgain = await page.locator(POST_SHOWS_LIKE).first().isVisible();
        // The plan's part asks for the Like, so the Flow likes the post where the build last saw its control: on the post's own page,
        // whose view now holds the Like's handle (see the header). Reopening the dialog would press the standalone page's identity there.
        ownLikeHandle = postActionHandle(turn.shownPage(), "Like");
        return call("submit", "core.submit_subflow", { flow: [
          `flow: Like post`,
          `step post: open the post's own page`, `  node: web.browser-navigate`, `  url: ${JSON.stringify(likedPage)}`,
          `step like: like the post`, `  node: web.dom.click`, `  target: ${ownLikeHandle}`, `  consequences: modify_existing`
        ].join("\n") });
      }
      const submitted = last("core.submit_subflow");
      submission = record(submitted);
      if (typeof submitted?.revision !== "number" || typeof submitted.digest !== "string") throw new Error("diagnostic.submission_refused");
      const candidate = { revision: submitted.revision, digest: submitted.digest };
      if (turn.step === 9) {
        readsBeforeTest = observed.reads.length;
        return call("trial.settled", "core.test_subflow", candidate);
      }
      if (turn.step === 10) {
        readsAfterTest = observed.reads.length;
        const tested = record(last("core.test_subflow"));
        tests.push(tested);
        if (trialCode(tested) !== "yes") return turn.complete({ subflowKey: "main", ...candidate });
        // The passing trial left its own Like on the site (photo-toggle.spec.ts): asked again, the gate names it.
        return call("trial.after", "core.test_subflow", candidate);
      }
      if (turn.step === 11) {
        const after = record(last("core.test_subflow"));
        tests.push(after);
        const act = actsUnder(after, "actsToUndo").find(entry => entry.act !== LIKE_ACT && entry.act !== OPEN_ACT && entry.call === undefined)?.act;
        if (!act) return turn.complete({ subflowKey: "main", ...candidate });
        trialAct = act;
        return node("own.again", "web.output.browser-navigate", { url: likedPage });
      }
      if (turn.step === 12) return node("unlike.trial", "web.output.dom-click", { target: { handle: postActionHandle(turn.shownPage(), "Unlike") } }, ["modify_existing"], { undoes: trialAct });
      if (turn.step === 13) {
        trialUnlike = record(last("core.run_node"));
        return call("trial.final", "core.test_subflow", candidate);
      }
      if (turn.step === 14) tests.push(record(last("core.test_subflow")));
      return turn.complete({ subflowKey: "main", ...candidate });
    };
    const provider = bindScriptedProvider(installed, { task: TASK, permitted: ["modify_existing"], instructionSourceId: build.instructionSourceId, maxIterations: 24, maxCallsPerRun: 36, builder });
    const { ending, failure } = await build.run();
    const { declarations, reads } = observed;
    const clicks = { clicksBeforeLike, clicksAfterLike, clicksBeforeUnlike, clicksAfterUnlike, clicksBeforeAgain, clicksAfterAgain, end: observed.clicks() };
    // Where each list group was read: the dialog view's groups, and whether any read at the pushed address after the dialog closed holds them.
    const dialogReads = reads.filter(read => read.call === destinationsFrom);
    const dialogGroups = [...new Set(dialogReads.flatMap(read => read.groups))];
    const laterAtAddress = reads.slice(reads.indexOf(dialogReads.at(-1)!) + 1).filter(read => read.location === dialogLocation && read.call !== "like");
    const groupsReadAgain = dialogGroups.filter(group => laterAtAddress.some(read => read.groups.includes(group)));
    const preTrialReads = reads.slice(readsBeforeTest, readsAfterTest || undefined).map(read => ({ call: read.call, atAddress: read.location === dialogLocation, groups: read.groups.length, holdsDialogGroup: read.groups.some(group => dialogGroups.includes(group)) }));
    const started = startedWithActs(tests[0]);
    const startedLike = started.find(act => act.act === LIKE_ACT);
    const unlikeSettlement = record(unlike.resetSettlement);
    const diagnostic = { ending, failure, openAct: OPEN_ACT, likeAct: LIKE_ACT, started, builderStep: provider.builderSteps(), destinationReference, destinations, destinationsFrom, cellHandle, likeHandle, ownLikeHandle, dialogLocationIsPostAddress: dialogLocation === likedPage, dialogGroups, groupsReadAgain, preTrialReads, clicks, unlike, again, postShowsLikeAfterUnlike, postShowsLikeAfterAgain, tests, reads, declarations, outcomes: observed.outcomes, receipts: provider.receipts, gatewayErrors: installed.gatewayErrors, trialAct, trialUnlike, submission, seen, pages };
    await keepDiagnostic(testInfo, "reset-photo-dialog.json", diagnostic);
    console.log(JSON.stringify({ resetDiagnostic: { ending, failure, destinationReference, destinationsFrom, groupsReadAgain: groupsReadAgain.length, unlike: unlike.ok ?? unlike.code, unlikeOpen: unlikeSettlement.open ?? unlikeSettlement.settled ?? null, again: again.code, failed: again.failed, canMeet: again.canMeet, tests: tests.map(trialCode), trialAct, trialUnlike: trialUnlike.ok ?? trialUnlike.code ?? null, startedLike: startedLike?.did ?? null } }));
    // 1. The dialog view issued refs at the post's pushed address; the Like inside the dialog named the first, declared modify_existing, and was dispatched once.
    expect(destinationReference).toMatch(/^destination-[1-9][0-9]{0,3}$/u);
    expect(dialogLocation).toBe(likedPage);
    const like = declarations.find(declaration => declaration.call === "like");
    expect(like?.consequences).toEqual(["modify_existing"]);
    expect(like?.permitted).toBe(true);
    expect(like?.dialog).toBeDefined();
    expect(clicksAfterLike).toBe(clicksBeforeLike + 1);
    // 2. Pressed back on the post's own page under undoes: the same place, admitted, dispatched once, the control back; the Like's act stays open only on its list.
    const back = declarations.find(declaration => declaration.call === "unlike");
    expect(back?.permitted).toBe(true);
    expect(back?.place).toBe(like?.place);
    expect(back?.dialog).toBeUndefined();
    expect(unlike.ok).toBe(true);
    expect(clicksAfterUnlike).toBe(clicksBeforeUnlike + 1);
    expect(postShowsLikeAfterUnlike).toBe(true);
    // Its toggle is back, so only its list is still owed: the list Core has not yet tried to read again at the dialog's address.
    expect(unlikeSettlement.open).toBe(LIKE_ACT);
    expect(String(unlikeSettlement.settle ?? "")).toContain(`Read ${destinationReference} at ${likedPage} completely again`);
    expect(String(unlikeSettlement.settle ?? "")).not.toContain("press that same control back");
    // 3. Pressed again under undoes: refused unrun, the control already back, nothing clicked; the act is still open,
    // so a look on this page meets it (t751 R2), as step 4's look settling it shows.
    const aimed = declarations.find(declaration => declaration.call === "unlike.again");
    expect(again.ok).toBe(false);
    expect(again.code).toBe("candidate.undo_already_back");
    expect(again.failed).toBe("already_back");
    expect(again.canMeet).toBe("this_page");
    expect(aimed?.permitted).toBe(false);
    expect(aimed?.place).toBe(like?.place);
    expect(clicksAfterAgain).toBe(clicksBeforeAgain);
    expect(postShowsLikeAfterAgain).toBe(true);
    // 4. The trial is admitted and runs: Core's own look at the dialog's address read the standalone page, which never holds the
    // dialog's list, so the list is lost; the Like's act settled restored, and the trial is told its list could not be read again.
    expect(preTrialReads.some(read => read.atAddress)).toBe(true);
    expect(preTrialReads.some(read => read.holdsDialogGroup)).toBe(false);
    expect(groupsReadAgain).toEqual([]);
    expect(["candidate.trial_reset_required", "candidate.trial_reset_unproved"]).not.toContain(trialCode(tests[0]));
    expect(actsUnder(tests[0], "actsToUndo")).toEqual([]);
    const trialSteps = (record(tests[0]!.feedback).steps as JsonObject[] | undefined) ?? [];
    expect(startedLike?.did).toContain("put back as far as fresh complete reads can show");
    expect(startedLike?.did).toContain(`(${destinationReference}) could not be read again`);
    // The trial runs its Flow to the end: the post's own page, then its Like, pressed where the Flow's handle names it.
    expect(trialSteps.map(step => [step.status, step.failureCode ?? null])).toEqual([["succeeded", null], ["succeeded", null]]);
    expect(trialSteps[1]?.control).toBe("Like");
    expect(trialCode(tests[0])).toBe("yes");
    // The trial's own Like, put back on the post's own page like photo-toggle.spec.ts's: the build then ends with its Flow.
    expect(trialAct).toMatch(/^act-[1-9][0-9]{0,3}$/u);
    expect(trialUnlike.ok).toBe(true);
    expect(trialCode(tests.at(-1))).toBe("yes");
    expect(ending).toBe("proposed");
  } finally {
    await build.stop();
    await installed.close();
  }
});
