// Settings, opened by the gear in place of the chat: the connection, the
// on-page status, Report a problem, and Forget this pairing.
export { CONNECTION_DRAFT_KEY, parseConnectionDraft } from "./draft-store";
export { SETTING_FIELDS, type AddressKey, type SettingField, type ToggleKey } from "./form-fields";
export { PROBLEM_REPORT_COPIED, PROBLEM_REPORT_SAVE_ONLY, problemReportOutcome, type ProblemReportOutcome } from "./problem-report-plan";
export { savePlan, type SavePlan } from "./save-plan";
export { createSettingsView, type SettingsView } from "./settings-view";
