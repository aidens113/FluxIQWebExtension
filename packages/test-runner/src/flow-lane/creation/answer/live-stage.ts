import type { FluxIQHttpOptions } from "../../../http-control/index.js";
import { readRunDatasets, runDatasetSummaries, type RunDatasetControl } from "../../run-datasets.js";
import type { CreatedFlowBuild } from "../build-proposal.js";
import type { CreatedFlowChat } from "../chat/index.js";
import { lastingViewOf, readSiteBaseline, readSiteState } from "../site-change/index.js";
import type { CreatedFlowAnswerStage } from "./ports.js";
import type { CreatedFlowDatasetSource } from "../judgement.js";

/**
 * The answer stage of a real run, from what exists today: rows from the run Core last
 * ran for this attempt, the site through the fixture's control, and what the panel
 * shows. Reading the chat as words is the one thing that changes when the Answer lane
 * lands its turn: swap `chat` for a port that reads it (`ChatAnswerPort`).
 *
 * Until Core's attempt record lands, "the run this attempt last ran" is a candidate's
 * last trial, the only run a draft has. A build with none stored nothing readable.
 */
export function liveAnswerStage(input: {
  control: RunDatasetControl;
  projectId: string;
  domainId: string;
  scenarioId: string;
  scenarioOrigin: string;
  runToken: string;
  /** The chat the person reads, when the run has one. */
  chat?: Pick<CreatedFlowChat, "shows"> | undefined;
  secretValues: readonly string[];
  bounds?: FluxIQHttpOptions;
}): CreatedFlowAnswerStage {
  const { scenarioOrigin, runToken, scenarioId } = input;
  return Object.freeze({
    readBaseline: () => readSiteBaseline(scenarioOrigin, runToken, scenarioId),
    readSiteView: async () => lastingViewOf(scenarioId)(await readSiteState(scenarioOrigin, runToken, scenarioId)),
    readStoredRows: async (build: CreatedFlowBuild | undefined): Promise<CreatedFlowDatasetSource | null> => {
      const runId = build?.candidateOutcome?.trialRunId;
      if (!runId) return null;
      const payload = await input.control.automationStudioCall("get-flow-run-detail", { projectId: input.projectId, runId }, input.bounds ?? {}) as { runDetail?: Record<string, unknown> };
      const summaries = runDatasetSummaries(payload.runDetail ?? {});
      const extracted = await readRunDatasets(input.control, { projectId: input.projectId, runId, domainId: input.domainId, summaries }, input.bounds ?? {});
      return { extracted, actions: [], extractionDurationsByNode: new Map() };
    },
    chat: {
      readShownAnswer: async () => {
        if (!input.chat) return null;
        const text = await input.chat.shows();
        return text.trim() === "" ? null : { form: "text" as const, text };
      },
    },
    secretValues: input.secretValues,
    standIns: [],
  });
}
