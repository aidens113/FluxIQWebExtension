import { BUILD_IDENTITY_MESSAGE } from "../shared/build-identity";
import { RUNTIME_MESSAGES } from "../shared/constants";
import { browserDescriptor, defaultSettings } from "../shared/browser";
import type { ExtensionStatus, FluxIQSettings, RecordingEventPayload } from "../shared/protocol";
import { FluxIQConnection } from "./connection";
import { describeTab } from "./tabs";
import { clearSession, onSavedStateRepaired, readOrCreateClientId, readQueuedEvents, readSession, readSettings, writeSession, writeSettings } from "./storage";
import { acceptActionEvidencePort } from "./action-evidence";
import { handleScriptedNavigationControl } from "./scripted-navigation-control";
import { clearExtractionTab, handleExtractionControl } from "./extraction";
import { isControlPage } from "./control-page";
import { AutoConnect, handlePanelControl, panelControlDeps, sessionDisconnectMemory, ToolbarIndicator } from "./panel";
import { callCoreProgram } from "./connection/index";
import { readBuildIdentity, handleReportProblem, localProblemLogStore, ProblemLog, ProblemNoticer, type ReportProblemDeps } from "./diagnostics";
import { browserReconnectAlarms, RECONNECT_ALARM_NAME, ReconnectWatchdog } from "./reconnect-watchdog";
import { handleAutomationRelay, type AutomationRelayDeps } from "./automation-relay";

let connection: FluxIQConnection | undefined;
// One connection is built at a time. Without this, two events that wake the
// worker together (start-up and a tab update) each built one, and the first --
// possibly already reconnecting -- was orphaned with its socket.
let connectionBuilding: Promise<FluxIQConnection> | undefined;
const toolbar = new ToolbarIndicator();
const disconnectMemory = sessionDisconnectMemory();
// Reconnects a paired browser when the worker starts (browser start, extension
// reload or update, a worker Chrome stopped and an event restarted) and on
// panel open. It reaches the connection through `getConnection`, so a reset
// session's replacement is the one connected.
const autoConnect = new AutoConnect(async () => {
  await (await getConnection()).connect();
}, disconnectMemory);
// Recent failures, for "Report Problem". The pairing token and code are withheld
// from every entry as it is written (`diagnostics/problem/log.ts`).
const problemLog = new ProblemLog(localProblemLogStore(), () => [connection?.coreApiCredentials().token, connection?.status().pairingReferenceCode]);
const problemNoticer = new ProblemNoticer((input) => problemLog.note(input));
const reconnectWatchdog = new ReconnectWatchdog(browserReconnectAlarms());
onSavedStateRepaired((message) => void problemLog.note({ source: "saved-state", message }));

function getConnection(): Promise<FluxIQConnection> {
  if (connection) return Promise.resolve(connection);
  connectionBuilding ??= buildConnection().finally(() => { connectionBuilding = undefined; });
  return connectionBuilding;
}

async function buildConnection(): Promise<FluxIQConnection> {
  const settings = await readSettings();
  const clientId = await readOrCreateClientId();
  const storedSession = await readSession();
  const session = storedSession ?? { clientId };
  if (session.clientId !== clientId) session.clientId = clientId;
  await writeSession(session);
  const built = new FluxIQConnection(settings, session);
  connection = built;
  let watched: string | undefined;
  built.subscribe((status) => {
    toolbar.update(status);
    problemNoticer.observe(status);
    // Only a change in what the watchdog reads is worth a storage read.
    const key = `${status.connectionState}:${status.paired}:${built.currentSettings().autoReconnect}`;
    if (key !== watched) {
      watched = key;
      void syncReconnectWatchdog(built);
    }
  });
  return built;
}

chrome.runtime.onInstalled.addListener(() => {
  void (async () => {
    const settings = await readSettings();
    await writeSettings({ ...defaultSettings(), ...settings });
    await readOrCreateClientId();
    await enableSidePanelFirst();
  })();
});

chrome.runtime.onStartup.addListener(() => {
  // The reconnect itself is the worker's start-up below: a browser start always
  // starts the worker, and so do an extension reload and a stopped worker woken
  // by any event, none of which `onStartup` sees.
  void enableSidePanelFirst();
});

void enableSidePanelFirst();
void getConnection().then((manager) => reconnectIfPaired(manager)).catch(noteMessageFailure);

