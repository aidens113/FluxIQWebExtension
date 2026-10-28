import type { JsonObject } from "fluxiq/core";
import { STUDIO, gridFor } from "../../../../scenario-lab/src/scenarios/photo-social/data/index.js";
import { expect, test } from "../../fixtures/extension-context";
import { judgeLog, retiredCodesIn } from "../change-proof";
import { actsUnder, bindScriptedProvider, keepDiagnostic, projectBuild, startInstalledBuild, startedWithActs, trialCode, type BuilderTurn, type ScriptedAnswer } from "../index";
import { PHOTO_ROOT, bindDetectingRuntime, gridCellHandle, gridColumns, likedPosts, openPhotoProfile, postActionHandle, postToggle } from "../photo-build";

const TASK = "Like the studio's first post.";
/** The studio's grid; its first cell (a pinned post) is the one round 5 liked in the dialog. The fixture starts with nothing liked. */
const GRID = gridFor(STUDIO);
const FIRST = GRID[0]!;
/** The post exploration likes in its dialog first, as round 5 liked the clip in cell 5 (act-11) before submitting revision 1. */
const EXPLORED = GRID[4]!;
/** Core's settle for a toggle whose control still shows the state its act set (Core `site-reset/words.ts`): what the reset presses. */
const CONTROL_SETTLE = /still shows the state this act set: press that same control back once/u;
/** Where such a settle says the control is, when it says. */
const settleLocation = (settle: string | undefined) => /^Its control at (\S+) still shows/u.exec(settle ?? "")?.[1];
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
const feedbackSteps = (tested: JsonObject | undefined) => (record(tested?.feedback).steps as JsonObject[] | undefined) ?? [];

/** One press the builder made under `undoes`, as the reset asked: the act, and how many posts the account had liked just before and just after it. */
type UndoPress = { act: string; shows: string; ok: unknown; code: unknown; likedBefore: number; likedAfter: number; likedNotAtStart: number };
/** An act a gate could not settle by any call, as it named it. */
type Unsettleable = { act: string; reason: unknown; failed: unknown };

function unsettleableIn(answer: JsonObject | undefined): Unsettleable[] {
  const listed = Array.isArray(answer?.actsUnsettleable) ? answer.actsUnsettleable : [];
  return listed.map(record).filter((entry) => typeof entry.act === "string").map((entry) => ({ act: String(entry.act), reason: entry.reason ?? null, failed: entry.failed ?? null }));
}

/**
 * Photo rerun round 5 (`run-mvhibis0-b536958b`, contributing cause, the run's
 * worst side effect): trial 1 opened a post's dialog from the grid inside a
 * loop and liked it there (act-13); every listing of that act carried no place
 * and no settle, so it never seeded the start of the post's control, and the
 * builder waved it through under `cannotUndo`. Trial 2 opened that post's own
 * page and pressed its control, taking act-13 back (act-14); with no start
 * known, Core's control tracker seeded the start from act-14's own before --
 * the liked state act-13 had made -- and asked the reset to "press that same
 * control back". The reset did, and the post the build found unliked was left
 * liked, reported settled.
 *
 * t751 R1 (`t751-reset-by-observed-state.md`): a place's start is its first
 * report while no build act has landed there, a trial act's `before` seeds it
 * only when no press at that place was ever recorded, and an act that lands
 * with no witness is `gate_unsatisfiable` with its condition named.
 *
 * The build, in round 5's order: exploration opens the studio's profile,
 * detects its grid, opens another post's dialog from its cell and likes it
 * there (round 5's act-11), looks at the dialog -- the like step's handle is
 * then saved under the name the liked control shows, as round 5's was (0088)
 * -- and never looks at the first post before its trial. Revision 1, submitted while that like
 * is in place, reads the grid and, `repeat over` it (`repeat most: 2`), presses
 * the row's cell and the Like in the dialog it opens; once the explored like is
 * pressed back its trial likes the first post there. The builder then opens
 * the first post's own page for the first time and takes its control's handle
 * as it shows now, liked. (Shapes that looked at the first post before its
 * trial gave the dialog act a place on today's Core: runs 1 and 2 of t751-h2,
 * recorded in its report.) Revision 2 opens the post's own page and presses its
 * control; before its trial the builder answers the gate as round 5's did: a
 * control settle is pressed back on its page under `undoes`, an act listed with
 * no settle is named under `cannotUndo`. After revision 2's trial it asks the
 * gate again and answers it the same way.
 *
 * Expected: no press made under `undoes` ever leaves a post liked that the
 * build found unliked; the build ends with the account as it found it, or an
 * act whose place is unknown ends honestly (`gate_unsatisfiable`, its
 * condition named) instead of being waved through under `cannotUndo`.
 */
