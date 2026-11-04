// Headed, provider-free, on job-board: a saved part of a real build runs at zero model calls, behind a guard.
//
// A scripted build writes a Flow with two parts, through the real service and a real browser: `find` types its input
// into the board's search and reads the results; `keep` waits a moment on a job's page and presses its heart. The Flow
// is applied, and that saves both parts. Every model call after that goes to a provider that throws.
//
// Each claim is read off the site itself: the saved list from the board's own state and from My jobs, the expected
// rows from the catalog the board renders. The runner's words are read only to see which refusal it gave.
import type { JsonObject } from "fluxiq/core";
import type { Page } from "@playwright/test";
import { DEFAULT_QUERY, pageOfResults, searchPostings, sponsoredFor } from "../../../../../../scenario-lab/src/scenarios/job-board/catalog/index.js";
import { viewJobHref } from "../../../../../../scenario-lab/src/scenarios/job-board/board/index.js";
import { expect, test } from "../../../../fixtures/extension-context";
import { bindDetectingRuntime, bindScriptedProvider, detectedColumns, keepDiagnostic, pageHandle, pageHandleWhere, projectBuild, startInstalledBuild, type BuilderTurn, type InstalledBuild, type ScriptedAnswer } from "../../../../site-reset/index";

const TASK = "Find the roles for the words I give you, and save the one I am looking at to my saved jobs.";
const WORDS = "rust";
/** The first role the search finds, which nobody saved when the person arrives. */
const TARGET = pageOfResults(searchPostings("baseline", { ...DEFAULT_QUERY, q: WORDS }, false), { ...DEFAULT_QUERY, q: WORDS }).items[0]!;
const HOME = "/scenarios/job-board/";
const MY_JOBS = "/scenarios/job-board/myjobs";
/** How long `keep` waits before its press: the time (d) has to move the page. */
const KEEP_WAIT_SECONDS = 4;

const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
const list = (value: unknown): JsonObject[] => Array.isArray(value) ? value.map(record) : [];

/** The board as the person finds it, ready to use: its consent answered and its assistant out of the way. */
async function readyBoard(page: Page, origin: string): Promise<void> {
  await page.goto(new URL(HOME, origin).href);
  await page.getByRole("button", { name: "Accept all", exact: true }).click();
  await page.locator("rf-assistant .fa-min").waitFor({ timeout: 9000 });
  await page.locator("rf-assistant .fa-min").click();
}

/** The board's own record of what is saved, and all of the state besides, as the Lab holds it. */
async function boardState(installed: InstalledBuild): Promise<{ saved: string[]; whole: string }> {
  const snapshot = record(await installed.labState("job-board"));
  const state = record(snapshot.state);
  return { saved: [...(state.saved as string[])].sort(), whole: JSON.stringify({ saved: state.saved, follows: state.follows, applications: state.applications, alerts: state.alertSubscriptions }) };
}

/** The titles My jobs shows, read off the page. */
async function myJobsTitles(page: Page, origin: string): Promise<string[]> {
  await page.goto(new URL(MY_JOBS, origin).href);
  await page.getByRole("heading", { name: "My jobs" }).waitFor();
  const titles = await page.locator("a").allInnerTexts();
  return titles.map((title) => title.trim()).filter(Boolean);
}

/**
 * The results the board's own catalog says it lists for these words, in the order its results page renders them: a
 * sponsored card, five results, a sponsored card, the rest (`board/results-page.ts`), each row once. A read keeps one
 * row of two the same, and the first sponsored card is the first result here.
 */
function boardResults(words: string): { title: string; company: string }[] {
  const query = { ...DEFAULT_QUERY, q: words };
  const { items, page } = pageOfResults(searchPostings("baseline", query, false), query);
  const sponsored = sponsoredFor("baseline", query, page);
  const cards = [...sponsored.slice(0, 1), ...items.slice(0, 5), ...sponsored.slice(1, 2), ...items.slice(5)].map((posting) => ({ title: posting.title, company: `${posting.company} · ${posting.location}` }));
  return cards.filter((card, index) => cards.findIndex((other) => other.title === card.title && other.company === card.company) === index);
}

const NOT_A_PAGE_COMMAND =/capture_snapshot|page\.facts/u;

