// Headed, provider-free, on job-board: a site part and its action sub-part, used from two Flows through pinned
// versions, with a list row crossing the call and no act ever repeated.
//
// A scripted build explores the board and writes a Flow whose part reads a list and presses a heart on each row: real
// recorded controls through the real service and a real browser. A person then splits the press into an action part of
// its own that takes the row, keeps both, and points two Flows at the version. That edit goes through the service's own
// Flow save, because the script format cannot yet pass a whole row across a call (see the w7 report). Every model call
// after the build goes to a provider that throws.
//
// Each claim is read off the site itself: what is saved from the board's own state and My jobs, what should be from the
// catalog the board renders. A run's own words are read only for which versions ran.
import type { JsonObject, JsonValue } from "fluxiq/core";
import type { Page } from "@playwright/test";
import { DEFAULT_QUERY, pageOfResults, searchPostings, sponsoredFor } from "../../../../../../scenario-lab/src/scenarios/job-board/catalog/index.js";
import { expect, test } from "../../../../fixtures/extension-context";
import { bindDetectingRuntime, bindScriptedProvider, detectedColumns, keepDiagnostic, pageHandle, pageHandleWhere, projectBuild, startInstalledBuild, type BuilderTurn, type InstalledBuild, type ScriptedAnswer } from "../../../../site-reset/index";

const HOME = "/scenarios/job-board/";
const MY_JOBS = "/scenarios/job-board/myjobs";
const CALL = "builtin.control.call-subflow";
const CLICK = "web.output.dom-click";
const MOST = 3;
const WAIT_SECONDS = 6;
const WORDS_ONE = "manager";
const TASK = "Find the roles for the words I give you, and save the first few of them to my saved jobs.";
const ROW_INPUT = { id: "item", name: "The role", valueType: { kind: "unknown" }, required: true };
const ROW_BINDING = { $state: { path: "item" } };

const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
const list = (value: unknown): JsonObject[] => Array.isArray(value) ? value.map(record) : [];

type Posting = { key: string; title: string; company: string };

/** The rows the board shows first for these words: its sponsored card, then its first results, when each is a job of its own. */
function firstRows(words: string): { intended: Posting[]; others: Posting[] } | undefined {
  const query = { ...DEFAULT_QUERY, q: words };
  const listed = pageOfResults(searchPostings("baseline", query, false), query).items as unknown as Posting[];
  const sponsored = sponsoredFor("baseline", query, 1)[0] as unknown as Posting | undefined;
  if (!sponsored || listed.some((posting) => posting.key === sponsored.key)) return undefined;
  const intended = [sponsored, ...listed].slice(0, MOST);
  const others = listed.filter((posting) => !intended.includes(posting));
  return intended.length === MOST && new Set(intended.map((posting) => posting.title)).size === MOST && others.length > 0 ? { intended, others } : undefined;
}

async function readyBoard(page: Page, origin: string): Promise<void> {
  await page.goto(new URL(HOME, origin).href);
  await page.getByRole("button", { name: "Accept all", exact: true }).click();
  await page.locator("rf-assistant .fa-min").waitFor({ timeout: 9000 });
  await page.locator("rf-assistant .fa-min").click();
}

async function savedOnBoard(installed: InstalledBuild): Promise<string[]> {
  const state = record(record(await installed.labState("job-board")).state);
  return [...(state.saved as string[])].sort();
}

async function myJobsTitles(page: Page, origin: string): Promise<string[]> {
  await page.goto(new URL(MY_JOBS, origin).href);
  await page.getByRole("heading", { name: "My jobs" }).waitFor();
  const titles = await page.locator("a").allInnerTexts();
  return titles.map((title) => title.trim()).filter(Boolean);
}

/** Which versions a run ran, read off its own trace, each as many times as it was called. */
function versionsRan(trace: unknown): string[] {
  const found: string[] = [];
  const visit = (attempts: unknown) => {
    for (const attempt of list(attempts)) {
      const target = record(attempt.subflowTarget);
      if (typeof target.subflowId === "string") found.push(target.subflowId);
      visit(record(attempt.childTrace).attempts);
    }
  };
  visit(record(trace).attempts);
  return found;
}

