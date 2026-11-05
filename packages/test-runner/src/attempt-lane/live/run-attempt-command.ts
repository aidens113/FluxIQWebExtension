import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_LLM_MODEL, llmProviderForModel, resolveScenarioWorkflow, type AttemptStandIn } from "@fluxiq-web-extension/test-contracts";
import type { LabCommand } from "../../commands.js";
import { captureBrowserWindows } from "../../extension-chat-check/index.js";
import { loadCreatedFlowRequest, resetScenarioLab, type CreatedFlowRequest } from "../../flow-lane/index.js";
import { resolveLabPaths } from "../../lab-instance/index.js";
import { countSteps, LabRunRecord } from "../../lab-runs/index.js";
import { beginLiveLlmRun, ensureLiveLlmSecretKey, type LiveLlmRun } from "../../live-llm/index.js";
import { assertRealisticScenarios } from "../../realistic-scenarios/index.js";
import { loadScenarioManifest } from "../../scenarios.js";
import { renderAttemptSeries } from "../report.js";
import { runAttemptSeries } from "../run-attempt-series.js";
import { SCRIPTED_MODEL_FORM_ENV, scriptedModelChildEnvironment, scriptedModelKey, scriptedModelScriptFor, startScriptedModelServer, type ScriptedModelServer } from "../scripted-model/index.js";
import { attemptCacheShare, AttemptProofStuck, AttemptScriptRefused, openLiveAttemptSession, type LiveAttemptSession } from "./attempt/index.js";
import { liveAttemptDriver, type LiveAttemptEnded } from "./live-driver.js";
import { attemptResultLine } from "./result-line.js";
import { readPanelAnswerTurn } from "./panel-answer-port.js";
import { writePaidAttemptBundle } from "./paid-attempt-bundle.js";

type AttemptCommand = Extract<LabCommand, { command: "attempt" }>;

export type AttemptCommandInput = {
  command: AttemptCommand;
  repositoryRoot: string;
  fluxiqRepositoryRoot: string;
  /** The Lab's resolved environment, with a scripted run's scrubbed already. */
  environment: NodeJS.ProcessEnv;
  /** The run's own arguments, which a live run's Core reads its model, mode and ceiling from. */
  argv: readonly string[];
  log?: (line: string) => void;
};

/** What a scripted run stands in for: a model's choices, and the calls, tokens and dollars its made-up usage comes to. */
const SCRIPTED_MODEL_STAND_INS: readonly AttemptStandIn[] = Object.freeze(["model", "spend"]);

/** An attempt's own default budget, as a scripted run's Core is told it (`../../live-llm/cost-ceiling-env.ts`), so a scripted attempt is held to what a person's is. */
const SCRIPTED_BUDGET_USD = "5";

/** The same name as a run's (`run-scenario.ts`), which is what the spend ledger selects a paid run's folder by. */
function attemptRunId(now: number): string {
  return `run-${now.toString(36)}-${randomBytes(4).toString("hex")}`;
}

/** How the run reaches a model: a scripted server and its fake key, or a real one planned and guarded as any live run is. */
type ModelSide = {
  environment: NodeJS.ProcessEnv;
  args: readonly string[];
  standIns: readonly AttemptStandIn[];
  authorize: (session: Parameters<Parameters<typeof openLiveAttemptSession>[0]["authorize"]>[0], control: Parameters<Parameters<typeof openLiveAttemptSession>[0]["authorize"]>[1]) => Promise<void>;
  server?: ScriptedModelServer;
  live?: LiveLlmRun;
};

async function scriptedSide(input: AttemptCommandInput, evidence: string, log: (line: string) => void): Promise<ModelSide> {
  const key = scriptedModelKey();
  const server = await startScriptedModelServer({
    script: scriptedModelScriptFor(input.command.taskId, input.environment[SCRIPTED_MODEL_FORM_ENV]),
    key,
    logDirectory: path.join(evidence, "model"),
    onCall: (call) => log(`[attempt] model request ${call.kind} ${call.ordinal}${call.answered ? "" : ` REFUSED: ${call.refused}`}`),
  });
  const model = DEFAULT_LLM_MODEL;
  return {
    server, standIns: SCRIPTED_MODEL_STAND_INS,
    environment: scriptedModelChildEnvironment(input.environment, server.origin),
    args: ["--authoring-mode", input.command.authoringMode, "--llm-max-cost-usd", SCRIPTED_BUDGET_USD, "--llm-model", model],
    authorize: async (topology, control) => {
      if (!topology.authorizationPassword) throw new Error("The isolated Core published no account password to install the key with");
      const installed = await ensureLiveLlmSecretKey(control, { secretValue: key, authorizationPassword: topology.authorizationPassword, ...(topology.authorizationPin ? { authorizationPin: topology.authorizationPin } : {}), model, provider: llmProviderForModel(model) });
      if (installed.created) await control.reauthenticate();
    },
  };
}

