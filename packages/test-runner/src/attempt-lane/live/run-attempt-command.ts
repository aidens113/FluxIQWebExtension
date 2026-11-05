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
import { attemptCacheShare, AttemptProofStuck, AttemptScriptRefused, openLiveAttemptSession, type AttemptCacheShare, type LiveAttemptSession } from "./attempt/index.js";
import { attemptBalanceFailures } from "./balance-failures.js";
import { attemptCanGoOn } from "./can-go-on.js";
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

/** What the run keeps of each attempt as it ends: the ending, the cache share of its own steps, and the model calls it made by kind. */
type AttemptKept = { ended: LiveAttemptEnded; cache: AttemptCacheShare; modelCalls: Record<string, number> | null };

const subtracted = (now: Readonly<Record<string, number>>, before: Readonly<Record<string, number>>): Record<string, number> => Object.fromEntries(Object.entries(now).flatMap(([kind, count]) => (count > (before[kind] ?? 0) ? [[kind, count - (before[kind] ?? 0)]] : [])));

/**
 * `lab attempt`: one attempt at one task, or with `--attempts 2` its first and second, started
 * from the real chat, followed to each ending, scored on `answerVerdict` and the double-act
 * oracle, with the evidence kept.
 *
 * **Two attempts are one workspace, one thread and one site, never reseeded between them.**
 * The second is the same words typed into the same thread: that is what a person with the
 * panel open does, the second turn sits under the first where the two can be compared, and a
 * thread's reads are what follow it. It is judged against what the first left.
 *
 * Exits 0 only when every attempt asked for ran and answered right, and a second was proven to
 * start from the first's saved work. A proof that stopped waiting or a request the script did
 * not expect says so and exits 1: neither is a judgement of the attempt.
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
    process.stdout.write(`${JSON.stringify({ status: "ready", providerCallCount: 0, lane: "attempt", entry: "chat", task: request.task.id, attempts: command.attempts, model: command.model.kind, authoringMode: command.authoringMode, live: planned?.live?.describe() ?? null })}\n`);
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
  const kept = new Map<number, AttemptKept>();
  let stepsSoFar = 0;
  let callsSoFar: Readonly<Record<string, number>> = {};
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
        const folder = command.attempts === 1 ? evidence : path.join(evidence, `attempt-${attempt.ordinal}`);
        await mkdir(folder, { recursive: true });
        await writeFile(path.join(folder, "site.json"), JSON.stringify(attempt.site, null, 2));
        await pictureOfAnswer(opened, attempt, folder, log);
        const cache = await attemptCacheShare(stepsDirectory, stepsSoFar);
        stepsSoFar = await countSteps(stepsDirectory);
        const calls = side.server?.counts() ?? null;
        kept.set(attempt.ordinal, { ended: attempt, cache, modelCalls: calls && subtracted(calls, callsSoFar) });
        callsSoFar = calls ?? {};
      },
    });
    const series = await runAttemptSeries({
      task: { scenario, request, workflow }, driver, attempts: command.attempts, between: "as_left",
      mayGoOn: async (outcome) => attemptCanGoOn(outcome, (await attemptBalanceFailures(stepsDirectory)).length > 0),
    });
    const rows = series.series.rows.map((row) => {
      const hit = kept.get(row.attempt)?.cache.hitPercent ?? null;
      return hit === null ? row : { ...row, cacheHitPercent: hit };
    });
    const startedFromFirst = series.series.secondStartedFromFirst ?? undefined;
    const told = series.outcomes.map((outcome, index) => {
      const row = rows[index]!, keeping = kept.get(row.attempt)!, attempt = keeping.ended.outcome.attempt;
      return { row, answer: outcome.answer, attempt, saved: keeping.ended.outcome.saved ?? null, budgetUsd: attempt.budget.usd, cache: keeping.cache, actsWithNoRow: attempt.actsWithNoRow ?? 0, modelCalls: keeping.modelCalls, startedFrom: outcome.startedFrom, site: keeping.ended.site };
    });
    const lines = told.map(({ row, answer, attempt }) => attemptResultLine({ row, answer, status: attempt.status, waitingFor: attempt.waitingFor, actsWithNoRow: attempt.actsWithNoRow, startedFromFirst: row.attempt > 1 ? startedFromFirst : undefined }));
    const continuation = series.continuations[0] ?? null;
    const notRun = series.stoppedShort === undefined ? [] : [`Attempt ${told.length + 1} did not run: ${series.stoppedShort}.`];
    const notProven = continuation && !continuation.held ? [`That the second attempt started from the first's saved work is refused: ${continuation.refused.join(", ")}.`] : [];
    const report = renderAttemptSeries({ ...series.series, rows });
    await writeFile(path.join(evidence, "attempt.json"), JSON.stringify(command.attempts === 1 ? told[0] : { attempts: told, series: { ...series.series, rows }, continuation, stoppedShort: series.stoppedShort ?? null, reseededBetween: false }, null, 2));
    await writeFile(path.join(evidence, "attempt-report.txt"), `${[report, ...lines, ...notRun, ...notProven].join("\n")}\n`);
    // A wait for a person with none coming is a proof that did not finish, however good what it held so far.
    const allRight = told.length === command.attempts && told.every(({ answer, attempt }) => answer.verdict === "right" && attempt.status !== "waiting_for_person") && (continuation === null || continuation.held);
    verdict = allRight ? "passed" : "failed";
    if (side.live) await writePaidAttemptBundle({ runsDirectory: paths.runsDirectory, runId, startedAt, verdict, plan: side.live.describe().authorized, spentUsd: told.reduce((sum, { attempt }) => sum + attempt.spend.usd, 0), stepsDirectory });
    exitCode = allRight ? 0 : 1;
    for (const line of [...lines, ...notRun, ...notProven]) process.stdout.write(`[attempt] ${line}\n`);
    const last = told.at(-1)!;
    process.stdout.write(`${JSON.stringify({ status: verdict, task: last.row.taskId, answerVerdict: last.row.answerVerdict, ended: last.attempt.status, live: last.row.live, standIns: last.row.standIns, ...(command.attempts === 1 ? {} : { attempts: told.map(({ row, attempt }) => ({ attempt: row.attempt, answerVerdict: row.answerVerdict, ended: attempt.status, path: row.path, calls: row.calls })), secondStartedFromFirst: series.series.secondStartedFromFirst, reseededBetween: false }), evidence })}\n`);
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
