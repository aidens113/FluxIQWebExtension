// The shapes the automations tab reads out of Core's payloads, after
// `read-core.ts` has checked them. Core's own types are not imported: the
// relays pass Core's payload through untouched and the panel trusts none of
// it, so these hold only the fields the panel uses.

/** How a run ended, in the panel's words; anything Core says that is not one of these stays unknown. */
export type RunOutcome = "running" | "completed" | "failed" | "stopped";

/** One of Core's run summaries, reduced to what the panel reads. Unknown fields stay undefined. */
export type RunSummary = {
  runId: string;
  flowId: string;
  /** Core's status word, as sent. */
  status: string;
  startedAt?: number | undefined;
  finishedAt?: number | undefined;
  updatedAt?: number | undefined;
  interventionCount?: number | undefined;
  adaptationCount?: number | undefined;
  /**
   * Whether the run changed what later runs of its automation do, as Core's run
   * list says it. A run started elsewhere (the chat's "run it", a playback
   * through the API) is only ever seen in the list, so this is the only place
   * the row learns it from.
   */
  durableBehaviorChanged?: boolean | undefined;
};

/** One saved automation and its newest run. */
export type AutomationRow = { flowId: string; name: string; lastRun?: RunSummary | undefined };

/** A dataset a run produced. `label` and `recordCount` only when Core named them. */
export type RunDataset = { datasetId: string; label?: string | undefined; recordCount?: number | undefined };

/** What `runAutomation` answered, beyond the run itself. */
export type RunReply = {
  run: RunSummary;
  createdAdaptationIds?: readonly string[] | undefined;
  durableBehaviorChanged?: boolean | undefined;
};

/** What `runDetail` answered: the run's datasets and the status of each adaptation it made. */
export type RunDetail = {
  run?: RunSummary | undefined;
  adaptationIds?: readonly string[] | undefined;
  datasets: readonly RunDataset[];
  /** Status by adaptation id, for the adaptations of the run's flow Core listed. */
  adaptationStatuses: ReadonlyMap<string, string>;
};

/** A dataset export: the file itself, or word that it is too large to send here. */
export type DatasetExport =
  | { tooLarge: false; fileName: string; contentType: string; body: string }
  | { tooLarge: true };

/**
 * What the panel can say about a run. Every field is undefined when Core did
 * not say, never guessed.
 */
export type RunFacts = {
  outcome?: RunOutcome | undefined;
  durationMs?: number | undefined;
  aiUsed?: boolean | undefined;
  /** How many times AI stepped in, when known. */
  aiActivations?: number | undefined;
  /** How many page variations the run learned: its adaptations Core reports applied. */
  learned?: number | undefined;
  /** How many changes the run tried, applied or not (adaptations created). */
  changesTried?: number | undefined;
  /** Whether what it learned passed its check: true, false, or undefined while unknown. */
  validated?: boolean | undefined;
  futureRunsUpdated?: boolean | undefined;
};
