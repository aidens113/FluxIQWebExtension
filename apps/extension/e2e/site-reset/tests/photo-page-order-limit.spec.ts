import type { JsonObject } from "fluxiq/core";
import { STUDIO, gridFor } from "../../../../scenario-lab/src/scenarios/photo-social/data/index.js";
import { expect, test } from "../../fixtures/extension-context";
import { bindScriptedProvider, keepDiagnostic, projectBuild, startInstalledBuild, trialCode, type BuilderTurn, type ScriptedAnswer, type ScriptedVerification } from "../index";
import { PHOTO_ROOT, bindDetectingRuntime, gridCellHandle, gridColumns, issuesIn, likedPosts, openPhotoProfile, postActionHandle } from "../photo-build";

const TASK = "Like the studio's three most recent posts.";
/** The studio's grid: its pinned posts first, then the rest newest first. The three newest are the first three unpinned. */
const GRID = gridFor(STUDIO);
const PINNED = new Set(GRID.filter((post) => post.pinned).map((post) => post.code));
const NEWEST = GRID.filter((post) => !post.pinned).slice(0, 3).map((post) => post.code);
const ORDER_RULE = "record_output.process_order_in_repeat";
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
const feedbackSteps = (tested: JsonObject | undefined) => (record(tested?.feedback).steps as JsonObject[] | undefined) ?? [];

/**
 * Photo rerun round 5 (`run-mvhibis0-b536958b`, decisive cause): Core's
 * listing-order rule (`script-statements/listing-order-in-repeat.ts`, t741)
 * refused every script whose lasting repeat walked a listing with a process
 * sort or limit, and the web domain writes a read's `extractList.maxItems` into
 * the record output's `process.limit` at plan time
 * (`plan-resolution/extraction/run-record-output.ts`). So the one coherent
 * shape -- leave the pinned tiles out with `extractList.where`, read three,
 * `repeat most: 3` over a lasting press -- was refused at
 * `recordOutput.process.limit`, a key the model never wrote (0112-0113), and
 * the brief ended between that and the rule's own `extractList.sort`.
 *
 * t751 R5 (`t751-reset-by-observed-state.md`): the listing declares
 * `answersRows: "page_order"`; Core admits `process.limit: N` with no sort
 * where the For Each it feeds has `repeat most: N`, and refuses only at the key
 * the model wrote.
 *
 * The builder opens the studio's profile, detects the grid from its first
 * cell, reads it once leaving the pinned tiles out (the read keeps no pinned
 * post), opens the first unpinned post to see its Like, then submits: read
 * the grid with `extractList.where` and `extractList.maxItems: 3`, and for
 * each row, `repeat over` it with `repeat most: 3`, open the row's address and
 * press Like, `consequences: modify_existing`. Expected: the submission is
 * accepted, and its trial likes exactly the three newest posts -- none
 * pinned -- read off the site's own account state.
 */
