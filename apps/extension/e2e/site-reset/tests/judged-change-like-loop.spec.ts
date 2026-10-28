// DRAFT (t775 F1): expected to fail until phase D wires the trial gates; typechecked only, not yet run headed.
import type { JsonObject } from "fluxiq/core";
import { STUDIO, gridFor } from "../../../../scenario-lab/src/scenarios/photo-social/data/index.js";
import { expect, test } from "../../fixtures/extension-context";
import { bindScriptedProvider, keepDiagnostic, projectBuild, startInstalledBuild, trialCode, type BuilderTurn, type ScriptedAnswer } from "../index";
import { PHOTO_ROOT, bindDetectingRuntime, gridCellHandle, gridColumns, likedPosts, openPhotoProfile, postActionHandle } from "../photo-build";
import { actsWithOutcome, judgeLog, proofsOf, retiredCodesIn, supervisorWithEffect } from "../change-proof";

/** The studio's grid: its pinned posts first, then the rest newest first. */
const GRID = gridFor(STUDIO);
const PINNED = GRID.find((post) => post.pinned)!;
const NEWEST = GRID.filter((post) => !post.pinned).slice(0, 3);
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};

/**
 * Photo-social like loop with earlier likes already in place (t775). Exploration likes one post (`first`) and leaves
 * it liked. The Flow reads the grid and walks `repeat most: 3` over open-then-like; Core writes `ensureState` on the
 * like step, so the pass on the liked post is skipped `already_in_state` and the other passes change the site. No
 * reset is asked, and the judge request's `siteChange` lists the skipped pass with its row.
 *
 * The `pinned` variant reads the whole grid, pinned tiles included, so one pass targets a pinned post that
 * exploration liked. It must show in `siteChange.acts` as an `already_in_state` act on that row, and the task lists
 * the pinned posts under `unchanged`, so the judge sees the row the Flow touched even though nothing changed on it.
 */
