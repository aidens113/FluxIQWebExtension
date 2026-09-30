// The person's automations: the tab that lists them, and the strip that shows
// the one open in the chat. `automations-tab.ts` and `automation-strip.ts`
// draw; `controller.ts` holds what is on screen; the rest are pure readers and copy.
export { createAutomationStrip, type AutomationStrip } from "./automation-strip";
export { createAutomationsTab, type AutomationsTab, type AutomationsTabHooks } from "./automations-tab";
export { chooseAutomation, type ChooseAutomationDeps } from "./choose-automation";
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
export { runFacts, type RunFactsInput } from "./facts";
export { readCore } from "./read-core";
export { readRunReplies } from "./replies";
export { automationRowElement } from "./row-element";
export { automationRows } from "./rows";
export { runSummaryLines } from "./summary-copy";
export type { AutomationRow, DatasetExport, RunDataset, RunDetail, RunFacts, RunOutcome, RunReply, RunSummary } from "./types";
