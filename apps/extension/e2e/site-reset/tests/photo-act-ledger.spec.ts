import type { JsonObject } from "fluxiq/core";
import { STUDIO, gridFor } from "../../../../scenario-lab/src/scenarios/photo-social/data/index.js";
import { expect, test } from "../../fixtures/extension-context";
import { bindScriptedProvider, keepDiagnostic, projectBuild, startInstalledBuild, trialCode, type BuilderTurn, type ScriptedAnswer, type ScriptedVerification } from "../index";
import type { SupervisorTurn } from "../scripted-provider";
import { PHOTO_ROOT, bindDetectingRuntime, gridCellHandle, gridColumns, issuesIn, likedPosts, openPhotoProfile, postActionHandle } from "../photo-build";

const TASK = "Like the studio's three most recent posts and save them.";
const GRID = gridFor(STUDIO);
const NEWEST = GRID.filter((post) => !post.pinned).slice(0, 3).map((post) => post.code);
/** Core's code for an act the request asks for that only an optional step (or one behind `only after:`) does. */
const OPTIONAL_CODE = "bootstrap.instructed_act_only_optional";
const NL = String.fromCharCode(10);
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
const list = (value: unknown): JsonObject[] => Array.isArray(value) ? value.map(record) : [];

type ActivityEvent = { label?: string; subject?: { projectId?: string }; detail?: { title?: string; text?: string; status?: string } };
/** Core's activity stream: the chat's rows, where the build's ending is said (`service/project-build/run.ts`). */
async function subscribeActivity(listener: (event: ActivityEvent) => void): Promise<() => void> {
  const { automationStudioActivityHub } = await import("fluxiq/automation-studio");
  return automationStudioActivityHub.subscribe((event) => listener(event as ActivityEvent));
}

/**
 * t796 headed proof, provider-free, on photo-social: Core's act ledger.
 *
 * The request is "Like the studio's three most recent posts and save them." The builder opens the studio's profile,
 * detects the grid, reads the three unpinned posts, opens the first and finds its Like and Save. It submits:
 *  (a) a Flow whose like step stands behind `only after:` an optional dismissal -- refused at the `only after:` line
 *      in Core's sentence, by the class it declares (`modify_existing`, the part's lasting act): no word list reads
 *      "like" as an act, which is the shape of debug run-mvtdn37t;
 *  (b) a Flow looping like and save over the three posts, with a non-lasting wait behind `only after:` the optional
 *      dismissal -- accepted; its trial likes and saves three posts and the feedback tells each pass's acts
 *      (`leftOnSite`) and lists the wait under `notRun`.
 * (c) The judge's scripted no, the builder's partial ending, a repair brief and the supervisor's partial ending make
 *      Core say the ending: it names what the build left, and not that every step ran.
 */
