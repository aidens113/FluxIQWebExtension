import { tmpdir } from "node:os";
import path from "node:path";
import type { BrowserContext, Page } from "@playwright/test";
import { flowScoreOf, type AttemptStandIn, type RunAnswerScore, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { askedChangeOf, judgeAttemptAnswer, judgeEveryFact, lastingViewOf, readSiteBaseline, readSiteState, type CreatedFlowAnswerStage, type FlowRunDataset } from "../../flow-lane/index.js";
import { finalStateFacts } from "../../lane-rules/index.js";
import type { ExtractionRecord } from "../../run-expectations/index.js";
import { playwrightScenarioFactProbe } from "../../scenario-assertions.js";
import { ScenarioStepRunner } from "../../scenario-steps/index.js";
import type { AttemptDriver, AttemptOutcome, AttemptSavedState, AttemptTask } from "../driver.js";
import { scriptedChatPort } from "./chat.js";
import { SCRIPTED_JUDGE_CALLS_WITHOUT_FLOW, SCRIPTED_JUDGE_CALLS_WITH_FLOW, scriptedSpend } from "./spend.js";
import type { ScriptedWorkspace } from "./workspace.js";

/** Every input a scripted attempt does not read from the product, named on every row it writes. */
export const SCRIPTED_STAND_INS: readonly AttemptStandIn[] = Object.freeze(["attempt_record", "stored_rows", "chat_turn", "exploration", "workspace", "spend"]);

/** A retry that lands an act again: after the named step, these steps play on the page it left. It is what an attempt must never do. */
export type ScriptedDoubleAct = Readonly<{ afterStep: string; replay: readonly ScenarioStep[] }>;

export type ScriptedDriverInput = {
  origin: string;
  runToken: string;
  /** A fresh visible tab for an attempt, in the session the attempt belongs to. */
  openTab(): Promise<{ context: BrowserContext; page: Page; close(): Promise<void> }>;
  /** Starts the attempt from the chat, as a person does; absent where the lane has no extension. */
  sendToChat?: (instruction: string, ordinal: number) => Promise<void>;
  /** Puts the fixture back to its seed: the attempt's baseline. */
  resetSite(): Promise<void>;
  workspace: ScriptedWorkspace;
  /** Which attempts the scripted explorer lands an act twice in. */
  doubleAct?: ScriptedDoubleAct;
  /** `silent` is a chat that never reaches the person. */
  chat?: "shows" | "silent";
  /** A picture of the attempt's tab as it ended. It must not throw. */
  picture?: (ordinal: number, page: Page) => Promise<void>;
  now?: () => number;
};

/**
 * STAND-IN for Core's whole attempt: the task's own recording script, played in a real
 * visible browser on the real site, is the exploration. What it reads becomes the
 * attempt's stored rows, and what it did is saved as its draft in `workspace`.
 *
 * Real here: the fixture and its state, the browser, every act and page, every oracle.
 * Scripted here, and named on the row: the attempt's record, rows standing in for
 * Core's dataset store, the chat's turn, the saved draft and the calls and dollars.
 *
 * Only the path is decided by what was saved: with a draft it plays those saved steps
 * and asks no model to decide them, and with none it explores and asks for each one.
 * So the second attempt spends less only if the first's draft is really there.
 */
export function scriptedAttemptDriver(input: ScriptedDriverInput): AttemptDriver {
  const now = input.now ?? Date.now;
  return {
    seedSite: input.resetSite,
    run: async (task: AttemptTask, ordinal: number): Promise<AttemptOutcome> => {
      const { request, scenario, workflow } = task;
      const baseline = await readSiteBaseline(input.origin, input.runToken, scenario.id);
      const draft = await input.workspace.read(request.task.id);
      const startedFrom: AttemptSavedState | null = draft ? { state: "partly_works", flowId: draft.flowId, draftDigest: draft.digest } : null;
      const steps: readonly ScenarioStep[] = draft ? draft.steps : workflow.recordingScript;
      const startedAt = now();
      const tab = await input.openTab();
      let liveSteps = 0;
      const read = new Map<string, readonly ExtractionRecord[]>();
      let answer: RunAnswerScore;
      try {
        await input.sendToChat?.(request.task.instruction, ordinal);
        await tab.page.goto(`${input.origin}${scenario.startPath}`, { waitUntil: "domcontentloaded" });
        const runner = new ScenarioStepRunner({
          context: tab.context, page: tab.page, origin: input.origin,
          isScenarioUrl: (url) => url.startsWith(input.origin),
          uploadDirectory: path.join(tmpdir(), "fluxiq-attempt-lane"),
          scriptedNavigation: async (target, url, timeoutMs) => { await target.goto(url, { waitUntil: "domcontentloaded", ...(timeoutMs === undefined ? {} : { timeout: timeoutMs }) }); },
        });
        const play = async (step: ScenarioStep): Promise<void> => {
          const { extraction } = await runner.run(step);
          liveSteps += 1;
          if (extraction) read.set(step.id, extraction.records);
        };
        for (const step of steps) {
          await play(step);
          if (!draft && input.doubleAct?.afterStep === step.id) for (const again of input.doubleAct.replay) await play(again);
        }
        const page = runner.activePage();
        await input.picture?.(ordinal, page);
        const datasets: FlowRunDataset[] = [...read].map(([stepId, records]) => ({ datasetId: `read-${stepId}`, nodeIds: [stepId], recordCount: records.length, storeTruncated: false, invalidCount: 0, records: [...records], nonStringValues: 0, pages: 1 }));
        const view = lastingViewOf(scenario.id);
        const asked = askedChangeOf(request.task.id);
        const stage: CreatedFlowAnswerStage = {
          readBaseline: async () => baseline,
          readSiteView: async () => view(await readSiteState(input.origin, input.runToken, scenario.id)),
          readStoredRows: async () => ({ extracted: datasets, actions: [], extractionDurationsByNode: new Map() }),
          chat: scriptedChatPort(input.chat ?? "shows", () => ({ rows: datasets.at(-1)?.records ?? [], landedActs: asked?.acts.length ?? 0 })),
          secretValues: [],
          standIns: SCRIPTED_STAND_INS,
        };
        const judged = await judgeAttemptAnswer({
          request, workflow, scenarioOrigin: input.origin, ending: "finished", stage, baseline,
          judgeFinalState: async () => {
            const facts = await judgeEveryFact(finalStateFacts(scenario, workflow), playwrightScenarioFactProbe(page));
            return { held: facts.every((fact) => fact.held), unheldFacts: facts.filter((fact) => !fact.held), facts };
          },
        });
        answer = judged.score;
      } finally {
        await tab.close().catch(/* best-effort: the attempt's score does not depend on closing its tab */ () => undefined);
      }
      // A saved Flow's run was judged by the Flow's own playback; an attempt that explored has no playback, so it is unproven whatever its answer.
      const flow = draft ? { flowCreated: true, oracleVerdict: answer.records !== "failed" && answer.finalState !== "failed" && answer.change !== "failed" ? "passed" as const : "failed" as const } : { flowCreated: false, oracleVerdict: null };
      answer = { ...answer, flow: flowScoreOf(flow) };
      // It saves what it did only when it landed the task: a draft that doubled an act is no start for the next attempt.
      const saved = answer.verdict === "right" && !draft ? await input.workspace.save(request.task.id, workflow.recordingScript) : draft;
      const savedState: AttemptSavedState | null = saved ? { state: "partly_works", flowId: saved.flowId, draftDigest: saved.digest } : null;
      const spend = scriptedSpend(draft ? SCRIPTED_JUDGE_CALLS_WITH_FLOW : liveSteps + SCRIPTED_JUDGE_CALLS_WITHOUT_FLOW);
      return Object.freeze({
        record: {
          taskId: request.task.id, attemptId: `${request.task.id}-${ordinal}`, ordinal, projectId: input.workspace.projectId,
          ...(draft ? { flowId: draft.flowId } : {}),
          path: draft ? "run_flow" as const : "explore" as const,
          status: answer.verdict === "right" ? "achieved" as const : "working" as const,
          spend: { ...spend, ms: now() - startedAt },
          liveSteps,
          simulation: { verdict: draft ? "not_run" as const : "passed" as const, flags: 0 },
          loopsCaught: Object.fromEntries(["exact_repeat", "near_repeat", "cycle", "no_progress", "same_fix"].map((pattern) => [pattern, { steered: 0, refused: 0, changeApproach: 0, askPerson: 0 }])),
        },
        saved: savedState,
        startedFrom,
        answer,
        oracleVerdict: flow.oracleVerdict,
        standIns: SCRIPTED_STAND_INS,
      });
    },
  };
}