// A browser alarm (`reconnect-watchdog.ts`) and the network coming back both
// mean "try now": a live worker retries at once instead of waiting out its
// backoff, and a worker the alarm just started reconnects on start-up above.
// Registered at the top level, as a Manifest V3 worker must for an event to wake it.
(globalThis as { chrome?: { alarms?: typeof chrome.alarms } }).chrome?.alarms?.onAlarm?.addListener((alarm) => {
  if (alarm.name === RECONNECT_ALARM_NAME) wakeConnection();
});
(globalThis as { addEventListener?: (type: string, listener: () => void) => void }).addEventListener?.("online", () => wakeConnection());

function wakeConnection(): void {
  void getConnection()
    .then((manager) => (manager.retryConnection() ? true : reconnectIfPaired(manager)))
    .catch(noteMessageFailure);
}

chrome.runtime.onConnect.addListener((port) => {
  acceptActionEvidencePort(port);
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  void chrome.tabs.get(tabId, (tab) => {
    void getConnection().then((manager) => manager.handleTabUpdated(tab));
  });
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.title || changeInfo.status) {
    void getConnection().then((manager) => manager.handleTabUpdated(tab));
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  clearExtractionTab(tabId);
  void getConnection().then((manager) => manager.handleTabRemoved(tabId));
});

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return;
  // The proposal's selectors were written against the document that just went
  // away, so the pick session goes with it rather than confirming against a
  // page it never saw.
  clearExtractionTab(details.tabId);
  void getConnection().then((manager) => manager.handleNavigationCommitted(details));
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId !== 0) return;
  void getConnection().then((manager) => manager.handleHistoryStateUpdated(details));
});

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  void handleRuntimeMessage(message, sender)
    .then(sendResponse)
    .catch((error: unknown) => {
      noteMessageFailure(error);
      sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unknown extension error." });
    });
  return true;
});

async function handleRuntimeMessage(message: unknown, sender: chrome.runtime.MessageSender): Promise<unknown> {
  const typed = message as { type?: string; [key: string]: unknown };
  if (typed.type === BUILD_IDENTITY_MESSAGE) return readBuildIdentity({ tabId: typed.tabId }, sender);
  const manager = await getConnection();

  const scriptedNavigation = await handleScriptedNavigationControl(typed, sender, manager);
  if (scriptedNavigation.handled) return scriptedNavigation.response;

  const extraction = await handleExtractionControl(typed, sender, manager);
  if (extraction.handled) return extraction.response;

  const report = await handleReportProblem(typed, sender, reportProblemDeps(manager));
  if (report.handled) return report.response;

  const automationRelay = await handleAutomationRelay(typed, sender, automationRelayDeps(manager));
  if (automationRelay.handled) return automationRelay.response;

  const panel = await handlePanelControl(typed, sender, panelControlDeps(manager, () => statusWithQueue(manager)));
  if (panel.handled) return panel.response;

  if (typed.type === RUNTIME_MESSAGES.getStatus) {
    // A panel asking for status is a panel that just opened: the moment a
    // paired browser reconnects by itself. Not awaited, so the panel sees the
    // status now and the connection's progress as it is pushed.
    if (isControlPage(sender)) void reconnectIfPaired(manager);
    return { ok: true, status: await statusWithQueue(manager) };
  }

  if (typed.type === RUNTIME_MESSAGES.connect) {
    await autoConnect.noteConnectedByPerson();
    const settings = { ...(await readSettings()), ...((typed.settings as Partial<FluxIQSettings> | undefined) ?? {}) };
    await writeSettings(settings);
    manager.updateSettings(await readSettings());
    await manager.connect();
    void syncReconnectWatchdog(manager);
    return { ok: true, status: manager.status() };
  }

  if (typed.type === RUNTIME_MESSAGES.disconnect) {
    await autoConnect.noteDisconnectedByPerson();
    manager.disconnect();
    void syncReconnectWatchdog(manager);
    return { ok: true, status: manager.status() };
  }

  if (typed.type === RUNTIME_MESSAGES.resetSession) {
    await autoConnect.noteDisconnectedByPerson();
    manager.disconnect();
    await clearSession();
    connection = undefined;
    const next = await getConnection();
    return { ok: true, status: await statusWithQueue(next) };
  }

  if (typed.type === RUNTIME_MESSAGES.dismissRecordingLock) {
    manager.dismissRecordingBlock();
    return { ok: true, status: manager.status() };
  }

  if (typed.type === RUNTIME_MESSAGES.getRecordingLog) {
    return {
      ok: true,
      log: manager.recordingLogPage(Number(typed.page), Number(typed.pageSize))
    };
  }

  if (typed.type === RUNTIME_MESSAGES.listRecordings) {
    return {
      ok: true,
      recordings: await manager.listCoreRecordings(Number(typed.page), Number(typed.pageSize))
    };
  }

  if (typed.type === RUNTIME_MESSAGES.startRecording) {
    await manager.startRecording();
    return { ok: true, status: manager.status() };
  }

  if (typed.type === RUNTIME_MESSAGES.stopRecording) {
    await manager.stopRecording();
    return { ok: true, status: manager.status() };
  }

  if (typed.type === RUNTIME_MESSAGES.contentReady) {
    const tabId = sender.tab?.id;
    await manager.handleContentReady(typed.payload as RecordingEventPayload, tabId, sender.frameId);
    return { ok: true };
  }

  if (typed.type === "fluxiq.test.setActiveTab") {
    const tabId = typed.tabId;
    if (typeof tabId !== "number" || !Number.isSafeInteger(tabId) || tabId < 0) {
      throw new Error("A valid automation tab ID is required.");
    }
    await manager.selectAutomationTab(tabId);
    return { ok: true, status: manager.status() };
  }

  if (typed.type === RUNTIME_MESSAGES.contentEvent) {
    const tabId = sender.tab?.id;
    await manager.handleRecordingEvent(typed.payload as RecordingEventPayload, tabId, sender.frameId);
    return { ok: true };
  }

  if (typed.type === "fluxiq.describeTab" && sender.tab) {
    return { ok: true, tab: describeTab(sender.tab) };
  }

  return { ok: false, error: "Unknown FluxIQ extension message." };
}

