/**
 * What a demonstration dry run reports about the demonstration's own extract, kept in the run
 * summary. Counts and positions only: the records are page data and stay out of the summary.
 * - `exact`: the recorded extract equals the task's expected dataset, record by record, in order.
 * - `rated-non-accessory`: the extract is every couponed card, rating unread, so a person's
 *   reading of the stars and of what is an accessory is applied first (everything-store).
 */
export type DemonstrationExtractVerdict = Readonly<{
  stepId: string;
  judgement: "exact" | "rated-non-accessory";
  passed: boolean;
  readCount: number;
  keptCount: number;
  expectedCount: number;
  /** One-based positions of the records that differ, and how: `missing`, `unexpected` or `different`. */
  mismatches: ReadonlyArray<Readonly<{ position: number; kind: "missing" | "unexpected" | "different" }>>;
}>;

/** What the dry run publishes: the recording it made, the verdict, and that no model was called. */
export type DemonstrationDryRunSummary = Readonly<{
  demonstrationId: string;
  taskId: string;
  recordingId: string;
  recordingEntryCount: number;
  chipShown: true;
  providerCallCount: 0;
  extract: DemonstrationExtractVerdict;
}>;
