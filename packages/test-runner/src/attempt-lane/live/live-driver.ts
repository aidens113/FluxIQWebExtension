import type { AttemptStandIn } from "@fluxiq-web-extension/test-contracts";
import type { ChatBrowserSession } from "../../extension-chat-check/index.js";
import { attemptEndingOfBuild, judgeAttemptAnswer, judgeEveryFact, readSiteBaseline, type AttemptEndingFact, type RunDatasetControl } from "../../flow-lane/index.js";
import { finalStateFacts } from "../../lane-rules/index.js";
import { playwrightScenarioFactProbe } from "../../scenario-assertions.js";
import type { AttemptDriver, AttemptOutcome, AttemptSavedState, AttemptTask } from "../driver.js";
import { liveAttemptStage, readTaskAttempt, type AttemptOutcomeRead, type AttemptOutcomeRecord, type AttemptReadControl } from "./attempt/index.js";
import type { AnswerTurnDom } from "./answer-turn-dom.js";
import { followAttempt } from "./follow-attempt.js";
import { panelAnswerPort } from "./panel-answer-port.js";

/** One attempt's ending, kept for the run's result line and its evidence. */
export type LiveAttemptEnded = Readonly<{ outcome: AttemptOutcomeRead; shown: AnswerTurnDom | null; conversationId: string }>;

export type LiveAttemptDriverInput = {
  control: AttemptReadControl & RunDatasetControl;
  session: ChatBrowserSession;
  projectId: string;
  origin: string;
  runToken: string;
  /** Puts the fixture back to its seed: the attempt's baseline. */
  resetSite(): Promise<void>;
  /** Types the instruction into the real chat, as a person does, and answers the thread it went to. */
  send(instruction: string): Promise<{ conversationId: string }>;
  /** What has moved, for the watch (`./follow-attempt.ts`). */
  progress?: () => Promise<{ marker: string; refused?: string }>;
  standIns: readonly AttemptStandIn[];
  stallMs?: number;
  log?: (line: string) => void;
  /** Called once the attempt has stopped and the turn is read, with the page still as it left it. */
  onEnded?: (ended: LiveAttemptEnded) => Promise<void>;
};

/** An attempt's ending to the hard rule: a budget or a person's Stop excuses, and anything else short of a result is `other`. */
function endingOf(attempt: AttemptOutcomeRecord): AttemptEndingFact {
  if (attempt.status === "achieved" || attempt.status === "finished_unchecked") return "finished";
  if (attempt.status === "budget_out") return attemptEndingOfBuild("budget_exhausted");
  if (attempt.status === "stopped_by_person") return attemptEndingOfBuild("cancelled");
  return "other";
}

/** What the attempt's record says it left, as the series reads it. Core's route gives no digest of the draft yet, so a continuation cannot be proven from it. */
function savedOf(outcome: AttemptOutcomeRead): AttemptSavedState | null {
  const { saved } = outcome;
  return saved ? { state: saved.state, ...(saved.flowId ? { flowId: saved.flowId } : {}), draftDigest: null } : null;
}

/**
 * Runs a real attempt: the instruction typed into the real chat, followed through the
 * real service by the read the extension uses, until it ends. It is then scored with
 * the task's own oracle: the attempt's stored rows, the site's change since its
 * recorded baseline, the declared final state on the page it left, and the answer
 * turn out of the panel's DOM.
 *
 * Only attempt 1 is exercised today. `startedFrom` is always `null`, so
 * `proveContinuation` refuses a second attempt until Core says what it started from.
 */
export function liveAttemptDriver(input: LiveAttemptDriverInput): AttemptDriver {
  const log = input.log ?? (() => undefined);
  return {
    seedSite: input.resetSite,
    run: async (task: AttemptTask): Promise<AttemptOutcome> => {
      const { request, scenario, workflow } = task;
      const baseline = await readSiteBaseline(input.origin, input.runToken, scenario.id);
      log(`[attempt] typing the instruction into the chat: ${request.task.id}`);
      const { conversationId } = await input.send(request.task.instruction);
      const followed = await followAttempt({
        control: input.control, projectId: input.projectId, conversationId, known: new Set(),
        ...(input.progress ? { progress: input.progress } : {}),
        describeChat: () => input.session.panel?.text() ?? Promise.resolve(""),
        onChange: (line) => log(`[attempt] ${line}`),
        ...(input.stallMs === undefined ? {} : { stallMs: input.stallMs }),
      });
      const outcome = await readTaskAttempt(input.control, input.projectId, followed.attempt.attemptId);
      const { attempt } = outcome;
      log(`[attempt] it ended: ${attempt.status}${attempt.waitingFor ? ` for ${attempt.waitingFor}` : ""}`);
      let shown: AnswerTurnDom | null = null;
      const columnIds = new Map((outcome.result?.rows?.columns ?? []).map(({ id, label }) => [label, id]));
      const stage = liveAttemptStage({
        control: input.control, projectId: input.projectId, scenarioId: scenario.id, scenarioOrigin: input.origin, runToken: input.runToken, baseline, result: outcome.result, standIns: input.standIns,
        chat: panelAnswerPort({ session: input.session, attemptId: attempt.attemptId, columnIds, onRead: (dom) => { shown = dom; } }),
      });
      const page = input.session.scenario;
      const judged = await judgeAttemptAnswer({
        request, workflow, scenarioOrigin: input.origin, ending: endingOf(attempt), stage, baseline,
        judgeFinalState: async () => {
          const facts = await judgeEveryFact(finalStateFacts(scenario, workflow), playwrightScenarioFactProbe(page));
          return { held: facts.every((fact) => fact.held), unheldFacts: facts.filter((fact) => !fact.held), facts };
        },
      });
      await input.onEnded?.({ outcome, shown, conversationId });
      return Object.freeze({
        record: {
          taskId: request.task.id, attemptId: attempt.attemptId, ordinal: attempt.ordinal, projectId: attempt.projectId,
          ...(attempt.flowId ? { flowId: attempt.flowId } : {}),
          path: attempt.path,
          // `finished_unchecked` is a Flow's run with nothing to check it by, which an explore never is; the Lab's words have it as achieved's near neighbour, and its row carries the answer's own verdict either way.
          status: attempt.status === "finished_unchecked" ? "achieved" as const : attempt.status,
          spend: attempt.spend,
          liveSteps: attempt.liveSteps,
          ...(attempt.simulation ? { simulation: attempt.simulation } : {}),
          loopsCaught: attempt.loopsCaught,
        },
        saved: savedOf(outcome),
        startedFrom: null,
        answer: judged.score,
        oracleVerdict: null,
        standIns: input.standIns,
      });
    },
  };
}