test("act ledger: a save behind only-after is refused, a looped like is told per pass, a guarded wait is listed as not run, and the ending names what is left", async ({ extensionSession }, testInfo) => {
  test.setTimeout(420_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const profile = new URL(`${PHOTO_ROOT}${STUDIO}/`, installed.origin).href;
  const firstNewest = new URL(`${PHOTO_ROOT}p/${NEWEST[0]}/`, installed.origin).href;
  const build = projectBuild(installed, "Installed act ledger photo", TASK);
  const pages: Record<string, string> = {};
  const answers: Record<string, JsonObject> = {};
  const sent: string[] = [];
  let columns: { link?: string; pin?: string } = {};
  let handle = "", likeHandle = "", saveHandle = "", noticeHandle = "", resolved: JsonObject | undefined;
  let likedAfterTrial: string[] | undefined;
  let repairSubmission: JsonObject = {}, repairTrial: JsonObject = {};
  const generate = installed.service.generateFlowBootstrapAdaptation.bind(installed.service);
  installed.service.generateFlowBootstrapAdaptation = (async (...args: Parameters<typeof generate>) => {
    const value = await generate(...args);
    resolved = record(value);
    return value;
  }) as typeof installed.service.generateFlowBootstrapAdaptation;
  const activity: ActivityEvent[] = [];
  const unsubscribe = await subscribeActivity((event) => { activity.push(event); });
  try {
    await openPhotoProfile(page, installed.origin, profile);
    await installed.pair();
    const observed = bindDetectingRuntime(installed);
    let pending = "";
    const send = (callId: string, made: ScriptedAnswer) => {
      pending = callId;
      sent.push(callId);
      return made;
    };
    const head = () => [
      "flow: Like and save the three newest posts",
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
      "  repeat over: posts"
    ];
    // The dismissal is a control of the profile's grid, which a post's own page does not show: skipped on every pass.
    const notice = () => ["step notice: close the notice if it shows", "  node: web.dom.click", `  target: ${noticeHandle}`, "  consequences: none", "  optional: yes"];
    const likeStep = () => ["step like: like the post", "  node: web.dom.click", `  target: ${likeHandle}`, "  consequences: modify_existing"];
    const saveStep = (guard: string[]) => ["step save: save the post", "  node: web.dom.click", `  target: ${saveHandle}`, "  consequences: modify_existing", ...guard];
    const cooldown = () => ["step cooldown: wait a moment after the notice", "  node: builtin.timing.wait", "  duration: 1", "  unit: seconds", "  only after: notice"];
    // (a) The like the request asks for stands directly after the optional dismissal, behind `only after:` it: refused by
    // its declared class, the part's own lasting act, since no word list reads "like" as an act (t796).
    const guardedSave = () => [...head(), "  repeat through: save", "  repeat most: 3", ...notice(), ...likeStep(), "  only after: notice", ...saveStep([])].join(NL);
    // (b) The like and the save are unguarded; the non-lasting wait behind the dismissal is what a pass may skip.
    const unguarded = () => [...head(), "  repeat through: cooldown", "  repeat most: 3", ...likeStep(), ...saveStep([]), ...notice(), ...cooldown()].join(NL);
    let brief = 0, repairStep = 0;
    const dispatches: JsonObject[] = [];
    const builder = async (turn: BuilderTurn): Promise<ScriptedAnswer> => {
      const { node, call } = turn;
      pages[`brief-${brief}-step-${turn.step}`] = turn.shownPage();
      if (brief === 2) {
        // The repair: Core refuses a builder's ending before it tried anything, so it submits the same Flow, tests it once, and ends partial.
        repairStep++;
        if (repairStep === 1) return call("submit.repair", "core.submit_subflow", { flow: unguarded() });
        if (repairStep === 2) {
          const sub = record(turn.last("core.submit_subflow"));
          repairSubmission = sub;
          if (typeof sub.revision !== "number" || typeof sub.digest !== "string") return turn.complete({ ended: "partial", reason: "The Flow was refused again." });
          return call("trial.repair", "core.test_subflow", { revision: sub.revision, digest: sub.digest });
        }
        repairTrial = record(turn.last("core.test_subflow"));
        return turn.complete({ ended: "partial", reason: "The posts were liked and saved, but the wait step did not run on any pass." });
      }
      const previous = pending;
      if (pending) {
        answers[pending] = record([...turn.evidence].reverse().find((entry) => entry.callId === pending)?.value);
        pending = "";
      }
      switch (previous) {
        case "":
          return send("profile", node("profile", "web.output.browser-navigate", { url: profile }));
        case "profile": {
          const cell = gridCellHandle(turn.shownPage(), GRID[0]!.code);
          if (!cell) throw new Error("diagnostic.grid_cell_missing");
          noticeHandle = cell;
          return send("detect", call("detect", "web.detect_repeating_structure", { target: cell }));
        }
        case "detect": {
          const packet = answers["detect"];
          handle = typeof packet?.extraction === "string" ? packet.extraction : "";
          columns = gridColumns(packet);
          if (!handle || !columns.link || !columns.pin) return turn.complete({ ended: "blocked", reason: "The grid could not be read." });
          return send("read", node("read", "web.output.dom-extract_list", { extractList: { handle, fields: { link: columns.link, badge: columns.pin }, where: [{ field: "badge", contains: "Pinned", not: true }] } }));
        }
        case "read":
          return send("post", node("post", "web.output.browser-navigate", { url: firstNewest }));
        case "post":
          likeHandle = postActionHandle(turn.shownPage(), "Like");
          saveHandle = /^(t\d+) button "Save"/mu.exec(turn.shownPage())?.[1] ?? "";
          if (!saveHandle) throw new Error("diagnostic.save_control_missing");
          return send("submit.bad", call("submit.bad", "core.submit_subflow", { flow: guardedSave() }));
        case "submit.bad":
          return send("submit", call("submit", "core.submit_subflow", { flow: unguarded() }));
        case "submit": {
          const sub = answers["submit"];
          if (typeof sub?.revision !== "number" || typeof sub.digest !== "string") return turn.complete({ ended: "blocked", reason: "The Flow was refused." });
          return send("trial", call("trial", "core.test_subflow", { revision: sub.revision, digest: sub.digest }));
        }
        default:
          if (previous === "trial") likedAfterTrial = await likedPosts(page);
          return turn.complete({ ended: "partial", reason: "The posts were liked and saved, but the wait step did not run on any pass." });
      }
    };
    // The judge's no is scripted: the wait step is the one thing the Flow's steps say that did not happen.
    const verify = (): ScriptedVerification => {
      const words = "The three newest posts were liked and saved, but the wait after the notice did not run on any pass, so the Flow does not do all that its steps say.";
      return { summary: words, diagnosis: { answersRequest: "no", observed: words } };
    };
    // The supervisor sends one build brief; its ending is refused until a repair has been sent (repair-first), then ends partial.
    const supervisorRefusals: JsonObject[] = [];
    const supervisor = (turn: SupervisorTurn): ScriptedAnswer => {
      for (const entry of turn.evidence) if (entry.toolId === "core.completion_check" && !supervisorRefusals.some((seen) => seen.callId === entry.callId)) supervisorRefusals.push({ callId: entry.callId, ...entry.value });
      const ending = { ended: "partial", reason: "The posts were liked and saved, but a step of the Flow did not run." };
      if (turn.step === 1) return turn.call("plan", "project.write_plan", turn.plan());
      if (turn.step === 2) {
        brief = 1;
        return turn.call("dispatch", "project.dispatch", { reason: "Build the subflow.", briefs: [{ kind: "build", subflowKey: "main", parts: ["p1"], entry: { caseId: "observed-current", predecessors: [] }, permittedActs: ["modify_existing"], maxIterations: 16 }] });
      }
      if (turn.step === 3) {
        dispatches.push(record(turn.last("project.dispatch")));
        return turn.complete(ending);
      }
      if (turn.step === 4) {
        const returned = record((dispatches[0]?.returns as unknown[] | undefined)?.[0]);
        const trials = (returned.trials as JsonObject[] | undefined) ?? [];
        const failing = record(record(returned.repairFrom).failingReceipt).receiptId ? record(record(returned.repairFrom).failingReceipt) : trials.at(-1);
        if (!failing) return turn.complete(ending);
        brief = 2;
        return turn.call("dispatch.repair", "project.dispatch", { reason: "Repair the subflow from the trial that failed.", briefs: [{ kind: "repair", subflowKey: "main", parts: ["p1"], entry: { caseId: "observed-current", predecessors: [] }, permittedActs: ["modify_existing"], maxIterations: 16, failingReceipt: failing }] });
      }
      if (turn.step === 5) dispatches.push(record(turn.last("project.dispatch")));
      return turn.complete(ending);
    };
    const provider = bindScriptedProvider(installed, { task: TASK, permitted: ["modify_existing"], instructionSourceId: build.instructionSourceId, maxIterations: 16, maxCallsPerRun: 40, builder, verify, supervisor });
    const { ending, failure } = await build.run();

    const bad = answers["submit.bad"] ?? {};
    const refusals = issuesIn(bad).filter((issue) => issue.code === OPTIONAL_CODE);
    const refusalText = JSON.stringify(bad);
    const good = answers["submit"] ?? {};
    const trial = answers["trial"];
    const feedback = record(trial?.feedback);
    const likeSteps = list(feedback.steps).filter((step) => /like the post/iu.test(String(step.label ?? "")));
    const notRun = list(feedback.notRun);
    const leftOnSite = list(trial?.leftOnSite).map((entry) => String(entry.did ?? ""));
    const endedRows = activity.filter((event) => /partly built|could not finish/iu.test(`${event.label ?? ""} ${event.detail?.title ?? ""}`)).map((event) => ({ title: event.detail?.title ?? event.label ?? "", text: event.detail?.text ?? "" }));
    const endingText = endedRows.map((row) => row.text).join(NL);
    const diagnostic = { dispatches, repairSubmission, repairTrial, supervisorRefusals, ending, failure, sent, columns, handle, likeHandle, saveHandle, bad, good, trial, likeSteps, notRun, endedRows, activityTitles: activity.map((event) => `${event.detail?.title ?? event.label ?? ""}${event.detail?.text ? ` :: ${event.detail.text.slice(0, 1200)}` : ""}`), resolved, likedAfterTrial, builderStep: provider.builderSteps(), supervisorStep: provider.supervisorSteps(), receipts: provider.receipts, outcomes: observed.outcomes, gatewayErrors: installed.gatewayErrors, pages };
    await keepDiagnostic(testInfo, "act-ledger-photo.json", diagnostic);
    const refusedIssues = list(record(bad.diagnostics).issues).map((issue) => ({ code: issue.code, path: issue.path, line: issue.line, step: issue.step, message: issue.message }));
    console.log(JSON.stringify({ actLedger: { ending, failure, sent, refusals, refusedIssues, revision: good.revision ?? null, trial: trialCode(trial) ?? null, likeSteps: likeSteps.map((step) => ({ status: step.status })), leftOnSite: trial?.leftOnSite, notRun, supervisorRefusals: supervisorRefusals.map((entry) => ({ code: entry.code })), repairTrial: trialCode(repairTrial) ?? null, endedRows, liked: likedAfterTrial?.length ?? null } }));

    // (a) The like behind `only after:` is refused at that line, in Core's sentence naming its declared class.
    expect(refusals.length).toBeGreaterThan(0);
    expect(refusalText).toContain("declares `consequences: modify_existing`, the lasting act this part asks for");
    expect(refusalText).toContain("This step does what the request asks, and `only after: notice`");
    expect(refusals.every((issue) => /^flow\.line\.\d+$/u.test(issue.at ?? ""))).toBe(true);
    // (b) The unguarded loop is accepted, runs, and likes the three newest posts.
    expect(good.ok).not.toBe(false);
    expect(good.revision).toBeGreaterThan(0);
    expect(trial?.trialRunId).toMatch(/^trial\./u);
    expect([...(likedAfterTrial ?? [])].sort()).toEqual([...NEWEST].sort());
    // Each pass's like and save is told, with its step and outcome.
    expect(likeSteps.map((step) => step.status)).toEqual(["succeeded", "succeeded", "succeeded"]);
    expect(leftOnSite.length).toBe(6);
    for (const pass of [1, 2, 3]) for (const act of ["like the post", "save the post"]) expect(leftOnSite.some((did) => did.includes(`pass ${pass} of 3`) && did.includes(act))).toBe(true);
    // The guarded, non-lasting wait is listed as not run on all three passes.
    const wait = notRun.find((entry) => entry.reason === "guarded");
    expect(wait?.lasting).toBe(false);
    expect(wait?.passes).toEqual([1, 2, 3]);
    expect(wait?.of).toBe(3);
    expect(String(wait?.said)).toContain("Not run on passes 1, 2 and 3");
    // (c) The ending names what the build left, and never says all its steps ran.
    expect(endedRows.length).toBeGreaterThan(0);
    for (const act of ["like the post", "save the post"]) expect(endingText).toContain(`the step “${act}” on the page “`);
    expect(endingText).toContain("These changes the build made are still on the site");
    expect(endingText).toContain("its step “wait a moment after the notice” never ran (on any of the 3 passes)");
    expect(endingText).not.toMatch(/ran all \d+ of its steps/u);
  } finally {
    unsubscribe();
    await build.stop();
    await installed.close();
  }
});
