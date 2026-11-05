import { flowScoreOf, type AnswerOracleOutcome, type ResolvedScenarioWorkflow, type RunAnswerScore } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../../failure.js";
import type { FlowExtractionJudgement } from "../../expectations.js";
import { assertFlowExtraction } from "../../expectations.js";
import type { CreatedFlowBuild } from "../build-proposal.js";
import type { JudgedFinalState } from "../oracles.js";
import { judgeCreatedFlowDataset, type CreatedFlowDatasetSource } from "../judgement.js";
import type { CreatedFlowRequest } from "../request.js";
import { askedChangeOf, judgeAskedAgain, judgeLaterChange, judgeSiteChange, siteChange, stillAsked, type LastingView, type SiteBaseline, type SiteChange, type SiteChangeJudgement } from "../site-change/index.js";
import { judgeShownAnswer } from "./judge-shown.js";
import type { AttemptEndingFact, CreatedFlowAnswerStage } from "./ports.js";
import { scoreAnswer } from "./score-answer.js";

/** The score, and the dataset judgement behind it, which a caller may publish as the Flow lane publishes its own. */
export type AttemptAnswerJudgement = Readonly<{ score: RunAnswerScore; extraction: FlowExtractionJudgement | null }>;

/**
 * Whether the stored rows answer the private expectation, by the same comparison a
 * Flow's records answer to. An attempt has no Flow, so "the Flow has no extract node"
 * has no meaning here: it read what it read, and only the rows are compared.
 */
function recordsHold(judgement: FlowExtractionJudgement): boolean {
  try {
    assertFlowExtraction({ ...judgement, extractNodes: Math.max(judgement.extractNodes, judgement.steps.length) });
    return true;
  } catch (error) {
    if (error instanceof RunnerFailure) return false;
    throw error;
  }
}

/**
 * Judges the attempt itself, against the same private oracle the Flow's playback
 * answers to, before any fixture reset:
 *
 * - its stored rows against the task's expected dataset, with no persisted Flow run;
 * - the site's declared facts, which are absolute: an attempt from the seed must make
 *   them true, and one on what an earlier attempt left must keep them true;
 * - the site's recorded change since that baseline against what the task asked, once,
 *   and, with `earlierLeft`, against what is still asked (`judgeLaterChange`), or, on a
 *   person's Run again, against what they asked for done again (`judgeAskedAgain`);
 * - what the person was shown, screened.
 *
 * It never throws for a wrong answer. A fixture defect still throws, since that is
 * no answer about the product.
 */
export async function judgeAttemptAnswer(input: {
  request: CreatedFlowRequest;
  workflow: ResolvedScenarioWorkflow;
  scenarioOrigin: string;
  ending: AttemptEndingFact;
  stage: CreatedFlowAnswerStage;
  /** The build as it settled, when the attempt came through the created-Flow lane. */
  build?: CreatedFlowBuild | undefined;
  baseline: SiteBaseline | null;
  /** On an attempt that began on what an earlier one left with no reseed: how far the site had moved from the first attempt's baseline to this one's. Absent on a first attempt, which this changes nothing for. */
  earlierLeft?: SiteChange | undefined;
  /** A person pressed Run again to start this attempt: its change is judged as asked for again (`judgeAskedAgain`). */
  askedAgain?: boolean;
  judgeFinalState: () => Promise<JudgedFinalState>;
  /** What the Flow's own playback has said so far; a draft has none. */
  flow?: { flowCreated: boolean | null; oracleVerdict: "passed" | "failed" | null };
}): Promise<AttemptAnswerJudgement> {
  const { request, workflow, stage, baseline } = input;
  const { judgement: taskJudgement } = request;
  const source: CreatedFlowDatasetSource | null = await stage.readStoredRows(input.build);
  const stored = source ? source.extracted.reduce((sum, dataset) => sum + dataset.records.length, 0) : 0;
  const extraction = taskJudgement.judgeBy === "expected-dataset" ? judgeCreatedFlowDataset({ workflow, stepId: taskJudgement.stepId, run: source ?? { extracted: [], actions: [], extractionDurationsByNode: new Map() }, actionTypes: new Map(), scenarioOrigin: input.scenarioOrigin }) : null;
  const records: AnswerOracleOutcome = extraction ? (recordsHold(extraction) ? "held" : "failed") : "not_declared";
  const declaresFinalState = taskJudgement.judgeBy === "playback-goal" || (workflow.expected.finalState?.length ?? 0) > 0;
  let finalState: AnswerOracleOutcome = "not_declared";
  if (declaresFinalState) finalState = (await input.judgeFinalState()).held ? "held" : "failed";
  const asked = askedChangeOf(request.task.id);
  const after: LastingView | null = baseline ? await stage.readSiteView() : null;
  const moved = baseline && after ? siteChange(baseline.view, after) : null;
  const earlierLeft = input.earlierLeft;
  const change: SiteChangeJudgement | null = asked && moved ? (input.askedAgain ? judgeAskedAgain(asked, earlierLeft ?? {}, moved) : earlierLeft ? judgeLaterChange(asked, earlierLeft, moved) : judgeSiteChange(asked, moved)) : null;
  const askedNow = asked && earlierLeft ? stillAsked(asked, earlierLeft) : asked;
  const expected = taskJudgement.judgeBy === "expected-dataset" ? workflow.expected.extracted?.find((entry) => entry.step === taskJudgement.stepId) : undefined;
  const shown = judgeShownAnswer({ shown: await stage.chat.readShownAnswer(), expected, askedActs: askedNow?.acts.length ?? 0, secretValues: stage.secretValues, scenarioOrigin: input.scenarioOrigin });
  // A task's result is the rows it asked for, or the act it asked for having landed. A read-only task judged by its goal has its goal.
  const hasResult = taskJudgement.judgeBy === "expected-dataset" ? stored > 0 : (moved !== null && Object.keys(moved).length > 0) || finalState === "held";
  const score = scoreAnswer({
    ending: input.ending, hasResult, records, finalState, change, shown,
    storedRows: extraction ? stored : null,
    flow: flowScoreOf(input.flow ?? { flowCreated: false, oracleVerdict: null }),
    standIns: stage.standIns,
  });
  return Object.freeze({ score, extraction });
}