async function liveSide(input: AttemptCommandInput, llm: Extract<AttemptCommand["model"], { kind: "live" }>["llm"]): Promise<ModelSide> {
  const live = await beginLiveLlmRun({ profile: llm, repositoryRoot: input.repositoryRoot, environment: input.environment, targetMode: "isolated", costCeilingSources: { args: input.argv, environment: input.environment } });
  live.assertChatBuildable();
  return {
    live, standIns: [], environment: input.environment, args: input.argv,
    authorize: (topology, control) => live.chatBuildAuthorizer(control, topology)(),
  };
}

/** The picture of what a person sees, with the answer turn scrolled into the panel. It never decides the proof. */
async function pictureOfAnswer(session: LiveAttemptSession, ended: LiveAttemptEnded, evidence: string, log: (line: string) => void): Promise<void> {
  const file = path.join(evidence, "answer-turn.jpg");
  const page = session.browser.panel?.page ?? session.browser.control;
  await page.evaluate(({ attemptId, viaViews }) => {
    const current = globalThis as unknown as Window & { chrome?: { extension: { getViews(): Window[] } } };
    const panel = viaViews ? current.chrome?.extension.getViews().find((view) => view !== (current as Window) && view.location.pathname === "/sidepanel/index.html") : current;
    Array.from(panel?.document.querySelectorAll("li.answer-turn") ?? []).find((turn) => turn.getAttribute("data-attempt-id") === attemptId)?.scrollIntoView({ block: "start" });
  }, { attemptId: ended.outcome.attempt.attemptId, viaViews: session.browser.panel?.page === undefined }).catch(/* best-effort: a picture never decides the run */ () => undefined);
  await new Promise((resolve) => setTimeout(resolve, 500));
  const taken = await captureBrowserWindows(session.browser.browser, session.browser.profileDir);
  if (taken.bytes) {
    await writeFile(file, taken.bytes);
    log(`[attempt] the picture of the answer is ${file}`);
  } else log(`[attempt] no picture of the answer: ${taken.reason ?? "the capture gave nothing"}`);
  await writeFile(path.join(evidence, "answer-turn.json"), JSON.stringify(await readPanelAnswerTurn(session.browser, ended.outcome.attempt.attemptId), null, 2));
}

/**
 * `lab attempt`: one attempt at one task, started from the real chat, followed to its
 * ending, scored on `answerVerdict` and the double-act oracle, with the evidence kept.
 * Exits 0 only on a right answer. A proof that stopped waiting or a request the script
 * did not expect says so and exits 1: neither is a judgement of the attempt.
 */