test("a saved part runs at zero model calls behind its guard: right rows, refused on the wrong page with no site change, and stopped before its lasting step when the page moves", async ({ extensionSession }, testInfo) => {
  test.setTimeout(540_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page, service, origin } = installed;
  const viewJob = new URL(viewJobHref(TARGET), origin).href;
  const home = new URL(HOME, origin).href;
  const build = projectBuild(installed, "Installed part run", TASK);
  const answers: Record<string, JsonObject> = {};
  const seen: Record<string, string> = {};
  let adaptation: JsonObject = {};
  const generate = service.generateFlowBootstrapAdaptation.bind(service);
  service.generateFlowBootstrapAdaptation = (async (...args: Parameters<typeof generate>) => {
    const value = await generate(...args);
    adaptation = record(value);
    return value;
  }) as typeof service.generateFlowBootstrapAdaptation;
  const diagnostic: JsonObject = {};
  try {
    await readyBoard(page, origin);
    await installed.pair();
    bindDetectingRuntime(installed);

    // ---- The build: explore, write the Flow, try it once, finish. ----
    let what = "", extraction = "", title = "", company = "", heart = "", pending = "";
    const send = (callId: string, made: ScriptedAnswer) => {
      pending = callId;
      return made;
    };
    const flow = () => [
      "flow: Find roles and keep one",
      "part find: Find the roles for the words asked for",
      "  input: words",
      "  output: roles = $step.read.records",
      "  step what: type the words and search",
      "    node: web.dom.type",
      `    target: ${what}`,
      "    text: $input.words",
      "    submit: true",
      "    consequences: none",
      "  step read: read the roles",
      "    node: web.dom.extract_list",
      `    extractList: ${JSON.stringify({ handle: extraction, fields: { title, company } })}`,
      `    recordOutput: ${JSON.stringify({ datasetId: "roles", writeMode: "replace" })}`,
      "end",
      "part keep: Keep the job open on the page",
      "  step settle: wait a moment for the page",
      "    node: builtin.timing.wait",
      `    duration: ${KEEP_WAIT_SECONDS}`,
      "    unit: seconds",
      "  step press: keep the job",
      "    node: web.dom.click",
      `    target: ${heart}`,
      "    consequences: modify_existing",
      "end",
      "step open: open the board",
      "  node: web.browser.navigate",
      `  url: ${JSON.stringify(home)}`,
      "step found: find the roles",
      "  call: find",
      `  words: $input.words = ${WORDS}`,
      "step job: open the job",
      "  node: web.browser.navigate",
      `  url: ${JSON.stringify(viewJob)}`,
      "step kept: keep the job",
      "  call: keep"
    ].join("\n");
    let builderError = "";
    const builder = (turn: BuilderTurn): ScriptedAnswer => {
      try {
        return scripted(turn);
      } catch (error) {
        builderError = String(error);
        throw error;
      }
    };
    const scripted = (turn: BuilderTurn): ScriptedAnswer => {
      const { node, call } = turn;
      const previous = pending;
      if (pending) {
        answers[pending] = record([...turn.evidence].reverse().find((entry) => entry.callId === pending)?.value);
        seen[pending] = turn.shownPage();
        pending = "";
      }
      switch (previous) {
        case "":
          return send("home", node("home", "web.output.browser-navigate", { url: home }));
        case "home":
          what = pageHandle(turn.shownPage(), "What");
          return send("search", node("search", "web.output.dom-type", { target: { handle: what }, text: WORDS, submit: true }));
        case "search": {
          const firstTitle = pageOfResults(searchPostings("baseline", { ...DEFAULT_QUERY, q: WORDS }, false), { ...DEFAULT_QUERY, q: WORDS }).items[0]!.title;
          const cell = pageHandleWhere(turn.shownPage(), new RegExp(JSON.stringify(firstTitle).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
          if (!cell) throw new Error("diagnostic.result_missing");
          return send("detect", call("detect", "web.detect_repeating_structure", { target: cell }));
        }
        case "detect": {
          const packet = answers["detect"];
          extraction = typeof packet?.extraction === "string" ? packet.extraction : "";
          const columns = detectedColumns(packet);
          const first = pageOfResults(searchPostings("baseline", { ...DEFAULT_QUERY, q: WORDS }, false), { ...DEFAULT_QUERY, q: WORDS }).items[0]!;
          diagnostic.columns = { fields: packet?.fields ?? null };
          title = columns.find((column) => column.sample?.includes(first.title))?.key ?? "";
          company = columns.find((column) => column.sample?.includes(first.company))?.key ?? "";
          if (!extraction || !title || !company) throw new Error("diagnostic.results_undetected");
          return send("read", node("read", "web.output.dom-extract_list", { extractList: { handle: extraction, fields: { title, company } } }));
        }
        case "read":
          return send("job.look", node("job.look", "web.output.browser-navigate", { url: viewJob }));
        case "job.look": {
          const found = pageHandleWhere(turn.shownPage(), /\bicon\b/u);
          if (!found) throw new Error("diagnostic.heart_missing");
          heart = found;
          return send("submit", call("submit", "core.submit_subflow", { flow: flow() }));
        }
        case "submit": {
          const sub = answers["submit"];
          if (typeof sub?.revision !== "number" || typeof sub.digest !== "string") return turn.complete({ ended: "blocked", reason: `The Flow was refused: ${JSON.stringify(sub).slice(0, 2000)}` });
          return send("trial", call("trial", "core.test_subflow", { revision: sub.revision, digest: sub.digest }));
        }
        default: {
          const sub = answers["submit"]!;
          return turn.complete({ subflowKey: "main", revision: sub.revision!, digest: sub.digest! });
        }
      }
    };
    bindScriptedProvider(installed, { task: TASK, permitted: ["modify_existing"], instructionSourceId: build.instructionSourceId, maxIterations: 20, maxCallsPerRun: 40, builder });
    const started = Date.now();
    const { ending, failure } = await build.run();
    console.log(JSON.stringify({ partRunBuildMs: Date.now() - started }));
    Object.assign(diagnostic, { ending, failure, answers, seen, builderError });
    await keepDiagnostic(testInfo, "part-run-build.json", diagnostic);
    expect(ending, JSON.stringify(failure)).toBe("proposed");

    // ---- A real build's parts enter the library when its Flow is applied. ----
    const projectId = String(adaptation.projectId);
    const flowId = String(adaptation.flowId);
    const review = { projectId, flowId, adaptationId: String(adaptation.adaptationId), actorId: "diagnostic" };
    await service.reviewFlowBootstrapAdaptation({ ...review, action: "approve" });
    const applying = Date.now();
    await service.reviewFlowBootstrapAdaptation({ ...review, action: "apply" });
    console.log(JSON.stringify({ partRunApplyMs: Date.now() - applying }));
    const listed = record(await service.projectParts.list({ projectId }));
    const cards = list(listed.parts);
    diagnostic.cards = cards;
    await keepDiagnostic(testInfo, "part-run-build.json", diagnostic);
    console.log(JSON.stringify({ partRunCards: cards.map((card) => ({ name: card.name, sites: card.sites, inputs: card.inputs, outputs: card.outputs, lasting: card.lastingClasses, start: card.startCheck ?? null })) }));
    const find = cards.find((card) => card.name === "Find the roles for the words asked for");
    const keep = cards.find((card) => card.name === "Keep the job open on the page");
    expect(find, JSON.stringify(cards.map((card) => card.name))).toBeDefined();
    expect(keep, JSON.stringify(cards.map((card) => card.name))).toBeDefined();
    expect(find!.lastingClasses).toEqual([]);
    expect(keep!.lastingClasses).toEqual(["modify_existing"]);

    // ---- From here no model may be called: the provider throws, and the count says none did. ----
    let providerCalls = 0;
    service.bindLlmExecutionProvider(() => ({
      provider: {
        metadata: { provider: "throws", model: "none" },
        runTask: async () => {
          providerCalls += 1;
          throw new Error("diagnostic.a_part_run_called_a_model");
        }
      },
      maxCallsPerRun: 1,
      maxEstimatedCostUsd: 0
    }));
    const findId = String(find!.partId);
    const keepId = String(keep!.partId);
    /** Runs the part and answers what came back, with which commands reached the site during it. */
    const run = async (partId: string, more: JsonObject = {}): Promise<{ answer: JsonObject; commands: string[] }> => {
      const before = installed.siteCommands().length;
      const at = Date.now();
      const answer = record(await service.projectParts.run({ projectId, partId, inputs: {}, ...more } as Parameters<typeof service.projectParts.run>[0]));
      console.log(JSON.stringify({ partRunMs: Date.now() - at, code: answer.code ?? answer.status }));
      return { answer, commands: installed.siteCommands().slice(before) };
    };
    /** Asserts a refusal: its code, and that the site saw only reads and did not change. */
    const refusedWithNoChange = async (attempt: () => Promise<{ answer: JsonObject; commands: string[] }>, code: string) => {
      const before = await boardState(installed);
      const url = page.url();
      const { answer, commands } = await attempt();
      expect(answer.code, JSON.stringify(answer)).toBe(code);
      expect(commands.filter((command) => !NOT_A_PAGE_COMMAND.test(command)), "a refused part sends the site nothing but reads").toEqual([]);
      expect((await boardState(installed)).whole).toBe(before.whole);
      expect(page.url()).toBe(url);
      expect(String(answer.message)).not.toMatch(/\bt\d+\b|selector|#|http/u);
    };

    // The trial above saved the job, so the proof starts from the board as a person finds it.
    await installed.resetLab();
    await readyBoard(page, origin);
    const savedAtStart = (await boardState(installed)).saved;
    expect(savedAtStart).not.toContain(TARGET.key);
    expect(savedAtStart).toHaveLength(2);

    // (b) A read part, on a page it does not start on: refused, the site unchanged.
    await page.goto(new URL(MY_JOBS, origin).href);
    await refusedWithNoChange(() => run(findId, { inputs: { words: WORDS } }), "part.not_at_start");
    // On another origin: the same board reached by another host.
    const elsewhere = new URL(HOME, origin);
    elsewhere.hostname = elsewhere.hostname === "127.0.0.1" ? "localhost" : "127.0.0.1";
    await page.goto(elsewhere.href);
    await refusedWithNoChange(() => run(findId, { inputs: { words: WORDS } }), "part.wrong_site");
    // A value it needs, and one it does not take.
    await page.goto(home);
    await refusedWithNoChange(() => run(findId), "part.input_missing");
    await refusedWithNoChange(() => run(findId, { inputs: { words: WORDS, other: "x" } }), "part.input_unknown");

    // (a) The read part with its input, from where it starts: the fixture's own answer, at no model call.
    const expected = boardResults(WORDS);
    const read = await run(findId, { inputs: { words: WORDS } });
    console.log(JSON.stringify({ partRunRead: { status: read.answer.status, modelCalls: read.answer.modelCalls, rows: read.answer.rows, acts: read.answer.acts, stoppedAt: read.answer.stoppedAt ?? null, commands: read.commands } }));
    expect(read.answer.status, JSON.stringify(read.answer)).toBe("succeeded");
    expect(read.answer.modelCalls).toBe(0);
    expect(read.answer.acts).toEqual([]);
    expect(new URL(page.url()).searchParams.get("q"), "the input reached the page").toBe(WORDS);
    const rowsAnswer = record(read.answer.rows);
    const dataset = record(list(rowsAnswer.datasets)[0]);
    expect(dataset.datasetId).toBe("roles");
    const stored = await service.runDatasets.getRunDatasetPage({ projectId, runId: String(read.answer.runId), datasetId: "roles", limit: 100 });
    const rows = list(stored?.rows).map((row) => ({ title: String(row.title ?? ""), company: String(row.company ?? "") }));
    await keepDiagnostic(testInfo, "part-run-rows.json", { rows, expected });
    expect(rows, "the rows the part read are the board's own results for the input, in its order").toEqual(expected);
    expect(dataset.rowCount).toBe(expected.length);
    expect(record(read.answer.outputs).roles, "its output port carries the rows the step read").toHaveLength(expected.length + 1);
    expect(providerCalls, "a read part called no model").toBe(0);

    // (c) A lasting part: refused on the wrong page, untold and unasked, and the job stays unsaved each time.
    const asked = { permittedConsequences: ["modify_existing"], acknowledgedRepeat: true };
    await page.goto(home);
    await refusedWithNoChange(() => run(keepId, asked), "part.not_at_start");
    // A page of look-alikes: My jobs holds a heart on every row, so the part cannot tell which is its own.
    await page.goto(new URL(MY_JOBS, origin).href);
    await refusedWithNoChange(() => run(keepId, asked), "part.not_at_start");
    await page.goto(viewJob);
    await refusedWithNoChange(() => run(keepId, { permittedConsequences: ["modify_existing"] }), "part.confirm_repeat");
    const untold = (await run(keepId, { permittedConsequences: ["modify_existing"] })).answer;
    expect(String(untold.message)).toContain("change something that already exists");
    expect(String(untold.message)).toContain("again");
    await refusedWithNoChange(() => run(keepId, { acknowledgedRepeat: true }), "part.act_not_allowed");
    await refusedWithNoChange(() => run(keepId, { permittedConsequences: ["create_new"], acknowledgedRepeat: true }), "part.act_not_allowed");
    expect((await boardState(installed)).saved, "no refusal saved the job").toEqual(savedAtStart);

    // (d) The page moves while the prefix waits: stopped before the press, nothing lasting done.
    const moving = run(keepId, asked);
    await page.waitForTimeout(1500);
    await page.goto(new URL(MY_JOBS, origin).href);
    const moved = await moving;
    console.log(JSON.stringify({ partRunMoved: { status: moved.answer.status, stoppedAt: moved.answer.stoppedAt ?? null, acts: moved.answer.acts, commands: moved.commands } }));
    expect(moved.answer.status, JSON.stringify(moved.answer)).toBe("stopped");
    expect(moved.answer.acts).toEqual([]);
    expect(String(record(moved.answer.stoppedAt).reason)).toContain("it was not done");
    expect(moved.commands.filter((command) => command === "web.dom.click"), "the press was never sent").toEqual([]);
    expect((await boardState(installed)).saved, "the stopped run saved nothing").toEqual(savedAtStart);
    // The same with the control gone altogether, on a page holding none of its look-alikes.
    await page.goto(viewJob);
    const leaving = run(keepId, asked);
    await page.waitForTimeout(1500);
    await page.goto(home);
    const left = await leaving;
    console.log(JSON.stringify({ partRunLeft: { status: left.answer.status, stoppedAt: left.answer.stoppedAt ?? null, acts: left.answer.acts, commands: left.commands } }));
    expect(left.answer.status, JSON.stringify(left.answer)).toBe("stopped");
    expect(String(record(left.answer.stoppedAt).reason)).toContain("no longer on it");
    expect(left.commands.filter((command) => command === "web.dom.click"), "the press was never sent").toEqual([]);
    expect((await boardState(installed)).saved, "the stopped run saved nothing").toEqual(savedAtStart);
    const titlesAfterStop = await myJobsTitles(page, origin);
    expect(titlesAfterStop).toContain("Product Designer");
    expect(titlesAfterStop).not.toContain(TARGET.title);
    await page.screenshot({ path: testInfo.outputPath("after-stopped-run-my-jobs.png"), fullPage: true });

    // (c, continued) All of it holds: the part runs, and the board's own record and My jobs both hold the job, once.
    await page.goto(viewJob);
    const ran = await run(keepId, asked);
    console.log(JSON.stringify({ partRunLasting: { status: ran.answer.status, acts: ran.answer.acts, modelCalls: ran.answer.modelCalls, commands: ran.commands } }));
    expect(ran.answer.status, JSON.stringify(ran.answer)).toBe("succeeded");
    expect(ran.answer.acts).toEqual(["modify_existing"]);
    expect(ran.answer.modelCalls).toBe(0);
    const savedAfter = (await boardState(installed)).saved;
    expect(savedAfter).toEqual([...savedAtStart, TARGET.key].sort());
    const titlesAfterRun = await myJobsTitles(page, origin);
    expect(titlesAfterRun.filter((title) => title === TARGET.title)).toHaveLength(1);
    await page.screenshot({ path: testInfo.outputPath("after-lasting-run-my-jobs.png"), fullPage: true });

    expect(providerCalls, "no part run called a model").toBe(0);
    const session = record(await service.getRuntimeSession(projectId, String(ran.answer.runId)));
    expect(record(record(session.metadata).partRun)).toMatchObject({ partId: keepId, outcome: "succeeded" });
    expect(installed.gatewayErrors).toEqual([]);
  } finally {
    await keepDiagnostic(testInfo, "part-run-diagnostic.json", diagnostic);
    await build.stop();
    await installed.close();
  }
});