test("installed gateway project build submits a where-filtered read of three walked by repeat most 3 and likes exactly three unpinned posts", async ({ extensionSession }, testInfo) => {
  test.setTimeout(420_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const profile = new URL(`${PHOTO_ROOT}${STUDIO}/`, installed.origin).href;
  const firstNewest = new URL(`${PHOTO_ROOT}p/${NEWEST[0]}/`, installed.origin).href;
  const build = projectBuild(installed, "Installed reset photo page order", TASK);
  const pages: Record<string, string> = {};
  /** Each scripted call's own answer, by call id. */
  const answers: Record<string, JsonObject> = {};
  const sent: string[] = [];
  let columns: { link?: string; pin?: string } = {};
  let handle = "", likeHandle = "", flow = "";
  let likedAtStart: string[] = [], likedAfterTrial: string[] | undefined;
  try {
    await openPhotoProfile(page, installed.origin, profile);
    likedAtStart = await likedPosts(page);
    await installed.pair();
    const observed = bindDetectingRuntime(installed);
    let pending = "";
    let finished = false;
    const send = (callId: string, made: ScriptedAnswer) => {
      pending = callId;
      sent.push(callId);
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
      // A later brief, or a turn after the script's end, is not scripted: it completes at once.
      if (finished) return done();
      switch (previous) {
        case "":
          return send("profile", node("profile", "web.output.browser-navigate", { url: profile }));
        case "profile": {
          // The grid, detected from its first cell (a pinned post).
          const cell = gridCellHandle(turn.shownPage(), GRID[0]!.code);
          if (!cell) throw new Error("diagnostic.grid_cell_missing");
          return send("detect", call("detect", "web.detect_repeating_structure", { target: cell }));
        }
        case "detect": {
          const packet = answers["detect"];
          handle = typeof packet?.extraction === "string" ? packet.extraction : "";
          columns = gridColumns(packet);
          if (!handle || !columns.link || !columns.pin) return done();
          // One read of the grid with the pinned tiles left out, as the Flow will read it.
          return send("read", node("read", "web.output.dom-extract_list", { extractList: { handle, fields: { link: columns.link, badge: columns.pin }, where: [{ field: "badge", contains: "Pinned", not: true }] } }));
        }
        case "read":
          // The first unpinned post's own page: its Like, by the handle the Flow presses on every row's page.
          return send("post", node("post", "web.output.browser-navigate", { url: firstNewest }));
        case "post": {
          likeHandle = postActionHandle(turn.shownPage(), "Like");
          flow = [
            "flow: Like the three newest posts",
            "step profile: open the profile",
            "  node: web.browser.navigate",
            `  url: ${JSON.stringify(profile)}`,
            "step posts: list the posts that are not pinned",
            "  node: web.dom.extract_list",
            `  extractList: ${JSON.stringify({ handle, fields: { link: columns.link, badge: columns.pin } })}`,
            `  recordOutput: {"datasetId": "liked-posts", "writeMode": "replace"}`,
            `  extractList.where: [{"field": "badge", "contains": "Pinned", "not": true}]`,
            "  extractList.maxItems: 3",
            "step open: open the post",
            "  node: web.browser.navigate",
            "  url: $row.link",
            "  repeat over: posts",
            "  repeat through: like",
            "  repeat most: 3",
            "step like: like the post",
            "  node: web.dom.click",
            `  target: ${likeHandle}`,
            "  consequences: modify_existing"
          ].join("\n");
          return send("submit", call("submit", "core.submit_subflow", { flow }));
        }
        case "submit":
          if (!candidate) return done();
          return send("trial", call("trial", "core.test_subflow", candidate));
        case "trial":
          // What the trial left on the site, read off the account state of the page it ended on.
          likedAfterTrial = await likedPosts(page);
          return done();
        default:
          return done();
      }
    };
    // The judge's yes accounts for what the read's condition left out as Core requires of any yes (t515, t574, t599): each
    // condition Core names (`condition N`) is named in a sentence quoting the request's own words for why a pinned tile is
    // not asked for, "three most recent posts", and so is any row it shows by id (`[row XXXXXX]`; not the example id in
    // its instructions). Core decides the verdict from that reply; nothing here passes the trial for it.
    const verify = (shown: string): ScriptedVerification => {
      const conditions = [...new Set([...shown.matchAll(/condition ([0-9]+) \(/gu)].map((match) => match[1]!))];
      const rows = [...new Set([...shown.matchAll(/(?<!as in )\[row ([A-Z2-9]{6})\]/gu)].map((match) => match[1]!))];
      const reasons = [
        ...conditions.map((number) => `The read's condition ${number} leaves the pinned tiles out: they are older posts, not among the "three most recent posts".`),
        ...(rows.length ? [`Rows ${rows.join(", ")} are left out: they are pinned tiles, older posts that are not among the "three most recent posts".`] : [])
      ];
      const words = ["The trial liked the three newest posts and no pinned one.", ...reasons].join(" ");
      return { summary: words, diagnosis: { answersRequest: "yes", observed: words } };
    };
    const provider = bindScriptedProvider(installed, { task: TASK, permitted: ["modify_existing"], instructionSourceId: build.instructionSourceId, maxIterations: 16, maxCallsPerRun: 24, builder, verify });
    const { ending, failure } = await build.run();
    const submission = answers["submit"] ?? {};
    const trial = answers["trial"];
    const submitIssues = issuesIn(submission).filter((issue) => issue.code !== "ok");
    const orderRefusals = submitIssues.filter((issue) => issue.code === ORDER_RULE);
    const readAnswer = answers["read"] ?? {};
    // The rows the exploration read kept, as the extension answered them (`read.extracted`), by the post each links to.
    const readRows = (Array.isArray(record(readAnswer.read).extracted) ? record(readAnswer.read).extracted as JsonObject[] : []).map(record);
    const rowCode = (row: JsonObject) => /\/p\/([^/]+)\//u.exec(String(row.link ?? ""))?.[1];
    const readRowsPinned = readRows.filter((row) => PINNED.has(rowCode(row) ?? "")).length;
    const readFirstThreeNewest = readRows.slice(0, 3).map(rowCode).join(",") === NEWEST.join(",");
    const likedAfter = likedAfterTrial ?? [];
    const counts = {
      likedAtStart: likedAtStart.length,
      likedAfterTrial: likedAfterTrial?.length ?? null,
      likedPinned: likedAfter.filter((code) => PINNED.has(code)).length,
      likedNewest: likedAfter.filter((code) => NEWEST.includes(code)).length
    };
    const diagnostic = { ending, failure, builderStep: provider.builderSteps(), sent, columns, handle, likeHandle, flow, counts, readRows: readRows.length, readRowsPinned, readFirstThreeNewest, submitIssues, answers, reads: observed.reads, declarations: observed.declarations, outcomes: observed.outcomes, receipts: provider.receipts, gatewayErrors: installed.gatewayErrors, pages };
    await keepDiagnostic(testInfo, "reset-photo-page-order.json", diagnostic);
    console.log(JSON.stringify({ resetDiagnostic: { ending, failure, sent, codes: Object.fromEntries(sent.map((callId) => [callId, answers[callId]?.code ?? answers[callId]?.verdict ?? (answers[callId]?.ok === true ? "ok" : null)])), columnsFound: { link: Boolean(columns.link), pin: Boolean(columns.pin) }, read: { rows: readRows.length, pinned: readRowsPinned, firstThreeNewest: readFirstThreeNewest }, submitIssues, revision: submission.revision ?? null, trial: trialCode(trial) ?? null, steps: feedbackSteps(trial).map((step) => [step.status, step.failureCode ?? null]), counts } }));

    // Exploration: the grid detected with a column for the address and one for the pinned badge; the read with the pinned tiles left out answered.
    expect(handle).toMatch(/^extraction\.[0-9]+$/u);
    expect(columns.link).toBeTruthy();
    expect(columns.pin).toBeTruthy();
    expect(answers["read"]?.ok).toBe(true);
    expect(readRows.length).toBeGreaterThanOrEqual(3);
    expect(readRowsPinned).toBe(0);
    expect(readFirstThreeNewest).toBe(true);
    expect(likeHandle).toMatch(/^t[0-9]+$/u);
    expect(likedAtStart).toEqual([]);
    // The submission: accepted, never refused by the listing-order rule (today: refused at recordOutput.process.limit, a key never written).
    expect(orderRefusals).toEqual([]);
    expect(submission.ok).not.toBe(false);
    expect(submission.revision).toBe(1);
    expect(typeof submission.digest).toBe("string");
    // The trial: run, judged yes, and it liked exactly the three newest posts, none pinned.
    expect(trial?.trialRunId).toMatch(/^trial\./u);
    expect(trialCode(trial)).toBe("yes");
    expect(counts.likedAfterTrial).toBe(3);
    expect(counts.likedPinned).toBe(0);
    expect([...likedAfter].sort()).toEqual([...NEWEST].sort());
  } finally {
    await build.stop();
    await installed.close();
  }
});