for (const variant of ["newest", "pinned"] as const) {
  test(`installed gateway project build judges a like loop by its change with earlier likes in place (${variant})`, async ({ extensionSession }, testInfo) => {
    test.setTimeout(480_000);
    const installed = await startInstalledBuild(extensionSession);
    const { page } = installed;
    const profile = new URL(`${PHOTO_ROOT}${STUDIO}/`, installed.origin).href;
    const first = variant === "pinned" ? PINNED : NEWEST[0]!;
    const firstPage = new URL(`${PHOTO_ROOT}p/${first.code}/`, installed.origin).href;
    const task = variant === "pinned" ? "Like the studio's three newest posts and leave the pinned posts as they are." : "Like the studio's three most recent posts.";
    const build = projectBuild(installed, `Installed change like loop ${variant}`, task, profile);
    const judge = variant === "newest" ? judgeLog({ quote: "three most recent posts", why: "the pinned tiles, which are older posts" }) : judgeLog();
    const answers: Record<string, JsonObject> = {};
    const pages: Record<string, string> = {};
    let columns: { link?: string; pin?: string } = {}, handle = "", likeHandle = "";
    let likedAtStart: string[] = [], likedAtEnd: string[] = [];
    try {
      await openPhotoProfile(page, installed.origin, profile);
      likedAtStart = await likedPosts(page);
      await installed.pair();
      const observed = bindDetectingRuntime(installed);
      let pending = "", finished = false;
      const send = (callId: string, made: ScriptedAnswer) => {
        pending = callId;
        return made;
      };
      const builder = async (turn: BuilderTurn): Promise<ScriptedAnswer> => {
        const { node, call } = turn;
        pages[`step-${turn.step}`] = turn.shownPage();
        const previous = pending;
        if (pending) {
          answers[pending] = record([...turn.evidence].reverse().find((entry) => entry.callId === pending)?.value);
          pending = "";
        }
        const submitted = answers["submit"];
        const candidate = typeof submitted?.revision === "number" && typeof submitted.digest === "string" ? { revision: submitted.revision, digest: submitted.digest } : undefined;
        const done = () => {
          finished = true;
          return turn.complete({ subflowKey: "main", ...(candidate ?? {}) });
        };
        if (finished) return done();
        switch (previous) {
          case "":
            return send("profile", node("profile", "web.output.browser-navigate", { url: profile }));
          case "profile": {
            const cell = gridCellHandle(turn.shownPage(), GRID[0]!.code);
            if (!cell) throw new Error("diagnostic.grid_cell_missing");
            return send("detect", call("detect", "web.detect_repeating_structure", { target: cell }));
          }
          case "detect": {
            handle = typeof answers["detect"]?.extraction === "string" ? answers["detect"].extraction : "";
            columns = gridColumns(answers["detect"]);
            if (!handle || !columns.link || !columns.pin) return done();
            return send("first.open", node("first.open", "web.output.browser-navigate", { url: firstPage }));
          }
          case "first.open":
            likeHandle = postActionHandle(turn.shownPage(), "Like");
            // The earlier like, left in place: no undo and no look naming it.
            return send("first.like", node("first.like", "web.output.dom-click", { target: { handle: likeHandle } }, ["modify_existing"]));
          case "first.like": {
            const where = variant === "newest" ? ["  extractList.where: [{\"field\": \"badge\", \"contains\": \"Pinned\", \"not\": true}]"] : [];
            const flow = [
              "flow: Like posts",
              "step profile: open the profile", "  node: web.browser.navigate", `  url: ${JSON.stringify(profile)}`,
              "step posts: list the posts", "  node: web.dom.extract_list",
              `  extractList: ${JSON.stringify({ handle, fields: { link: columns.link, badge: columns.pin } })}`,
              "  recordOutput: {\"datasetId\": \"liked-posts\", \"writeMode\": \"replace\"}",
              ...where, "  extractList.maxItems: 3",
              "step open: open the post", "  node: web.browser.navigate", "  url: $row.link", "  repeat over: posts", "  repeat through: like", "  repeat most: 3",
              "step like: like the post", "  node: web.dom.click", `  target: ${likeHandle}`, "  consequences: modify_existing"
            ].join("\n");
            return send("submit", call("submit", "core.submit_subflow", { flow }));
          }
          case "submit":
            if (!candidate) return done();
            return send("trial", call("trial", "core.test_subflow", candidate));
          case "trial":
            likedAtEnd = await likedPosts(page);
            return done();
          default:
            return done();
        }
      };
      const provider = bindScriptedProvider(installed, {
        task, permitted: ["modify_existing"], instructionSourceId: build.instructionSourceId, maxIterations: 16, maxCallsPerRun: 24, builder, verify: judge.verify,
        supervisor: supervisorWithEffect({ permitted: ["modify_existing"], maxIterations: 16, effect: { kind: "end_state", state: "the three posts are liked" }, ...(variant === "pinned" ? { unchanged: ["pinned posts"] } : {}) })
      });
      const { ending, failure } = await build.run();
      const siteChanges = judge.siteChanges();
      const retired = retiredCodesIn(answers, observed.outcomes, provider.receipts, failure);
      await keepDiagnostic(testInfo, `change-like-loop-${variant}.json`, { ending, failure, answers, retired, siteChanges, judgeRequests: judge.requests, likedAtStart, likedAtEnd, outcomes: observed.outcomes, receipts: provider.receipts, pages });

      // No retired reset code anywhere in the step log, and the judge request carries the site's change.
      expect(retired).toEqual([]);
      expect(trialCode(answers["trial"])).toBe("yes");
      expect(judge.requests.length).toBeGreaterThanOrEqual(1);
      const siteChange = siteChanges.at(-1);
      expect(siteChange).toBeDefined();
      // The post liked before the trial stayed liked (nothing was undone), and the trial added more.
      expect(likedAtEnd).toEqual(expect.arrayContaining([first.code]));
      expect(likedAtEnd.length).toBeGreaterThan(likedAtStart.length + 1);
      // The pass on the already-liked post is skipped and shown with its row; the others changed the site.
      const skipped = actsWithOutcome(siteChange, "already_in_state");
      expect(skipped.length).toBeGreaterThanOrEqual(1);
      // Each skipped act names its step and pass. A row name is asserted only where the row has text: the pinned tiles carry a badge,
      // while the newest rows hold only a link and Core never names a row by an address (activity/loop/row.ts, t378).
      expect(skipped.every((act) => typeof act.step === "number")).toBe(true);
      if (variant === "pinned") expect(skipped.every((act) => typeof act.row === "string")).toBe(true);
      expect(actsWithOutcome(siteChange, "changed").length).toBeGreaterThanOrEqual(1);
      // The newest variant's state was put there by the same explored step: proof carried, not a fresh yes.
      if (variant === "newest") expect(proofsOf(siteChange)).toContain("carried");
    } finally {
      await build.stop();
      await installed.close();
    }
  });
}
