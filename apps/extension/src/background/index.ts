import { RUNTIME_MESSAGES } from "../shared/constants";
import { defaultSettings } from "../shared/browser";
import type { ExtensionStatus, FluxIQSettings, RecordingEventPayload } from "../shared/protocol";
import { FluxIQConnection } from "./connection";
import { describeTab } from "./tabs";
import { clearSession, readOrCreateClientId, readQueuedEvents, readSession, readSettings, writeSession, writeSettings } from "./storage";

let connection: FluxIQConnection | undefined;

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
  connection.subscribe(() => undefined);
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
  void getConnection();
});

void enableSidePanelFirst();

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

  if (typed.type === RUNTIME_MESSAGES.getStatus) {
    return { ok: true, status: await statusWithQueue(manager) };
  }

  if (typed.type === RUNTIME_MESSAGES.connect) {
    const settings = { ...(await readSettings()), ...((typed.settings as Partial<FluxIQSettings> | undefined) ?? {}) };
    await writeSettings(settings);
    manager.updateSettings(await readSettings());
    await manager.connect();
    return { ok: true, status: manager.status() };
  }

  if (typed.type === RUNTIME_MESSAGES.disconnect) {
    manager.disconnect();
    return { ok: true, status: manager.status() };
  }

  if (typed.type === RUNTIME_MESSAGES.resetSession) {
    manager.disconnect();
    await clearSession();
    connection = undefined;
    const next = await getConnection();
    return { ok: true, status: await statusWithQueue(next) };
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
    await manager.handleRecordingEvent(typed.payload as RecordingEventPayload, tabId, sender.frameId);
    return { ok: true };
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
