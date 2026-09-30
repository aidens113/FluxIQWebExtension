// SEAM (t181 -> background relay, t182; Core allow-list, supervisor).
//
// The panel messages Simple Mode sends for what it cannot read today: saved
// automations and their runs, running one, a run's facts, a dataset's export,
// whether an AI model key is set, and turning a finished recording into an
// automation. None of them is handled by `background/panel/` yet, so each one
// is answered "Unknown FluxIQ extension message." and reaches the view as a
// PanelResult with `unsupported: true`; every card that sends one shows its
// "Open FluxIQ" fallback instead of an error (the pattern `run-stop.ts` set).
//
// The names live here, not in `shared/constants.ts` (`RUNTIME_MESSAGES`),
// because this lane does not own the shared protocol. When the relays land they
// move there under the same spelling and this file becomes a re-export; the
// spelling below is the contract, and so are the request fields and the Core
// payload each relay passes through untouched (it adds nothing, keeps nothing,
// like `conversation-relay.ts`). A relay also needs its Core endpoint on Core's
// paired-client allow-list (`apps/web/src/lib/program-route.ts`,
// `PAIRED_CLIENT_ENDPOINTS`), which today holds only the conversation endpoints,
// `list-runtime-sessions` and `cancel-runtime-session`. The full list is in
// docs/working/manual-panel-test-findings/reports/t181-simple-mode-ux.md.
//
// A `projectId` left out means the project this browser's session belongs to,
// as for every other panel relay.

export const SIMPLE_RELAY_MESSAGES = {
  /**
   * `list-flow-summaries` then `list-flow-runs` (sort `updated`, direction
   * `desc`, `limit`). Answers `{ payload: { flows, runs } }`: Core's
   * `AutomationStudioFlowSummary[]` and `AutomationStudioFlowRunSummary[]`. The
   * panel joins each flow to its newest run.
   */
  listAutomations: "fluxiq.panel.listAutomations",
  /**
   * `run-runtime-session` with `{ projectId, flowId }` and no LLM run intent
   * (a paired token cannot carry one). Answers Core's payload: `runSummary`,
   * `interventionCount`, `createdAdaptationIds`, `durableBehaviorChanged`,
   * `terminalReason`.
   */
  runAutomation: "fluxiq.panel.runAutomation",
  /**
   * `get-flow-run-detail` (`compact: true`) for `{ runId }`, then `list-flow-adaptations` for the
   * run's flow. Answers `{ payload: { runDetail, adaptations } }`.
   */
  runDetail: "fluxiq.panel.runDetail",
  /** `export-run-dataset` with `{ runId, datasetId, format }`. Answers `{ payload: { export } }`. */
  exportDataset: "fluxiq.panel.exportDataset",
  /**
   * `secret-keys/snapshot`. Answers `{ payload: { keys } }`, each key's `kind`,
   * `provider` and `enabled` only; no secret value ever crosses.
   */
  modelReadiness: "fluxiq.panel.modelReadiness",
  /**
   * `generate-recording-proposal` for the recording this browser finished last
   * (the background knows its id; the status does not carry it). Answers
   * `{ payload: { result } }` with the proposal and its Flow for the preview.
   */
  generateFromRecording: "fluxiq.panel.generateFromRecording",
  /**
   * `run-runtime-session` for the proposal's Flow, as a test. Sends the
   * `proposalId` and/or `flowId` the generate reply named (either may be
   * absent; the relay then uses the proposal it generated last). Answers as
   * `runAutomation` does.
   */
  testGeneratedAutomation: "fluxiq.panel.testGeneratedAutomation",
  /**
   * `review-recording-flow-proposal` with `decision: "approve"`, for the same
   * `proposalId` / `flowId` fields as the test. Answers `{ payload: { flow } }`.
   */
  saveGeneratedAutomation: "fluxiq.panel.saveGeneratedAutomation",
  /**
   * Removes one step from the recording in progress, sent as `{ entryId }`: the `ActivityEntry.id`
   * the recording log gave it: from the background's queue when it has not
   * been sent, and from Core's recording when it has. Core has no endpoint for
   * the second half yet (only append, note and marker).
   */
  removeRecordingStep: "fluxiq.panel.removeRecordingStep"
} as const;