// Never awaited by its callers, so a failure to read the Disconnect memory is
// reported here rather than left as an unhandled rejection in the worker. One
// attempt at a time: start-up, a panel opening and an alarm can all ask at once,
// and two connects in flight would close each other's socket.
let reconnecting: Promise<boolean> | undefined;
function reconnectIfPaired(manager: FluxIQConnection): Promise<boolean> {
  if (reconnecting) return reconnecting;
  const status = manager.status();
  reconnecting = autoConnect.maybeConnect({
    paired: status.paired,
    autoReconnect: manager.currentSettings().autoReconnect,
    connectionState: status.connectionState
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("FluxIQ automatic reconnection was skipped", message);
    void problemLog.note({ source: "reconnect", message: `Automatic reconnection was skipped: ${message}` });
    return false;
  }).finally(() => { reconnecting = undefined; });
  return reconnecting;
}

// The alarm follows the person's Disconnect as well as the connection, so it is
// read from the same session memory `AutoConnect` keeps.
async function syncReconnectWatchdog(manager: FluxIQConnection): Promise<void> {
  const status = manager.status();
  const disconnectedByPerson = await disconnectMemory.read().catch(() => false);
  reconnectWatchdog.sync({
    paired: status.paired,
    autoReconnect: manager.currentSettings().autoReconnect,
    disconnectedByPerson,
    connectionState: status.connectionState
  });
}

function noteMessageFailure(error: unknown): void {
  void problemLog.note({ source: "message", message: error instanceof Error ? error.message : "Unknown extension error." });
}

function automationRelayDeps(manager: FluxIQConnection): AutomationRelayDeps {
  return {
    isControlPage,
    // Credentials are read per call, so a token FluxIQ rotated on reconnect is the one sent.
    call: (endpoint, payload, programId) => callCoreProgram(manager.coreApiCredentials(), endpoint, payload, programId),
    projectId: () => manager.projectId(),
    lastStoppedRecordingId: () => manager.lastStoppedRecordingId(),
    removeRecordedStep: (activityId) => manager.removeRecordedStep(activityId)
  };
}

function reportProblemDeps(manager: FluxIQConnection): ReportProblemDeps {
  return {
    isControlPage,
    status: () => statusWithQueue(manager),
    settings: () => manager.currentSettings(),
    browser: browserDescriptor,
    problems: problemLog,
    // Credentials are read per call, so a token FluxIQ rotated on reconnect is the one sent.
    call: (endpoint, payload) => callCoreProgram(manager.coreApiCredentials(), endpoint, payload),
    projectId: () => manager.projectId(),
    token: () => manager.coreApiCredentials().token,
    now: Date.now
  };
}

async function statusWithQueue(manager: FluxIQConnection): Promise<ExtensionStatus> {
  const status = manager.status();
  status.queueSize = (await readQueuedEvents()).length;
  return status;
}

async function enableSidePanelFirst(): Promise<void> {
  const sidePanel = chrome.sidePanel as typeof chrome.sidePanel | undefined;
  if (!sidePanel?.setPanelBehavior) return;
  await sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
}