test("a site part and its action part pinned from two Flows: the row crosses the call, each intended job saved exactly once, at zero model calls", async ({ extensionSession }, testInfo) => {
  test.setTimeout(900_000);
  const one = firstRows(WORDS_ONE);
  expect(one, "the first words give three rows of their own").toBeDefined();
  const { intended, others } = one!;
  // The board's sponsored card is the same for most words, so the second Flow's rows are read from a board of its own.
  const wordsTwo = ["systems", "data", "developer", "payments", "platform", "security"].find((words) => {
    const rows = firstRows(words);
    return rows && words !== WORDS_ONE && rows.intended.some((posting) => !intended.some((other) => other.key === posting.key));
  });
  expect(wordsTwo, "other words give rows the first words do not").toBeDefined();
  const intendedTwo = firstRows(wordsTwo!)!.intended;

  const installed = await startInstalledBuild(extensionSession);
  const { page, service, origin } = installed;
  const home = new URL(HOME, origin).href;
  const build = projectBuild(installed, "Installed pinned calls", TASK);
  const answers: Record<string, JsonObject> = {};
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

    // ---- The build: explore, write a Flow whose part reads a list and presses on each row, try it, finish. ----
    let what = "", extraction = "", title = "", company = "", heart = "", pending = "";
    const send = (callId: string, made: ScriptedAnswer) => {
      pending = callId;
      return made;
    };
    const flow = () => [
      "flow: Find roles and keep the first few",
      "part keeprows: Keep the first few roles the words find",
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
      "  step settle: wait a moment for the page",
      "    node: builtin.timing.wait",
      `    duration: ${WAIT_SECONDS}`,
      "    unit: seconds",
      "  step press: keep the role",
      "    node: web.dom.click",
      `    target: ${heart}`,
      "    consequences: modify_existing",
      "    repeat over: read",
      `    repeat most: ${MOST}`,
      "end",
      "step open: open the board",
      "  node: web.browser.navigate",
      `  url: ${JSON.stringify(home)}`,
      "step found: keep the roles",
      "  call: keeprows",
      `  words: $input.words = ${WORDS_ONE}`
    ].join("\n");
    let builderError = "";
    const scripted = (turn: BuilderTurn): ScriptedAnswer => {
      const { node, call } = turn;
      const previous = pending;
      if (pending) {
        answers[pending] = record([...turn.evidence].reverse().find((entry) => entry.callId === pending)?.value);
        pending = "";
      }
      switch (previous) {
        case "":
          return send("home", node("home", "web.output.browser-navigate", { url: home }));
        case "home":
          what = pageHandle(turn.shownPage(), "What");
          return send("search", node("search", "web.output.dom-type", { target: { handle: what }, text: WORDS_ONE, submit: true }));
        case "search": {
          const cell = pageHandleWhere(turn.shownPage(), new RegExp(JSON.stringify(intended[1]!.title).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
          if (!cell) throw new Error("diagnostic.result_missing");
          return send("detect", call("detect", "web.detect_repeating_structure", { target: cell }));
        }
        case "detect": {
          const packet = answers["detect"];
          extraction = typeof packet?.extraction === "string" ? packet.extraction : "";
          const columns = detectedColumns(packet);
          title = columns.find((column) => column.sample?.includes(intended[0]!.title))?.key ?? "";
          company = columns.find((column) => column.sample?.includes(intended[0]!.company))?.key ?? "";
          if (!extraction || !title || !company) throw new Error("diagnostic.results_undetected");
          return send("read", node("read", "web.output.dom-extract_list", { extractList: { handle: extraction, fields: { title, company } } }));
        }
        case "read": {
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
    const builder = (turn: BuilderTurn): ScriptedAnswer => {
      try {
        return scripted(turn);
      } catch (error) {
        builderError = String(error);
        throw error;
      }
    };
    bindScriptedProvider(installed, { task: TASK, permitted: ["modify_existing"], instructionSourceId: build.instructionSourceId, maxIterations: 20, maxCallsPerRun: 40, builder });
    const { ending, failure } = await build.run();
    Object.assign(diagnostic, { ending, failure, answers, builderError });
    await keepDiagnostic(testInfo, "pinned-calls-build.json", diagnostic);
    expect(ending, JSON.stringify(failure)).toBe("proposed");
    const projectId = String(adaptation.projectId);
    const flowOne = String(adaptation.flowId);
    const review = { projectId, flowId: flowOne, adaptationId: String(adaptation.adaptationId), actorId: "diagnostic" };
    await service.reviewFlowBootstrapAdaptation({ ...review, action: "approve" });
    await service.reviewFlowBootstrapAdaptation({ ...review, action: "apply" });

    // ---- A person splits the press out: an action part that takes the row, called per row by the site part. ----
    const page0 = await service.listFlowSubflowSummaries({ projectId, flowId: flowOne, limit: 100, offset: 0 });
    const subflows = (await Promise.all(page0.subflows.map((item) => service.getFlowSubflow(projectId, flowOne, item.subflowId)))).filter((item) => item !== null);
    const graphs = await Promise.all(subflows.map(async (subflow) => ({ subflow, graph: await service.getFlow(projectId, subflow.graphFlowId!) })));
    const siteOf = graphs.find((entry) => entry.graph.nodes.some((node) => node.definitionId === CLICK))!;
    const mainOf = graphs.find((entry) => entry.graph.nodes.some((node) => node.definitionId === CALL))!;
    const press = siteOf.graph.nodes.find((node) => node.definitionId === CLICK)!;
    diagnostic.siteBefore = { nodes: siteOf.graph.nodes.map((node) => ({ id: node.id, definitionId: node.definitionId })), edges: siteOf.graph.edges } as unknown as JsonValue;
    const action = await service.createFlowSubflow({ projectId, flowId: flowOne, name: "Keep the role on this row", role: "utility" });
    const actionBlank = await service.getFlow(projectId, action.graphFlowId!);
    const actionStart = `${action.subflowId}.start`;
    const pressCopy = `${action.subflowId}.press`;
    await service.saveFlow({ projectId, flow: { ...actionBlank,
      interface: { inputs: [ROW_INPUT], outputs: [] } as unknown as typeof actionBlank.interface,
      nodes: [{ id: actionStart, definitionId: "builtin.control.start", definitionVersion: "1.0.0", label: "Start" }, { ...press, id: pressCopy }],
      edges: [{ id: `${pressCopy}.in`, sourceNodeId: actionStart, sourcePortId: "success", targetNodeId: pressCopy, targetPortId: "in" }]
    } });
    await service.saveFlow({ projectId, flow: { ...siteOf.graph,
      nodes: siteOf.graph.nodes.map((node) => node.id !== press.id ? node : { id: press.id, definitionId: CALL, definitionVersion: "1.0.0", label: "keep this role", parameterValues: { subflowId: action.subflowId, inputs: { item: ROW_BINDING } }, metadata: {} }),
      edges: siteOf.graph.edges.filter((edge) => !(edge.targetNodeId === press.id && edge.targetPortId === "item"))
    } });
    const kept = record(await service.projectParts.save({ projectId, flowId: flowOne, subflowId: siteOf.subflow.subflowId, name: "Find the roles and keep the first few", purpose: "Find the roles for the words given and keep each of the first few" }));
    console.log(JSON.stringify({ pinnedKept: kept }));
    expect(kept.saved, JSON.stringify(kept)).toBe(true);
    const sitePart = String(kept.partId);
    const siteVersion = Number(kept.version);
    const actionCard = list(record(await service.projectParts.list({ projectId })).parts).find((card) => card.name === "Keep the role on this row");
    expect(actionCard, "the action part came with it").toBeDefined();
    const actionPart = String(actionCard!.partId);
    const actionVersion = Number(actionCard!.version);
    const sitePin = { partId: sitePart, version: siteVersion };
    const siteId = `part:${sitePart}:v${siteVersion}`;
    const actionId = `part:${actionPart}:v${actionVersion}`;

    // ---- Two Flows pin the site part: the one the build made, and a second one a person starts. ----
    const mainCall = mainOf.graph.nodes.find((node) => node.definitionId === CALL)!;
    const { subflowId: _sibling, ...mainCallParameters } = mainCall.parameterValues ?? {};
    await service.saveFlow({ projectId, flow: { ...mainOf.graph, nodes: mainOf.graph.nodes.map((node) => node.id !== mainCall.id ? node : { ...node, parameterValues: { ...mainCallParameters, part: sitePin } }) } });
    const flowTwo = "flow.second.caller";
    await service.createFlow({ projectId, flowId: flowTwo, name: "Keep other roles" });
    await service.saveFlowGenerationInstruction({ projectId, flowId: flowTwo, instruction: "Find the roles for other words, and save the first few of them to my saved jobs." });
    const second = await service.createFlowSubflow({ projectId, flowId: flowTwo, name: "Primary", role: "primary" });
    const secondBlank = await service.getFlow(projectId, second.graphFlowId!);
    const open = mainOf.graph.nodes.find((node) => node.parameterValues?.url !== undefined)!;
    await service.saveFlow({ projectId, flow: { ...secondBlank,
      nodes: [
        { id: "second.start", definitionId: "builtin.control.start", definitionVersion: "1.0.0", label: "Start" },
        { ...open, id: "second.open" },
        { id: "second.call", definitionId: CALL, definitionVersion: "1.0.0", label: "keep these roles", parameterValues: { part: sitePin, inputs: { words: wordsTwo! } }, metadata: {} }
      ],
      edges: [
        { id: "second.1", sourceNodeId: "second.start", sourcePortId: "success", targetNodeId: "second.open", targetPortId: "in" },
        { id: "second.2", sourceNodeId: "second.open", sourcePortId: "success", targetNodeId: "second.call", targetPortId: "in" }
      ]
    } });
    await service.setFlowMapFallback({ projectId, flowId: flowTwo, kind: "subflow", targetSubflowId: second.subflowId });

    // A person's look at the library: both Flows call the site part, by the Flow they would open, and the action's caller is the site part.
    const got = record(await service.projectParts.get({ projectId, partId: sitePart }));
    const gotAction = record(await service.projectParts.get({ projectId, partId: actionPart }));
    console.log(JSON.stringify({ pinnedCallers: { site: got.callers, action: gotAction.callers, calls: got.calls } }));
    const flowCallers = list(got.callers).filter((caller) => caller.kind === "flow");
    expect(flowCallers.map((caller) => caller.flowId).sort(), JSON.stringify(got.callers)).toEqual([flowOne, flowTwo].sort());
    expect(flowCallers.every((caller) => caller.version === siteVersion)).toBe(true);
    expect(list(gotAction.callers).filter((caller) => caller.kind === "part" && caller.partId === sitePart && caller.callerVersion === siteVersion && caller.version === actionVersion)).toHaveLength(1);
    expect(list(got.calls).map((node) => [node.partId, node.version])).toEqual([[actionPart, actionVersion]]);
    expect(list(record(await service.projectParts.list({ projectId, usedByFlowId: flowTwo })).parts).map((card) => card.partId)).toEqual([sitePart]);

    // ---- From here no model may be called. ----
    let providerCalls = 0;
    service.bindLlmExecutionProvider(() => ({
      provider: {
        metadata: { provider: "throws", model: "none" },
        runTask: async () => {
          providerCalls += 1;
          throw new Error("diagnostic.a_replay_called_a_model");
        }
      },
      maxCallsPerRun: 1,
      maxEstimatedCostUsd: 0
    }));
    const freshBoard = async (): Promise<string[]> => {
      await installed.resetLab();
      await readyBoard(page, origin);
      const saved = await savedOnBoard(installed);
      for (const posting of [...intended, ...others, ...intendedTwo]) expect(saved, "the board starts with none of these saved").not.toContain(posting.key);
      return saved;
    };
    const keysOf = (rows: readonly { key: string }[]) => rows.map((row) => row.key);
    const clicks = (commands: readonly string[]) => commands.filter((command) => command === "web.dom.click").length;
    const reads = (commands: readonly string[]) => commands.filter((command) => command === "web.dom.extract_list").length;
    const replay = async (flowId: string) => {
      const before = installed.siteCommands().length;
      const at = Date.now();
      const session = await service.runRuntimeSession({ projectId, flowId, inputs: {}, adaptiveMode: "no_llm_intervention", permittedConsequences: ["modify_existing"], authorizedExternalSideEffects: true });
      const commands = installed.siteCommands().slice(before);
      const ran = versionsRan(session.trace);
      console.log(JSON.stringify({ pinnedFlowRun: { flowId, status: session.status, versions: [...new Set(ran)], calls: ran.length, clicks: clicks(commands), reads: reads(commands), ms: Date.now() - at } }));
      return { session, commands, ran };
    };

    // (a) Each Flow replays at no model call: the site part at its version, the action part once per row, each job saved exactly once.
    let savedAtStart = await freshBoard();
    const first = await replay(flowOne);
    await keepDiagnostic(testInfo, "pinned-calls-flow-one.json", { trace: first.session.trace ?? null } as unknown as JsonObject);
    expect(first.session.status, JSON.stringify(record(first.session.trace).message ?? null)).toBe("succeeded");
    expect(new Set(first.ran), "the trace says which versions ran").toEqual(new Set([siteId, actionId]));
    expect(first.ran.filter((id) => id === actionId), "the action part is called once per row").toHaveLength(MOST);
    expect(await savedOnBoard(installed), "each intended job saved exactly once: a second press would have unsaved it").toEqual([...savedAtStart, ...keysOf(intended)].sort());
    const titlesOne = await myJobsTitles(page, origin);
    for (const posting of intended) expect(titlesOne.filter((shown) => shown === posting.title), posting.title).toHaveLength(1);
    await page.screenshot({ path: testInfo.outputPath("after-flow-one-my-jobs.png"), fullPage: true });
    savedAtStart = await freshBoard();
    const secondRun = await replay(flowTwo);
    await keepDiagnostic(testInfo, "pinned-calls-flow-two.json", { trace: secondRun.session.trace ?? null } as unknown as JsonObject);
    expect(secondRun.session.status, JSON.stringify(record(secondRun.session.trace).message ?? null)).toBe("succeeded");
    expect(new Set(secondRun.ran)).toEqual(new Set([siteId, actionId]));
    const savedAfterBoth = await savedOnBoard(installed);
    console.log(JSON.stringify({ pinnedSaved: { start: savedAtStart, wordsTwo, one: keysOf(intended), two: keysOf(intendedTwo), after: savedAfterBoth } }));
    expect(savedAfterBoth, "the second Flow's own rows, each exactly once").toEqual([...savedAtStart, ...keysOf(intendedTwo)].sort());
    const titles = await myJobsTitles(page, origin);
    for (const posting of intendedTwo) expect(titles.filter((shown) => shown === posting.title), posting.title).toHaveLength(1);
    await page.screenshot({ path: testInfo.outputPath("after-flow-two-my-jobs.png"), fullPage: true });

    // (b) A new version of the action part changes nothing for its pinned callers: byte for byte, and in what they run.
    const pinnedBefore = JSON.stringify((await service.getFlow(projectId, mainOf.graph.flowId)).nodes);
    const libraryBefore = JSON.stringify(await service.projectParts.graphs(projectId, flowOne).load(sitePin));
    const actionNow = await service.getFlow(projectId, action.graphFlowId!);
    const waitFirst = `${action.subflowId}.wait`;
    await service.saveFlow({ projectId, flow: { ...actionNow,
      nodes: [actionNow.nodes[0]!, { id: waitFirst, definitionId: "builtin.timing.wait", definitionVersion: "1.0.0", label: "wait first", parameterValues: { duration: 1, unit: "seconds" } }, actionNow.nodes[1]!],
      edges: [{ id: `${waitFirst}.in`, sourceNodeId: actionNow.nodes[0]!.id, sourcePortId: "success", targetNodeId: waitFirst, targetPortId: "in" }, { id: `${pressCopy}.in`, sourceNodeId: waitFirst, sourcePortId: "success", targetNodeId: pressCopy, targetPortId: "in" }]
    } });
    const newer = record(await service.projectParts.save({ projectId, flowId: flowOne, subflowId: action.subflowId }));
    console.log(JSON.stringify({ pinnedNewerAction: newer }));
    expect(newer).toMatchObject({ saved: true, partId: actionPart, version: actionVersion + 1 });
    expect(JSON.stringify((await service.getFlow(projectId, mainOf.graph.flowId)).nodes), "the Flow's graph, byte for byte").toBe(pinnedBefore);
    expect(JSON.stringify(await service.projectParts.graphs(projectId, flowOne).load(sitePin)), "the version it pins, byte for byte").toBe(libraryBefore);
    savedAtStart = await freshBoard();
    const afterChange = await replay(flowOne);
    expect(afterChange.session.status).toBe("succeeded");
    expect(new Set(afterChange.ran), "still the version it pinned").toEqual(new Set([siteId, actionId]));
    expect(await savedOnBoard(installed)).toEqual([...savedAtStart, ...keysOf(intended)].sort());

    // (c) The site part run by itself: each press looked at first, its row found again across the call, by identity.
    const askRun = async (): Promise<JsonObject> => record(await service.projectParts.run({ projectId, partId: sitePart, version: siteVersion, inputs: { words: WORDS_ONE }, permittedConsequences: ["modify_existing"], acknowledgedRepeat: true } as Parameters<typeof service.projectParts.run>[0]));
    const runWith = async (meanwhile: () => Promise<void>): Promise<{ answer: JsonObject; commands: string[]; ms: number }> => {
      const before = installed.siteCommands().length;
      const at = Date.now();
      const running = askRun();
      let answered: JsonObject | undefined;
      void running.then((answer) => { answered = answer; });
      await expect.poll(() => installed.siteCommands().slice(before).includes("web.dom.extract_list") || answered !== undefined, { timeout: 60_000, intervals: [100] }).toBe(true);
      expect(installed.siteCommands().slice(before), JSON.stringify(answered ?? null)).toContain("web.dom.extract_list");
      await page.waitForTimeout(3_000);
      expect(reads(installed.siteCommands().slice(before)), "nothing has begun its re-read yet").toBe(1);
      await meanwhile();
      const answer = await running;
      expect(list(record(answer.outputs).roles).slice(0, MOST).map((row) => row.title), "the read saw the page before it changed").toEqual(intended.map((posting) => posting.title));
      return { answer, commands: installed.siteCommands().slice(before), ms: Date.now() - at };
    };
    savedAtStart = await freshBoard();
    const reordered = await runWith(async () => {
      const order = await page.evaluate(() => {
        const firstCard = document.querySelector("article[data-jk]")!.closest("li")!;
        const parent = firstCard.parentElement!;
        for (const child of [...parent.children].reverse()) parent.append(child);
        return [...parent.querySelectorAll("article[data-jk]")].map((article) => article.getAttribute("data-jk"));
      });
      expect(order.indexOf(intended[1]!.key), "an intended row now stands after a row the part does not mean").toBeGreaterThan(order.indexOf(others.at(-1)!.key));
    });
    console.log(JSON.stringify({ pinnedPartReordered: { status: reordered.answer.status, stoppedAt: reordered.answer.stoppedAt ?? null, clicks: clicks(reordered.commands), reads: reads(reordered.commands), modelCalls: reordered.answer.modelCalls, ms: reordered.ms } }));
    expect(reordered.answer.status, JSON.stringify(reordered.answer)).toBe("succeeded");
    expect(reordered.answer.modelCalls).toBe(0);
    expect(reads(reordered.commands), "the read, and at least once again before each row's press").toBeGreaterThanOrEqual(MOST + 1);
    expect(await savedOnBoard(installed), "exactly the intended rows, wherever they stood").toEqual([...savedAtStart, ...keysOf(intended)].sort());

    // A row removed between the read and its press: reported gone across the call, no press for it, the rows after it not tried.
    savedAtStart = await freshBoard();
    const [kept0, removed, after] = intended as [Posting, Posting, Posting];
    const gone = await runWith(async () => {
      await page.evaluate((key) => document.querySelector(`article[data-jk="${key}"]`)!.closest("li")!.remove(), removed.key);
    });
    console.log(JSON.stringify({ pinnedPartRowGone: { status: gone.answer.status, acts: gone.answer.acts, stoppedAt: gone.answer.stoppedAt ?? null, clicks: clicks(gone.commands), reads: reads(gone.commands), ms: gone.ms } }));
    expect(gone.answer.status, JSON.stringify(gone.answer)).toBe("stopped");
    expect(String(record(gone.answer.stoppedAt).reason)).toContain("gone");
    const savedAfterGone = await savedOnBoard(installed);
    expect(savedAfterGone, "the row before it saved once, the removed one not, the one after it not tried").toEqual([...savedAtStart, kept0.key].sort());
    expect(savedAfterGone).not.toContain(after.key);
    await page.screenshot({ path: testInfo.outputPath("after-row-gone-across-call.png"), fullPage: true });

    expect(providerCalls, "no replay called a model").toBe(0);
    expect(installed.gatewayErrors).toEqual([]);
  } finally {
    await keepDiagnostic(testInfo, "pinned-calls-diagnostic.json", diagnostic);
    await build.stop();
    await installed.close();
  }
});
