export const DEFAULT_GATEWAY_URL = "ws://127.0.0.1:4777/client";
export const DEFAULT_CORE_API_URL = "http://127.0.0.1:3000";
export const LEGACY_GATEWAY_CORE_API_URL = "http://127.0.0.1:4777";
export const HEARTBEAT_INTERVAL_MS = 20_000;
export const RECONNECT_BASE_DELAY_MS = 1_000;
export const RECONNECT_MAX_DELAY_MS = 30_000;
export const MAX_EVENT_QUEUE_SIZE = 1_000;

export const STORAGE_KEYS = {
  settings: "fluxiq.settings",
  session: "fluxiq.session",
  clientId: "fluxiq.clientId",
  queuedEvents: "fluxiq.queuedEvents",
  // In `chrome.storage.session`, not `local`: forgotten when the browser closes.
  disconnectedByPerson: "fluxiq.disconnectedByPerson"
} as const;

export const RUNTIME_MESSAGES = {
  getStatus: "fluxiq.getStatus",
  connect: "fluxiq.connect",
  disconnect: "fluxiq.disconnect",
  resetSession: "fluxiq.resetSession",
  overlayPlacementRecall: "fluxiq.overlayPlacement.recall",
  overlayPlacementKeep: "fluxiq.overlayPlacement.keep",
  dismissRecordingLock: "fluxiq.dismissRecordingLock",
  getRecordingLog: "fluxiq.getRecordingLog",
  listRecordings: "fluxiq.listRecordings",
  startRecording: "fluxiq.startRecording",
  stopRecording: "fluxiq.stopRecording",
  contentReady: "fluxiq.contentReady",
  contentEvent: "fluxiq.contentEvent",
  executeAction: "fluxiq.executeAction",
  captureSnapshot: "fluxiq.captureSnapshot",
  statusChanged: "fluxiq.statusChanged",
  // The panel's own requests (background/panel/). Each is accepted only from
  // the side panel or the popup (`background/control-page.ts`).
  panelSaveSettings: "fluxiq.panel.saveSettings",
  panelOpenFluxIQ: "fluxiq.panel.openFluxIQ",
  panelConversationRead: "fluxiq.panel.conversationRead",
  panelConversationSend: "fluxiq.panel.conversationSend",
  panelConversationAnswer: "fluxiq.panel.conversationAnswer",
  // The chat's thread list: a person's own name for a thread, and deleting one (`background/panel/thread-change-relay.ts`).
  panelConversationRename: "fluxiq.panel.conversationRename",
  panelConversationDelete: "fluxiq.panel.conversationDelete",
  panelStopRun: "fluxiq.panel.stopRun",
  // Take over / Hand back: pause a run with the page handed to the person, and let it go on.
  panelTakeOverRun: "fluxiq.panel.takeOverRun",
  panelHandBackRun: "fluxiq.panel.handBackRun",
  // "Report Problem": a redacted diagnostic bundle (`background/diagnostics/`).
  panelReportProblem: "fluxiq.panel.reportProblem",
  // Automation panel's relays (`background/automation-relay/`); `AUTOMATION_PANEL_MESSAGES`
  // in `protocol.ts` names the same strings by their short names.
  panelListAutomations: "fluxiq.panel.listAutomations",
  panelRunAutomation: "fluxiq.panel.runAutomation",
  panelRunDetail: "fluxiq.panel.runDetail",
  panelExportDataset: "fluxiq.panel.exportDataset",
  panelTaskOutcomes: "fluxiq.panel.taskOutcomes",
  panelCarryOnTaskAttempt: "fluxiq.panel.carryOnTaskAttempt",
  panelRunTaskAgain: "fluxiq.panel.runTaskAgain",
  panelListTasks: "fluxiq.panel.listTasks",
  panelListFlowSubflows: "fluxiq.panel.listFlowSubflows",
  panelRenameTask: "fluxiq.panel.renameTask",
  panelRemoveTask: "fluxiq.panel.removeTask",
  panelModelReadiness: "fluxiq.panel.modelReadiness",
  panelGenerateFromRecording: "fluxiq.panel.generateFromRecording",
  panelTestGeneratedAutomation: "fluxiq.panel.testGeneratedAutomation",
  panelSaveGeneratedAutomation: "fluxiq.panel.saveGeneratedAutomation",
  panelRemoveRecordingStep: "fluxiq.panel.removeRecordingStep",
  // The project's library of saved parts (`background/automation-relay/parts-relay.ts`).
  panelListParts: "fluxiq.panel.listParts",
  panelGetPart: "fluxiq.panel.getPart",
  panelSavePart: "fluxiq.panel.savePart",
  panelRunPart: "fluxiq.panel.runPart",
  testArmScriptedNavigation: "fluxiq.test.armScriptedNavigation",
  testAwaitScriptedNavigation: "fluxiq.test.awaitScriptedNavigation",
  testCancelScriptedNavigation: "fluxiq.test.cancelScriptedNavigation"
} as const;
