// The recent-automations card: saved automations, Run, per-run summary and
// dataset export. `card.ts` draws; `controller.ts`
// holds what is on screen; the rest are pure readers and copy.
export { automationRowElement, type AutomationRowActions } from "./row-element";
export { automationRows } from "./rows";
export type { AutomationRow, DatasetExport, RunDataset, RunDetail, RunFacts, RunOutcome, RunReply, RunSummary } from "./types";
export { createAutomationsCard, type AutomationsCard } from "./card";
export {
  createAutomationsController,
  type AutomationRowNotice,
  type AutomationRowView,
  type AutomationsController,
  type AutomationsMode,
  type AutomationsState,
  type ExportFormat,
  type SaveFile
} from "./controller";
export { downloadFile } from "./download-file";
export { readCore } from "./read-core";
export { runFacts, type RunFactsInput } from "./facts";
export { readRunReplies } from "./replies";
export { runSummaryLines } from "./summary-copy";