test("installed gateway project build never presses a post into a state the build did not find after a dialog act and its own-page twin", async ({ extensionSession }, testInfo) => {
  test.setTimeout(600_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const profile = new URL(`${PHOTO_ROOT}${STUDIO}/`, installed.origin).href;
  const firstPage = new URL(`${PHOTO_ROOT}p/${FIRST.code}/`, installed.origin).href;
  const build = projectBuild(installed, "Installed reset photo dialog act", TASK, () => installed.page.url());
  const pages: Record<string, string> = {};
  /** Each scripted call's own answer, by call id. */
  const answers: Record<string, JsonObject> = {};
  const sent: string[] = [];
  const tests: JsonObject[] = [];
  const judge = judgeLog();
  /** Each test's input beyond the candidate: the acts it named under cannotUndo. */
  const testInputs: Array<{ call: string; cannotUndo: string[] }> = [];
  const undoPresses: UndoPress[] = [];
  /** Acts a gate listed to undo with no control settle (no place): round 5 named act-13 so under cannotUndo. */
  const placeless = new Set<string>();
  let cellHandle = "", exploredCellHandle = "", likeHandle = "", ownLikeHandle = "", handle = "", linkKey = "";
  let likedAfterExploredLike: string[] = [];
  let likedAtStart: string[] = [], likedAfterTrial1: string[] | undefined, likedAfterTrial2: string[] | undefined, likedAtEnd: string[] = [];
  try {
    await openPhotoProfile(page, installed.origin, profile);
    likedAtStart = await likedPosts(page);
    await installed.pair();
    const observed = bindDetectingRuntime(installed);
    let pending = "", pendingUndo: { act: string; shows: string; likedBefore: string[] } | undefined;
    let finished = false, phase: "rev1" | "rev2" = "rev1", rev2Ran = false, resets = 0, calls = 0;
    let candidate: { revision: number; digest: string } | undefined;
    /** What the builder does next, in order: each makes one call when its turn comes. */
    const queue: Array<(turn: BuilderTurn) => ScriptedAnswer | Promise<ScriptedAnswer>> = [];
    const send = (callId: string, made: ScriptedAnswer) => {
      pending = callId;
      sent.push(callId);
      return made;
    };
    const revision1 = () => [
      "flow: Like the first post",
      "step profile: open the profile",
      "  node: web.browser.navigate",
      `  url: ${JSON.stringify(profile)}`,
      "step tiles: list the posts",
      "  node: web.dom.extract_list",
      `  extractList: ${JSON.stringify({ handle, fields: { link: linkKey } })}`,
      "step post: open the post",
      "  node: web.dom.click",
      `  target: ${cellHandle}`,
      "  consequences: none",
      "  repeat over: tiles",
      "  repeat through: like",
      "  repeat most: 2",
      "step like: like the post",
      "  node: web.dom.click",
      `  target: ${likeHandle}`,
      "  consequences: modify_existing"
    ].join("\n");
    const revision2 = () => [
      "flow: Like the first post",
      "step open: open the post",
      "  node: web.browser.navigate",
      `  url: ${JSON.stringify(firstPage)}`,
      "step like: like the post",
      "  node: web.dom.click",
      `  target: ${ownLikeHandle}`,
      "  consequences: modify_existing"
    ].join("\n");
    /** A test of the latest revision, naming under cannotUndo every placeless act a gate listed. */
    const testNow = (turn: BuilderTurn) => {
      if (!candidate) throw new Error("diagnostic.no_candidate");
      const callId = `test.${++calls}`;
      const cannotUndo = [...placeless];
      testInputs.push({ call: callId, cannotUndo });
      return send(callId, turn.call(callId, "core.test_subflow", { ...candidate, ...(cannotUndo.length ? { cannotUndo } : {}) }));
    };
    /** Answers a refused test as round 5's reset did: each control settle pressed back on its page under undoes; an act with none named under cannotUndo. */
    const planReset = (answer: JsonObject) => {
      for (const act of actsUnder(answer, "actsToUndo")) {
        if (!CONTROL_SETTLE.test(act.settle ?? "")) {
          placeless.add(act.act);
          continue;
        }
        const where = settleLocation(act.settle) ?? firstPage;
        queue.push((turn) => send(`undo.open.${act.act}`, turn.node(`undo.open.${act.act}`, "web.output.browser-navigate", { url: where })));
        queue.push(async (turn) => {
          const toggle = postToggle(turn.shownPage());
          if (!toggle) throw new Error("diagnostic.post_control_missing");
          pendingUndo = { act: act.act, shows: toggle.shows, likedBefore: await likedPosts(page) };
          return send(`undo.${act.act}`, turn.node(`undo.${act.act}`, "web.output.dom-click", { target: { handle: toggle.handle } }, ["modify_existing"], { undoes: act.act }));
        });
      }
      queue.push(testNow);
    };
    const builder = async (turn: BuilderTurn): Promise<ScriptedAnswer> => {
      const { node, call } = turn;
      pages[`step-${turn.step}`] = turn.shownPage();
      const previous = pending;
      if (pending) {
        answers[pending] = record([...turn.evidence].reverse().find((entry) => entry.callId === pending)?.value);
        pending = "";
      }
      const done = () => {
        finished = true;
        return turn.complete({ subflowKey: "main", ...(candidate ?? {}) });
      };
      // A later brief, or a turn after the script's end, is not scripted: it completes at once.
      if (finished) return done();
      if (pendingUndo && previous === `undo.${pendingUndo.act}`) {
        const after = await likedPosts(page);
        const answer = answers[previous];
        undoPresses.push({ act: pendingUndo.act, shows: pendingUndo.shows, ok: answer?.ok ?? null, code: answer?.code ?? null, likedBefore: pendingUndo.likedBefore.length, likedAfter: after.length, likedNotAtStart: after.filter((code) => !likedAtStart.includes(code)).length });
        pendingUndo = undefined;
      }
      if (previous.startsWith("test.")) {
        const tested = answers[previous]!;
        tests.push(tested);
        const ran = typeof tested.trialRunId === "string";
        if (phase === "rev1" && ran) {
          likedAfterTrial1 = await likedPosts(page);
          phase = "rev2";
          // Only now the first post's own page, as round 5's builder first saw it after trial 1: its control shows the trial's like.
          queue.push((next) => send("own.look", next.node("own.look", "web.output.browser-navigate", { url: firstPage })));
          queue.push((next) => {
            const toggle = postToggle(next.shownPage());
            if (!toggle) throw new Error("diagnostic.post_control_missing");
            ownLikeHandle = toggle.handle;
            return send("submit.own", next.call("submit.own", "core.submit_subflow", { flow: revision2() }));
          });
        } else if (phase === "rev2" && ran && !rev2Ran) {
          rev2Ran = true;
          likedAfterTrial2 = await likedPosts(page);
          // The passing trial left its own act: asked again, the gate says what is still to put back.
          queue.push(testNow);
        } else if (actsUnder(tested, "actsToUndo").length && resets < 6) {
          resets++;
          planReset(tested);
        } else {
          return done();
        }
      }
      if (previous === "submit.dialog" || previous === "submit.own") {
        const submitted = answers[previous];
        if (typeof submitted?.revision !== "number" || typeof submitted.digest !== "string") return done();
        candidate = { revision: submitted.revision, digest: submitted.digest };
        queue.push(testNow);
      }
      const next = queue.shift();
      if (next) return await next(turn);
      switch (previous) {
        case "":
          return send("profile", node("profile", "web.output.browser-navigate", { url: profile }));
        case "profile": {
          // The grid, detected from its first cell.
          const cell = gridCellHandle(turn.shownPage(), FIRST.code);
          const explored = gridCellHandle(turn.shownPage(), EXPLORED.code);
          if (!cell || !explored) throw new Error("diagnostic.grid_cell_missing");
          cellHandle = cell;
          exploredCellHandle = explored;
          return send("detect", call("detect", "web.detect_repeating_structure", { target: cell }));
        }
        case "detect": {
          const packet = answers["detect"];
          handle = typeof packet?.extraction === "string" ? packet.extraction : "";
          linkKey = gridColumns(packet).link ?? "";
          if (!handle || !linkKey) return done();
          // Another post's cell: its press opens that post's dialog over the grid and pushes its address.
          return send("open.post", node("open.post", "web.output.dom-click", { target: { handle: exploredCellHandle } }));
        }
        case "open.post":
          await page.getByRole("dialog").waitFor({ timeout: 6000 });
          // Exploration likes that post in its dialog (round 5's act-11): a toggle with a place, settled later by its own press back.
          return send("explored.like", node("explored.like", "web.output.dom-click", { target: { handle: postActionHandle(turn.shownPage(), "Like") } }, ["modify_existing"]));
        case "explored.like":
          likedAfterExploredLike = await likedPosts(page);
          return send("dialog.look", node("dialog.look", "web.output.dom-capture_snapshot", {}));
        case "dialog.look":
          // The dialog's control as the view shows it now, liked: the like step's handle is saved under that name (round 5, 0088).
          likeHandle = postActionHandle(turn.shownPage(), "Unlike");
          // Submitted while the explored like is in place; the first post is never looked at before its trial.
          return send("submit.dialog", call("submit.dialog", "core.submit_subflow", { flow: revision1() }));
        default:
          return done();
      }
    };
    const provider = bindScriptedProvider(installed, { task: TASK, permitted: ["modify_existing"], instructionSourceId: build.instructionSourceId, maxIterations: 40, maxCallsPerRun: 60, builder, verify: judge.verify });
    const { ending, failure } = await build.run();
    likedAtEnd = await likedPosts(page);
    const unsettleable = tests.flatMap(unsettleableIn);
    // Placeless acts a passing trial said it started with: waved through under cannotUndo.
    const wavedThrough = tests.flatMap((tested) => startedWithActs(tested)).filter((act) => placeless.has(act.act)).map((act) => act.act);
    const listed = tests.map((tested) => ({
      code: trialCode(tested) ?? null,
      ran: typeof tested.trialRunId === "string",
      steps: feedbackSteps(tested).map((step) => [step.status, step.failureCode ?? null]),
      actsToUndo: actsUnder(tested, "actsToUndo").map((act) => [act.act, act.did.split(" ").slice(0, 5).join(" "), CONTROL_SETTLE.test(act.settle ?? "") ? "control_settle" : act.settle ? "other_settle" : "no_settle"]),
      startedWith: startedWithActs(tested).map((act) => act.act),
      unsettleable: unsettleableIn(tested)
    }));
    const liked = { atStart: likedAtStart.length, afterTrial1: likedAfterTrial1?.length ?? null, firstAfterTrial1: likedAfterTrial1?.includes(FIRST.code) ?? null, afterTrial2: likedAfterTrial2?.length ?? null, atEnd: likedAtEnd.length, firstAtEnd: likedAtEnd.includes(FIRST.code) };
    const diagnostic = { ending, failure, builderStep: provider.builderSteps(), sent, handle, linkKey, cellHandle, exploredCellHandle, likedAfterExploredLike: likedAfterExploredLike.length, likeHandle, ownLikeHandle, liked, undoPresses, placeless: [...placeless], wavedThrough, unsettleable, siteChanges: judge.siteChanges(), testInputs, listed, answers, tests, reads: observed.reads, declarations: observed.declarations, outcomes: observed.outcomes, receipts: provider.receipts, gatewayErrors: installed.gatewayErrors, pages };
    await keepDiagnostic(testInfo, "reset-photo-dialog-act.json", diagnostic);
    console.log(JSON.stringify({ resetDiagnostic: { ending, failure, sent, codes: Object.fromEntries(sent.map((callId) => [callId, answers[callId]?.code ?? answers[callId]?.verdict ?? (answers[callId]?.ok === true ? "ok" : null)])), liked, listed, testInputs, undoPresses, placeless: [...placeless], wavedThrough } }));

    // Exploration: the grid detected, the first post's dialog opened from its cell, one stable handle for its Like in the dialog and on its own page.
    expect(handle).toMatch(/^extraction\.[0-9]+$/u);
    expect(likeHandle).toMatch(/^t[0-9]+$/u);
    expect(ownLikeHandle).toMatch(/^t[0-9]+$/u);
    expect(likedAtStart).toEqual([]);
    // Exploration liked the other post in its dialog before revision 1 was submitted.
    expect(likedAfterExploredLike).toEqual([EXPLORED.code]);
    // Revision 1's trial ran (t775: with the explored like left in place) and liked the first post in the dialog its cell opened.
    expect(tests.some((tested) => typeof tested.trialRunId === "string")).toBe(true);
    expect(likedAfterTrial1).toContain(FIRST.code);
    // The reset never presses a post into a state other than the one the build found it in.
    expect(undoPresses.filter((press) => press.likedNotAtStart > 0)).toEqual([]);
    // An act whose place is unknown is never waved through under cannotUndo.
    expect(wavedThrough).toEqual([]);
    // t775: an act no call can settle never refuses a trial, so none is listed unsettleable; the acts the build left in place
    // are told to the judge instead. The first trial ran with the explored like in place, and each judge request carries the
    // site's change with that like (and, for the second, the first trial's like) under `leftFromEarlier`.
    expect(unsettleable).toEqual([]);
    expect(retiredCodesIn(tests, answers, observed.outcomes, provider.receipts, failure)).toEqual([]);
    const siteChanges = judge.siteChanges();
    expect(siteChanges.length).toBeGreaterThanOrEqual(1);
    for (const siteChange of siteChanges) expect(siteChange).toBeDefined();
    const leftCounts = siteChanges.map((siteChange) => (Array.isArray(siteChange?.leftFromEarlier) ? siteChange.leftFromEarlier.length : 0));
    expect(leftCounts[0]).toBeGreaterThanOrEqual(1);
    if (leftCounts.length > 1) expect(leftCounts[1]).toBeGreaterThanOrEqual(leftCounts[0]!);
  } finally {
    await build.stop();
    await installed.close();
  }
});
