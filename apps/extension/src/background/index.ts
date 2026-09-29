import { RUNTIME_MESSAGES } from "../shared/constants";
import { defaultSettings } from "../shared/browser";
import type { ExtensionStatus, FluxIQSettings, RecordingEventPayload } from "../shared/protocol";
import { FluxIQConnection } from "./connection";
import { describeTab } from "./tabs";
import { clearSession, readOrCreateClientId, readQueuedEvents, readSession, readSettings, writeSession, writeSettings } from "./storage";
import { acceptActionEvidencePort } from "./action-evidence";
import { handleScriptedNavigationControl } from "./scripted-navigation-control";
import { clearExtractionTab, handleExtractionControl } from "./extraction";
import { isControlPage } from "./control-page";
import { AutoConnect, handlePanelControl, panelControlDeps, sessionDisconnectMemory, ToolbarIndicator } from "./panel";

let connection: FluxIQConnection | undefined;
const toolbar = new ToolbarIndicator();
// Reconnects a paired browser on browser start and panel open. It reaches the
// connection through `getConnection`, so a reset session's replacement is the
// one connected.
const autoConnect = new AutoConnect(async () => {
  await (await getConnection()).connect();
}, sessionDisconnectMemory());

async function getConnection(): Promise<FluxIQConnection> {
  if (connection) return connection;
  const settings = await readSettings();
  const clientId = await readOrCreateClientId();
  const storedSession = await readSession();
  const session = storedSession ?? { clientId };
  if (session.clientId !== clientId) session.clientId = clientId;
  await writeSession(session);
  connection = new FluxIQConnection(settings, session);
  const queued = await readQueuedEvents();
  connection.subscribe((status) => toolbar.update(status));
  if (queued.length) {
    // Queue size is recomputed on the first status request after startup.
  }
  return connection;
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
  void enableSidePanelFirst();
  void getConnection().then((manager) => reconnectIfPaired(manager));
});

void enableSidePanelFirst();

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
      sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unknown extension error." });
    });
  return true;
});

async function handleRuntimeMessage(message: unknown, sender: chrome.runtime.MessageSender): Promise<unknown> {
  const manager = await getConnection();
  const typed = message as { type?: string; [key: string]: unknown };

  const scriptedNavigation = await handleScriptedNavigationControl(typed, sender, manager);
  if (scriptedNavigation.handled) return scriptedNavigation.response;

  const extraction = await handleExtractionControl(typed, sender, manager);
  if (extraction.handled) return extraction.response;

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
    return { ok: true, status: manager.status() };
  }

  if (typed.type === RUNTIME_MESSAGES.disconnect) {
    await autoConnect.noteDisconnectedByPerson();
    manager.disconnect();
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
// reported here rather than left as an unhandled rejection in the worker.
function reconnectIfPaired(manager: FluxIQConnection): Promise<boolean> {
  const status = manager.status();
  return autoConnect.maybeConnect({
    paired: status.paired,
    autoReconnect: manager.currentSettings().autoReconnect,
    connectionState: status.connectionState
  }).catch((error: unknown) => {
    console.warn("FluxIQ automatic reconnection was skipped", error instanceof Error ? error.message : error);
    return false;
  });
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