export async function runAttemptCommand(input: AttemptCommandInput): Promise<number> {
  const { command, repositoryRoot, fluxiqRepositoryRoot } = input;
  assertRealisticScenarios([command.scenarioId], "lab attempt");
  const log = input.log ?? ((line: string) => { process.stderr.write(`${line}\n`); });
  const paths = resolveLabPaths(repositoryRoot, input.environment);
  const scenario = await loadScenarioManifest(repositoryRoot, command.scenarioId, paths.scenarioLabDist);
  const request: CreatedFlowRequest = await loadCreatedFlowRequest({ repositoryRoot, scenarioLabDist: paths.scenarioLabDist, scenarioId: command.scenarioId, taskId: command.taskId });
  const workflow = resolveScenarioWorkflow(scenario, { ...(request.workflowId === undefined ? {} : { workflowId: request.workflowId }), ...(request.variantId === undefined ? {} : { variantId: request.variantId }) });
  if (command.model.kind === "scripted") scriptedModelScriptFor(command.taskId, input.environment[SCRIPTED_MODEL_FORM_ENV]);
  const planned = command.model.kind === "live" ? await liveSide(input, command.model.llm) : undefined;
  if (command.dryRun) {
    process.stdout.write(`${JSON.stringify({ status: "ready", providerCallCount: 0, lane: "attempt", entry: "chat", task: request.task.id, model: command.model.kind, authoringMode: command.authoringMode, live: planned?.live?.describe() ?? null })}\n`);
    return 0;
  }
  const startedAt = new Date().toISOString();
  const runId = attemptRunId(Date.now());
  const evidence = path.join(paths.runsDirectory, "attempts", runId);
  await mkdir(evidence, { recursive: true });
  const side = planned ?? await scriptedSide(input, evidence, log);
  const labRun = side.live ? await LabRunRecord.open({ environment: input.environment, runId, startedAt, scenarioId: scenario.id, work: request.task.id, workflowId: request.workflowId, variantId: request.variantId, bundlePath: path.resolve(paths.runsDirectory, runId), repositoryRoot }) : undefined;
  if (side.live && labRun?.stepsDirectory) side.live.readStepLogFrom(labRun.stepsDirectory);
  const stepsDirectory = labRun?.stepsDirectory ?? path.join(evidence, "steps");
  let session: LiveAttemptSession | undefined;
  let ended: LiveAttemptEnded | undefined;
  let exitCode = 1;
  let verdict = "failed";
  try {
    session = await openLiveAttemptSession({
      repositoryRoot, fluxiqRepositoryRoot, runsDirectory: paths.runsDirectory, runId, seed: scenario.seed, startPath: scenario.startPath,
      environment: side.environment, args: side.args, stepLogDirectory: stepsDirectory,
      // A call cap sits on the purse, and reaching it reads as budget out, so a run's Core is held to one only when the run typed one.
      ...(side.live && input.argv.includes("--llm-max-calls") ? { buildCallLimit: side.live.authorizedBuildCallLimit } : {}),
      authorize: side.authorize, log,
    });
    const opened = session, startUrl = `${opened.topology.scenarioOrigin}${scenario.startPath}`;
    const driver = liveAttemptDriver({
      control: opened.control, session: opened.browser, projectId: opened.projectId, origin: opened.topology.scenarioOrigin, runToken: opened.topology.allocation.controllerToken,
      resetSite: async () => {
        await resetScenarioLab(opened.topology.scenarioOrigin, opened.topology.allocation.controllerToken);
        await opened.browser.scenario.goto(startUrl, { waitUntil: "domcontentloaded" });
      },
      send: opened.send,
      progress: async () => {
        const refused = side.server?.refusals()[0]?.refused;
        return { marker: `${await countSteps(stepsDirectory)} steps`, ...(refused ? { refused } : {}) };
      },
      standIns: side.standIns,
      log,
      onEnded: async (attempt) => {
        ended = attempt;
        await writeFile(path.join(evidence, "site.json"), JSON.stringify(attempt.site, null, 2));
        await pictureOfAnswer(opened, attempt, evidence, log);
      },
    });
    const series = await runAttemptSeries({ task: { scenario, request, workflow }, driver, attempts: 1 });
    const cache = await attemptCacheShare(stepsDirectory);
    const row = { ...series.series.rows[0]!, ...(cache.hitPercent === null ? {} : { cacheHitPercent: cache.hitPercent }) }, outcome = series.outcomes[0]!, attempt = ended!.outcome.attempt;
    const resultLine = attemptResultLine({ row, answer: outcome.answer, status: attempt.status, waitingFor: attempt.waitingFor, actsWithNoRow: attempt.actsWithNoRow });
    await writeFile(path.join(evidence, "attempt.json"), JSON.stringify({ row, answer: outcome.answer, attempt, saved: ended!.outcome.saved ?? null, budgetUsd: attempt.budget.usd, cache, actsWithNoRow: attempt.actsWithNoRow ?? 0, modelCalls: side.server?.counts() ?? null }, null, 2));
    await writeFile(path.join(evidence, "attempt-report.txt"), `${renderAttemptSeries({ ...series.series, rows: [row] })}\n`);
    if (side.live) await writePaidAttemptBundle({ runsDirectory: paths.runsDirectory, runId, startedAt, verdict: outcome.answer.verdict === "right" ? "passed" : "failed", plan: side.live.describe().authorized, spentUsd: attempt.spend.usd, stepsDirectory });
    // A wait for a person with none coming is a proof that did not finish, however good what it held so far.
    verdict = outcome.answer.verdict === "right" && attempt.status !== "waiting_for_person" ? "passed" : "failed";
    exitCode = verdict === "passed" ? 0 : 1;
    process.stdout.write(`[attempt] ${resultLine}\n`);
    process.stdout.write(`${JSON.stringify({ status: verdict, task: row.taskId, answerVerdict: row.answerVerdict, ended: attempt.status, live: row.live, standIns: row.standIns, evidence })}\n`);
  } catch (error) {
    if (!(error instanceof AttemptProofStuck) && !(error instanceof AttemptScriptRefused)) throw error;
    const words = error instanceof AttemptProofStuck ? `the proof stopped waiting, and the attempt was not judged: ${error.stood}` : `the script refused a request, so the attempt was not judged: ${error.message}`;
    process.stdout.write(`[attempt] ${command.taskId}: ${words}\n`);
    process.stdout.write(`${JSON.stringify({ status: "not_judged", task: command.taskId, why: error.name, evidence })}\n`);
    if (session) await captureBrowserWindows(session.browser.browser, session.browser.profileDir).then((taken) => (taken.bytes ? writeFile(path.join(evidence, "stopped.jpg"), taken.bytes) : undefined)).catch(/* best-effort: a picture never decides the run */ () => undefined);
  } finally {
    await session?.close();
    await side.server?.close();
    await labRun?.close({ verdict }).catch(/* best-effort: the run's own bundle is already written */ () => undefined);
  }
  return exitCode;
}
