// Headed, provider-free, on job-board: a part's pass takes a page-level link, and its next lasting step must not land (t869).
//
// The build of pinned-calls-job-board.spec.ts with one more step: the header's "Sign in" link, which is href="#", so it moves
// nothing and is no row's. A person splits the per-row work into an action part of two steps, that link and then the job's heart.
// The page answers the link as page-level (resolution.passRow), so the heart is not pressed: nothing is saved, the site's own state
// says so, and the part names the item. The fixture is as it stands.
import type { JsonObject, JsonValue } from "fluxiq/core";
import type { Page } from "@playwright/test";
import { DEFAULT_QUERY, pageOfResults, searchPostings, sponsoredFor } from "../../../../../../scenario-lab/src/scenarios/job-board/catalog/index.js";
import { expect, test } from "../../../../fixtures/extension-context";
import { bindDetectingRuntime, bindScriptedProvider, detectedColumns, keepDiagnostic, pageHandle, pageHandleWhere, projectBuild, startInstalledBuild, type BuilderTurn, type InstalledBuild, type ScriptedAnswer } from "../../../../site-reset/index";

const HOME = "/scenarios/job-board/";
const CALL = "builtin.control.call-subflow";
const CLICK = "web.output.dom-click";
const MOST = 3;
const WAIT_SECONDS = 6;
const WORDS_ONE = "manager";
const TASK = "Find the roles for the words I give you, and save the first few of them to my saved jobs.";
const ROW_INPUT = { id: "item", name: "The role", valueType: { kind: "unknown" }, required: true };
const ROW_BINDING = { $state: { path: "item" } };

const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};

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

test("a pass that took a page-level link does not press its job: nothing is saved, and the part names the item", async ({ extensionSession }, testInfo) => {
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
    let signin = "", what = "", extraction = "", title = "", company = "", heart = "", pending = "";
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
      "  step signin: go to sign in",
      "    node: web.dom.click",
      `    target: ${signin}`,
      "    consequences: none",
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
          signin = pageHandle(turn.shownPage(), "Sign in");
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
    const siteOf = graphs.find((entry) => entry.graph.nodes.some((node) => node.label === "keep the role"))!;
    const press = siteOf.graph.nodes.find((node) => node.label === "keep the role")!;
    const signinNode = siteOf.graph.nodes.find((node) => node.label === "go to sign in")!;
    diagnostic.siteBefore = { nodes: siteOf.graph.nodes.map((node) => ({ id: node.id, definitionId: node.definitionId })), edges: siteOf.graph.edges } as unknown as JsonValue;
    const action = await service.createFlowSubflow({ projectId, flowId: flowOne, name: "Keep the role on this row", role: "utility" });
    const actionBlank = await service.getFlow(projectId, action.graphFlowId!);
    const actionStart = `${action.subflowId}.start`;
    const pressCopy = `${action.subflowId}.press`;
    const signinCopy = `${action.subflowId}.signin`;
    await service.saveFlow({ projectId, flow: { ...actionBlank,
      interface: { inputs: [ROW_INPUT], outputs: [] } as unknown as typeof actionBlank.interface,
      nodes: [{ id: actionStart, definitionId: "builtin.control.start", definitionVersion: "1.0.0", label: "Start" }, { ...signinNode, id: signinCopy }, { ...press, id: pressCopy }],
      edges: [{ id: `${signinCopy}.in`, sourceNodeId: actionStart, sourcePortId: "success", targetNodeId: signinCopy, targetPortId: "in" }, { id: `${pressCopy}.in`, sourceNodeId: signinCopy, sourcePortId: "success", targetNodeId: pressCopy, targetPortId: "in" }]
    } });
    await service.saveFlow({ projectId, flow: { ...siteOf.graph,
      nodes: siteOf.graph.nodes.map((node) => node.id !== press.id ? node : { id: press.id, definitionId: CALL, definitionVersion: "1.0.0", label: "keep this role", parameterValues: { subflowId: action.subflowId, inputs: { item: ROW_BINDING } }, metadata: {} }),
      edges: siteOf.graph.edges.filter((edge) => !(edge.targetNodeId === press.id && edge.targetPortId === "item"))
    } });

    const kept = record(await service.projectParts.save({ projectId, flowId: flowOne, subflowId: siteOf.subflow.subflowId, name: "Find the roles and keep the first few", purpose: "Find the roles for the words given and keep each of the first few" }));
    expect(kept.saved, JSON.stringify(kept)).toBe(true);
    const sitePart = String(kept.partId);
    const siteVersion = Number(kept.version);

    // ---- From here no model may be called. ----
    let providerCalls = 0;
    service.bindLlmExecutionProvider(() => ({
      provider: {
        metadata: { provider: "throws", model: "none" },
        runTask: async () => {
          providerCalls += 1;
          throw new Error("diagnostic.a_run_called_a_model");
        }
      },
      maxCallsPerRun: 1,
      maxEstimatedCostUsd: 0
    }));
    await installed.resetLab();
    await readyBoard(page, origin);
    const savedAtStart = await savedOnBoard(installed);
    for (const posting of intended) expect(savedAtStart, "the board starts with none of these saved").not.toContain(posting.key);
    const answer = record(await service.projectParts.run({ projectId, partId: sitePart, version: siteVersion, inputs: { words: WORDS_ONE }, permittedConsequences: ["modify_existing"], acknowledgedRepeat: true } as Parameters<typeof service.projectParts.run>[0]));
    console.log(JSON.stringify({ leftBehindRun: { status: answer.status, acts: answer.acts, stoppedAt: answer.stoppedAt ?? null, modelCalls: answer.modelCalls } }));
    expect(answer.status, JSON.stringify(answer)).toBe("stopped");
    expect(String(record(answer.stoppedAt).reason), "the part names the item").toContain("link that is not shown to be this item's");
    expect(await savedOnBoard(installed), "no job was saved: the heart was not pressed").toEqual(savedAtStart);
    await page.screenshot({ path: testInfo.outputPath("after-left-behind.png"), fullPage: true });
    expect(providerCalls, "no run called a model").toBe(0);
    expect(installed.gatewayErrors).toEqual([]);
  } finally {
    await keepDiagnostic(testInfo, "left-behind-diagnostic.json", diagnostic);
    await build.stop();
    await installed.close();
  }
});
