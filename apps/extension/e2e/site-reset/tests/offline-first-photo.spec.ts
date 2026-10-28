import type { JsonObject } from "fluxiq/core";
import { STUDIO, gridFor } from "../../../../scenario-lab/src/scenarios/photo-social/data/index.js";
import { expect, test } from "../../fixtures/extension-context";
import { bindScriptedProvider, keepDiagnostic, projectBuild, readStepLog, startInstalledBuild, useOfflineTrialEnvironment, type BuilderTurn, type ScriptedAnswer } from "../index";
import { offlineFirstProof, offlineFirstVerify, twoPartPlan, type OfflineFirstJudged } from "../offline-first-build";
import { PHOTO_ROOT, bindDetectingRuntime, gridCellHandle, gridColumns, openPhotoProfile } from "../photo-build";
import type { SupervisorTurn } from "../scripted-provider";

const OPEN = "Open the studio's profile";
const LIST = "list the links of its three most recent posts";
const TASK = `${OPEN} and ${LIST}.`;
/** The words of the request that say which posts it asks for. */
const RECENT = "three most recent posts";
/** The studio's grid: its pinned posts first, then the rest newest first. The three most recent are the first three unpinned. */
const GRID = gridFor(STUDIO);
const UNPINNED = GRID.filter(post => !post.pinned).map(post => post.code);
const NEWEST = UNPINNED.slice(0, 3);
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};

/**
 * Trace plan P6 acceptance (t769 B14), photo-social: the second scenario of
 * `./offline-first-job.spec.ts`'s proof, on a grid read with a condition. A
 * headed, provider-free project build whose repair iteration is checked
 * offline, against the recording of the build's own last live test, and whose
 * final judged run runs live.
 *
 * Two subflows, as on the job board (a project build's judged whole run is
 * never offline-first, P6 D40): `open` opens the studio's profile, `posts`
 * reads its grid after `open`. `posts`' builder detects the grid from its
 * first cell, reads it once (each post's link and its pinned badge), then
 * submits three revisions of one read that differ only in the record output's
 * `process` (tier 1: computed from the rows the read answered; the read the
 * page is sent is the same):
 *
 * 1. Keeps the pinned tiles only (`badge contains "Pinned"`). Tested live, as
 *    no recording of `posts` exists yet; the judge says no, naming the three
 *    newest posts as missing.
 * 2. Keeps every unpinned post (`not`): too many rows. Tested offline against
 *    revision 1's recording; the judge says no on the recording, naming the
 *    fourth newest as kept though not asked for, and the no is kept: no reset
 *    folder, no command reaches the site, `checkedAgainst: "recorded_run"`.
 * 3. Keeps the unpinned posts, at most three (`limit: 3`). Tested offline
 *    first: it passes on the recording, then, in the same call, the site is
 *    reset and the revision runs live; the judge says yes.
 *
 * Then the supervisor assembles the Flow and tests it whole, live, after a
 * reset: yes, and only then does the build complete. Every yes accounts for
 * what the condition left out, as Core requires of a yes (each condition Core
 * names, and each row it shows by id, named beside the request's own words).
 */
