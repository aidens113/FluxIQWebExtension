import type { JsonObject } from "fluxiq/core";
import { STUDIO, gridFor } from "../../../../scenario-lab/src/scenarios/photo-social/data/index.js";
import { expect, test } from "../../fixtures/extension-context";
import { judgeLog, retiredCodesIn } from "../change-proof";
import { actsUnder, bindScriptedProvider, keepDiagnostic, projectBuild, startInstalledBuild, startedWithActs, trialCode, type BuilderTurn, type ScriptedAnswer } from "../index";
import { PHOTO_ROOT, bindDetectingRuntime, gridCellHandle, gridColumns, likedPosts, openPhotoProfile, postActionHandle, postToggle } from "../photo-build";

const TASK = "Like the studio's first post.";
const GRID = gridFor(STUDIO);
/** The post a looped pass presses: the grid's first cell. */
const PRESSED = GRID[0]!;
/** The post exploration read the Like on, in its dialog: the step's control receipt belongs to this one. */
const READ_ON = GRID[4]!;
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};

/**
 * Photo rerun round 6 (`run-mvrj7qgf-a44a1427`, section 4): a looped trial step
 * whose control was read on one post (`READ_ON`) presses another post's control
 * (`PRESSED`) on its pass, on a different page. Core filed that pass's original
 * under the receipt's place and the pass's counts, so a restored like could
 * never settle: every settle said "press that same control back", and each
 * press after the first was `undo_already_back`.
 *
 * Expected: the pass's act is listed once, with its own control as the
 * settle; the Unlike on that post's own page under `undoes` is admitted and
 * lands; the act then settles (no act left to press back, none called
 * `undo_already_back`), and the next trial is admitted.
 *
 * t775: no trial is refused for an act in place, so the act is read from the
 * ledger's answer to a claim on an unlisted act. A repeat of a single-subflow
 * revision whose yes stands is answered with that judged run and not run again
 * (Core t679), so the next trial is a changed revision (a look after the
 * profile opens). It runs after the undo: the like step's control was only read
 * in exploration, never pressed, so it carries no toggle signature and no
 * `ensureState`, and a trial run with the pass's like in place would press it
 * off, leaving nothing for the undo to prove. A trial run with a like in place
 * is proven by photo-toggle.spec.ts and judged-change-like-loop.spec.ts.
 */
