// Settings, opened by the gear in place of the chat: the connection and its approval, the
// project, the model key, the on-page status and Report a problem; the addresses, switches and
// Forget this pairing sit under Advanced.
export { ADVANCED_KEY, ADVANCED_STARTS_OPEN, createAdvancedSection, type AdvancedSection } from "./advanced-section";
export { approvalLine } from "./approval-line";
export { BROWSER_SESSION_PAIRING_LINE, durabilityLine } from "./durability-line";
export { modelKeyLine } from "./model-key-line";
export { projectLine } from "./project-line";
export { CONNECTION_DRAFT_KEY, parseConnectionDraft } from "./draft-store";
export { SETTING_FIELDS, type AddressKey, type SettingField, type ToggleKey } from "./form-fields";
export { PROBLEM_REPORT_COPIED, PROBLEM_REPORT_SAVE_ONLY, problemReportOutcome, type ProblemReportOutcome } from "./problem-report-plan";
export { savePlan, type SavePlan } from "./save-plan";
export { createAppearanceSection } from "./appearance-section";
export { createSettingsView, type SettingsView, type SettingsViewOptions } from "./settings-view";
export { toggleView, type ToggleView } from "./toggle-view";