test("installed gateway project build checks a computation-only repair of a grid read offline against the last live test and judges the final run live", async ({ extensionSession }, testInfo) => {
  test.setTimeout(420_000);
  const stepsDirectory = testInfo.outputPath("steps");
  const restoreEnvironment = useOfflineTrialEnvironment(stepsDirectory);
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const profile = new URL(`${PHOTO_ROOT}${STUDIO}/`, installed.origin).href;
  const build = projectBuild(installed, "Installed offline-first photo", TASK);
  const pages: Record<string, string> = {};
  /** Each scripted call's own answer, by call id. */
  const answers: Record<string, JsonObject> = {};
  const sent: string[] = [];
  const judged: OfflineFirstJudged[] = [];
  /** What the judge was first shown about each thing under test, for the diagnostic file only. */
  const shownBy: Record<string, string> = {};
  /** How many commands reached the site during each `posts` test (each command's action type), by its call id. */
  const siteActs: Record<string, string[] | number> = {};
  /** What is under test now, for the scripted judge: `open`, `posts-N`, or `whole`. */
  let testing = "", brief = "", handle = "";
  let columns: { link?: string; pin?: string } = {};
  let resolved: JsonObject | undefined;
  const completions: Array<{ brief: string; after: string }> = [];
  const generate = installed.service.generateFlowBootstrapAdaptation.bind(installed.service);
  installed.service.generateFlowBootstrapAdaptation = (async (...args: Parameters<typeof generate>) => {
    const value = await generate(...args);
    resolved = record(value);
    return value;
  }) as typeof installed.service.generateFlowBootstrapAdaptation;
  try {
    await openPhotoProfile(page, installed.origin, profile);
    await installed.pair();
    const observed = bindDetectingRuntime(installed);
    // Each subflow is callable (a plan of two), so its steps are written inside its own `part <key>:` block.
    const openFlow = () => ["flow: Open the profile", "part open: open the studio's profile", "  step profile: open the profile", "    node: web.browser.navigate", `    url: ${JSON.stringify(profile)}`, "end"].join("\n");
    /** `posts`' Flow at each revision: one read of the grid, its record output's `process` alone differing. */
    const postsFlow = (process: JsonObject) => [
      "flow: Recent post links",
      "part posts: list the links of the newest posts",
      "  step read: read the posts' links",
      "    node: web.dom.extract_list",
      `    extractList: ${JSON.stringify({ handle, fields: { link: columns.link, badge: columns.pin } })}`,
      `    recordOutput: ${JSON.stringify({ datasetId: "recent-posts", writeMode: "replace", process })}`,
      "end"
    ].join("\n");
    const pinned = { field: "badge", contains: "Pinned" };
    const revisions: JsonObject[] = [{ where: [pinned] }, { where: [{ ...pinned, not: true }] }, { where: [{ ...pinned, not: true }], limit: 3 }];
    let pending = "";
    const send = (callId: string, made: ScriptedAnswer) => {
      pending = callId;
      sent.push(callId);
      return made;
    };
    const supervisor = (turn: SupervisorTurn): ScriptedAnswer => {
      const assembled = record(turn.last("project.assemble")?.complete);
      switch (turn.step) {
        case 1:
          return turn.call("plan", "project.write_plan", twoPartPlan(turn.plan(), [
            { key: "open", name: "Open the profile", quote: OPEN, goal: "The studio's profile is open" },
            { key: "posts", name: "Recent post links", quote: LIST, goal: "The links of the studio's three most recent posts are listed" }
          ]));
        case 2:
          brief = "open";
          pending = "";
          return turn.call("dispatch.open", "project.dispatch", { reason: "Build the first subflow.", briefs: [{ kind: "build", subflowKey: "open", parts: ["p1"], entry: { caseId: "observed-current", predecessors: [] }, permittedActs: [], maxIterations: 8 }] });
        case 3:
          brief = "posts";
          pending = "";
          return turn.call("dispatch.posts", "project.dispatch", { reason: "Build the second subflow.", briefs: [{ kind: "build", subflowKey: "posts", parts: ["p2"], entry: { caseId: "observed-current", predecessors: ["open"] }, permittedActs: [], maxIterations: 16 }] });
        case 4:
          return turn.call("assemble", "project.assemble", {});
        case 5:
          testing = "whole";
          return turn.call("whole", "core.test_candidate", assembled);
        default:
          completions.push({ brief: "supervisor", after: String(turn.last("core.test_candidate")?.verdict ?? "none") });
          return turn.complete(assembled);
      }
    };
    const builder = (turn: BuilderTurn): ScriptedAnswer => {
      const { node, call } = turn;
      pages[`${brief}-step-${turn.step}`] = turn.shownPage();
      const previous = pending;
      if (pending) {
        answers[pending] = record([...turn.evidence].reverse().find(entry => entry.callId === pending)?.value);
        const from = siteActs[pending];
        if (typeof from === "number") siteActs[pending] = installed.siteCommands().slice(from);
        pending = "";
      }
      const submitted = (callId: string) => {
        const value = answers[callId];
        if (typeof value?.revision !== "number" || typeof value.digest !== "string") throw new Error(`diagnostic.submission_refused:${callId}`);
        return { revision: value.revision, digest: value.digest };
      };
      const done = (callId: string) => {
        completions.push({ brief, after: previous });
        return turn.complete({ subflowKey: brief, ...submitted(callId) });
      };
      const testRevision = (n: number) => {
        testing = `posts-${n}`;
        siteActs[`test-${n}`] = installed.siteCommands().length;
        return send(`test-${n}`, call(`test-${n}`, "core.test_subflow", submitted(`submit-${n}`)));
      };
      if (brief === "open") {
        switch (previous) {
          case "":
            return send("open.profile", node("open.profile", "web.output.browser-navigate", { url: profile }));
          case "open.profile":
            return send("open.submit", call("open.submit", "core.submit_subflow", { flow: openFlow() }));
          case "open.submit":
            testing = "open";
            return send("open.test", call("open.test", "core.test_subflow", submitted("open.submit")));
          default:
            return done("open.submit");
        }
      }
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
          if (!handle || !columns.link || !columns.pin) throw new Error("diagnostic.grid_undetected");
          // One read of the grid, as the Flow reads it.
          return send("read", node("read", "web.output.dom-extract_list", { extractList: { handle, fields: { link: columns.link, badge: columns.pin } } }));
        }
        case "read":
          return send("submit-1", call("submit-1", "core.submit_subflow", { flow: postsFlow(revisions[0]!) }));
        case "submit-1":
          return testRevision(1);
        case "test-1":
          return send("submit-2", call("submit-2", "core.submit_subflow", { flow: postsFlow(revisions[1]!) }));
        case "submit-2":
          return testRevision(2);
        case "test-2":
          return send("submit-3", call("submit-3", "core.submit_subflow", { flow: postsFlow(revisions[2]!) }));
        case "submit-3":
          return testRevision(3);
        default:
          return done("submit-3");
      }
    };
    // Revision 1 leaves the three newest out; revision 2 keeps the fourth newest too. Each no names those rows by their post's
    // code, which their link holds. A yes names each condition Core names and each row it shows by id, beside the request's
    // own words for why a pinned tile is not asked for (`./photo-page-order-limit.spec.ts`).
    const verify = offlineFirstVerify(() => testing, judged, {
      yes: (shown) => {
        const conditions = [...new Set([...shown.matchAll(/condition ([0-9]+) \(/gu)].map(match => match[1]!))];
        const rows = [...new Set([...shown.matchAll(/(?<!as in )\[row ([A-Z2-9]{6})\]/gu)].map(match => match[1]!))];
        return [
          "The links of the studio's three newest posts were listed, and no pinned one.",
          ...conditions.map(number => `The read's condition ${number} leaves the pinned tiles out: they are older posts, not among the "${RECENT}".`),
          ...(rows.length ? [`Rows ${rows.join(", ")} are left out: they are pinned tiles, older posts that are not among the "${RECENT}".`] : [])
        ].join(" ");
      },
      no: (label) => label === "posts-1" ? {
        expected: `The links of the ${RECENT}.`,
        observed: `Only the pinned tiles were kept; the three newest posts ${NEWEST.join(", ")} were left out by the read's condition.`,
        changed: "Keep the posts that are not pinned instead.",
        defects: NEWEST.map(code => ({ kind: "asked_missing", row: code, requestWords: RECENT }))
      } : label === "posts-2" ? {
        expected: `The links of the ${RECENT}.`,
        observed: `Every unpinned post was kept, so post ${UNPINNED[3]!} and older ones are kept though only the three most recent are asked for.`,
        changed: "Keep at most three rows.",
        defects: [{ kind: "kept_not_asked", row: UNPINNED[3]!, requestWords: RECENT }]
      } : undefined
    }, shownBy);
    const provider = bindScriptedProvider(installed, { task: TASK, permitted: [], instructionSourceId: build.instructionSourceId, maxIterations: 16, maxCallsPerRun: 60, builder, supervisor, verify });
    const { ending, failure } = await build.run();

    const proof = offlineFirstProof(await readStepLog(stepsDirectory));
    const tests = ["test-1", "test-2", "test-3"].map(callId => answers[callId]);
    const summary = {
      ending, failure, status: resolved?.status ?? null, sent, completions, siteActs, judged: proof.judgedRuns(judged),
      columnsFound: { link: Boolean(columns.link), pin: Boolean(columns.pin) },
      supervisorSteps: provider.supervisorSteps(), builderSteps: provider.builderSteps(), supervisorReceipts: provider.receipts,
      submissions: ["open.submit", "submit-1", "submit-2", "submit-3"].map(callId => ({ callId, revision: answers[callId]?.revision ?? null, ok: answers[callId]?.ok ?? null, code: answers[callId]?.code ?? null })),
      tests: ["open.test", "test-1", "test-2", "test-3"].map(callId => ({ callId, ...proof.testShape(answers[callId]) })),
      steps: proof.listing
    };
    await keepDiagnostic(testInfo, "offline-first-photo.json", { ...summary, resolved, answers, shownBy, outcomes: observed.outcomes, gatewayErrors: installed.gatewayErrors, pages });
    console.log(JSON.stringify({ offlineFirstDiagnostic: summary }));

    expect(handle).toMatch(/^extraction\.[0-9]+$/u);
    proof.assertAcceptance({ ending, failure, resolved, open: answers["open.test"], tests, judged, completions, subflow: "posts", siteActs: ["test-1", "test-2", "test-3"].map(callId => siteActs[callId]).map(sent => Array.isArray(sent) ? sent : undefined) });
  } finally {
    await build.stop();
    await installed.close();
    restoreEnvironment();
  }
});