test("installed gateway project build settles a looped pass that pressed another post's control once that post is unliked", async ({ extensionSession }, testInfo) => {
  test.setTimeout(420_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const profile = new URL(`${PHOTO_ROOT}${STUDIO}/`, installed.origin).href;
  const pressedPage = new URL(`${PHOTO_ROOT}p/${PRESSED.code}/`, installed.origin).href;
  const build = projectBuild(installed, "Installed reset photo other item", TASK, () => installed.page.url());
  const pages: Record<string, string> = {};
  const answers: Record<string, JsonObject> = {};
  const sent: string[] = [];
  const tests: JsonObject[] = [];
  const judge = judgeLog();
  let cellHandle = "", readOnCell = "", likeHandle = "", handle = "", linkKey = "", act = "", actDid = "";
  let likedAfterTrial: string[] = [], likedAfterUndo: string[] = [], likedAtStart: string[] = [];
  let candidate: { revision: number; digest: string } | undefined;
  try {
    await openPhotoProfile(page, installed.origin, profile);
    likedAtStart = await likedPosts(page);
    await installed.pair();
    const observed = bindDetectingRuntime(installed);
    let pending = "";
    const send = (callId: string, made: ScriptedAnswer) => {
      pending = callId;
      sent.push(callId);
      return made;
    };
    // `look` adds a look after the profile opens: a changed revision that runs as a trial of its own (header).
    const flow = (look = false) => [
      "flow: Like the first post",
      "step profile: open the profile", "  node: web.browser.navigate", `  url: ${JSON.stringify(profile)}`,
      ...(look ? ["step look: look at the profile", "  node: web.dom.capture_snapshot"] : []),
      "step tiles: list the posts", "  node: web.dom.extract_list", `  extractList: ${JSON.stringify({ handle, fields: { link: linkKey } })}`,
      "step post: open the post", "  node: web.dom.click", `  target: ${cellHandle}`, "  consequences: none", "  repeat over: tiles", "  repeat through: like", "  repeat most: 1",
      "step like: like the post", "  node: web.dom.click", `  target: ${likeHandle}`, "  consequences: modify_existing"
    ].join("\n");
    const testNow = (turn: BuilderTurn) => {
      if (!candidate) throw new Error("diagnostic.no_candidate");
      const callId = `trial.${sent.filter(id => id.startsWith("trial.")).length + 1}`;
      return send(callId, turn.call(callId, "core.test_subflow", candidate));
    };
    const builder = async (turn: BuilderTurn): Promise<ScriptedAnswer> => {
      const { node, call } = turn;
      pages[`step-${turn.step}`] = turn.shownPage();
      const previous = pending;
      if (pending) {
        answers[pending] = record([...turn.evidence].reverse().find(entry => entry.callId === pending)?.value);
        pending = "";
      }
      if (previous.startsWith("trial.")) tests.push(answers[previous]!);
      switch (previous) {
        case "":
          return send("profile", node("profile", "web.output.browser-navigate", { url: profile }));
        case "profile": {
          const first = gridCellHandle(turn.shownPage(), PRESSED.code);
          const read = gridCellHandle(turn.shownPage(), READ_ON.code);
          if (!first || !read) throw new Error("diagnostic.grid_cell_missing");
          cellHandle = first;
          readOnCell = read;
          return send("detect", call("detect", "web.detect_repeating_structure", { target: first }));
        }
        case "detect": {
          handle = typeof answers["detect"]?.extraction === "string" ? answers["detect"].extraction : "";
          linkKey = gridColumns(answers["detect"]).link ?? "";
          if (!handle || !linkKey) throw new Error("diagnostic.detection_missing");
          return send("open.read", node("open.read", "web.output.dom-click", { target: { handle: readOnCell } }));
        }
        case "open.read":
          await page.getByRole("dialog").waitFor({ timeout: 6000 });
          return send("dialog.look", node("dialog.look", "web.output.dom-capture_snapshot", {}));
        case "dialog.look":
          // The control read on another post, in its dialog, unpressed: the like step's handle is saved from it.
          likeHandle = postActionHandle(turn.shownPage(), "Like");
          return send("submit", call("submit", "core.submit_subflow", { flow: flow() }));
        case "submit": {
          const submitted = answers["submit"];
          if (typeof submitted?.revision !== "number" || typeof submitted.digest !== "string") throw new Error("diagnostic.submission_refused");
          candidate = { revision: submitted.revision, digest: submitted.digest };
          return testNow(turn);
        }
        case "trial.1":
          likedAfterTrial = await likedPosts(page);
          // t775: the next trial is no longer refused while the like stands, so the act is read from a claim on an unlisted
          // act, which the ledger refuses unrun with the acts in place and each one's settle.
          return send("act.list", node("act.list", "web.output.browser-navigate", { url: profile }, [], { undoes: "act-9999" }));
        case "act.list": {
          const listed = actsUnder(answers[previous], "actsToUndo");
          act = listed.find(entry => entry.act)?.act ?? "";
          actDid = listed.find(entry => entry.act === act)?.did ?? "";
          if (!act) return turn.complete({ subflowKey: "main", ...candidate! });
          return send("own.open", node("own.open", "web.output.browser-navigate", { url: pressedPage }));
        }
        case "own.open": {
          const toggle = postToggle(turn.shownPage());
          if (!toggle) throw new Error("diagnostic.post_control_missing");
          return send("undo", node("undo", "web.output.dom-click", { target: { handle: toggle.handle } }, ["modify_existing"], { undoes: act }));
        }
        case "undo":
          likedAfterUndo = await likedPosts(page);
          return send("submit.next", call("submit.next", "core.submit_subflow", { flow: flow(true) }));
        case "submit.next": {
          const submitted = answers["submit.next"];
          if (typeof submitted?.revision !== "number" || typeof submitted.digest !== "string") throw new Error("diagnostic.next_submission_refused");
          candidate = { revision: submitted.revision, digest: submitted.digest };
          return testNow(turn);
        }
        default:
          return turn.complete({ subflowKey: "main", ...candidate! });
      }
    };
    const provider = bindScriptedProvider(installed, { task: TASK, permitted: ["modify_existing"], instructionSourceId: build.instructionSourceId, maxIterations: 30, maxCallsPerRun: 40, builder, verify: judge.verify });
    const { ending, failure } = await build.run();
    const summary = Object.fromEntries(sent.map(id => [id, { ok: answers[id]?.ok ?? null, code: trialCode(answers[id]) ?? null, failed: answers[id]?.failed ?? null, toUndo: actsUnder(answers[id], "actsToUndo").map(entry => [entry.act, entry.settle ?? null]), unsettleable: answers[id]?.actsUnsettleable ?? null }]));
    await keepDiagnostic(testInfo, "reset-photo-other-item.json", { ending, failure, builderStep: provider.builderSteps(), sent, act, liked: { start: likedAtStart, afterTrial: likedAfterTrial, afterUndo: likedAfterUndo }, answers, tests, siteChanges: judge.siteChanges(), reads: observed.reads, declarations: observed.declarations, outcomes: observed.outcomes, receipts: provider.receipts, gatewayErrors: installed.gatewayErrors, pages });
    console.log(JSON.stringify({ resetDiagnostic: { ending, failure, sent, act, summary, liked: [likedAtStart.length, likedAfterTrial.length, likedAfterUndo.length] } }));

    // The first trial ran and its looped pass liked the grid's first post, not the post the control was read on.
    expect(trialCode(tests[0])).toBe("yes");
    expect(likedAfterTrial).toEqual([PRESSED.code]);
    // The pass's act is listed once, with its own control as the settle (t775: read from the refusal of a claim on an unlisted act).
    expect(actsUnder(answers["act.list"], "actsToUndo")).toHaveLength(1);
    expect(act).toMatch(/^act-[1-9][0-9]{0,3}$/u);
    // Its settle names the page of the post the pass pressed, never the post the control was read on.
    expect(actsUnder(answers["act.list"], "actsToUndo")[0]?.settle).toContain(pressedPage);
    expect(actsUnder(answers["act.list"], "actsToUndo")[0]?.settle).not.toContain(`/p/${READ_ON.code}/`);
    expect(retiredCodesIn(answers, observed.outcomes, provider.receipts)).toEqual([]);
    // The Unlike on that post's own page under `undoes` is admitted and lands: a structured answer, never undo_already_back.
    expect(answers["undo"]?.ok).toBe(true);
    expect(answers["undo"]?.code).toBeUndefined();
    expect(answers["undo"]?.failed).not.toBe("already_back");
    expect(observed.declarations.find(declaration => declaration.call === "undo")?.permitted).toBe(true);
    expect(likedAfterUndo).toEqual(likedAtStart);
    // The act settled: the next trial (a changed revision) is admitted and runs, with nothing to undo, no unsettleable act and no
    // act it started with, and its judge is not told the settled act was left from earlier.
    expect(tests).toHaveLength(2);
    const next = tests[1];
    expect(trialCode(next)).not.toBe("candidate.undo_unproved");
    expect(actsUnder(next, "actsToUndo")).toEqual([]);
    expect(Array.isArray(next?.actsUnsettleable) ? next.actsUnsettleable : []).toEqual([]);
    expect(startedWithActs(next).map(entry => entry.act)).not.toContain(act);
    expect(trialCode(next)).toBe("yes");
    expect(next?.trialRunId).not.toBe(tests[0]?.trialRunId);
    const changes = judge.siteChanges();
    expect(changes).toHaveLength(2);
    expect(changes[1]).toBeDefined();
    const left = Array.isArray(changes[1]?.leftFromEarlier) ? changes[1]!.leftFromEarlier as JsonObject[] : [];
    expect(actDid).not.toBe("");
    expect(left.map(entry => entry.did)).not.toContain(actDid);
  } finally {
    await build.stop();
    await installed.close();
  }
});
