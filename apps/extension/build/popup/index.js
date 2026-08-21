// src/shared/constants.ts
var DEFAULT_GATEWAY_URL = "ws://127.0.0.1:4777/client";
var DEFAULT_CORE_API_URL = "http://127.0.0.1:3000";
var RUNTIME_MESSAGES = {
  getStatus: "fluxiq.getStatus",
  connect: "fluxiq.connect",
  disconnect: "fluxiq.disconnect",
  resetSession: "fluxiq.resetSession",
  dismissRecordingLock: "fluxiq.dismissRecordingLock",
  getRecordingLog: "fluxiq.getRecordingLog",
  listRecordings: "fluxiq.listRecordings",
  startRecording: "fluxiq.startRecording",
  stopRecording: "fluxiq.stopRecording",
  contentReady: "fluxiq.contentReady",
  contentEvent: "fluxiq.contentEvent",
  executeAction: "fluxiq.executeAction",
  captureSnapshot: "fluxiq.captureSnapshot",
  statusChanged: "fluxiq.statusChanged"
};

// src/shared/browser.ts
function defaultSettings() {
  return {
    gatewayUrl: DEFAULT_GATEWAY_URL,
    coreApiUrl: DEFAULT_CORE_API_URL,
    autoReconnect: true,
    captureMutations: true,
    captureInputValues: true,
    captureSnapshots: true
  };
}
function runtimeSendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(response);
    });
  });
}

// src/popup/index.ts
var eventPageSize = 25;
var recordingsPageSize = 10;
var shell = element("shell");
var gatewayUrl = element("gatewayUrl");
var coreApiUrl = element("coreApiUrl");
var autoReconnect = element("autoReconnect");
var captureMutations = element("captureMutations");
var captureInputValues = element("captureInputValues");
var captureSnapshots = element("captureSnapshots");
var connectButton = element("connectButton");
var disconnectButton = element("disconnectButton");
var resetSessionButton = element("resetSessionButton");
var recordButton = element("recordButton");
var settingsButton = element("settingsButton");
var closeSettingsButton = element("closeSettingsButton");
var recorderTab = element("recorderTab");
var eventsTab = element("eventsTab");
var recordingsTab = element("recordingsTab");
var recorderView = element("recorderView");
var eventsView = element("eventsView");
var recordingsView = element("recordingsView");
var connectionLabel = element("connectionLabel");
var activeDomain = element("activeDomain");
var statusDot = element("statusDot");
var clientId = element("clientId");
var sessionId = element("sessionId");
var activeTab = element("activeTab");
var queueSize = element("queueSize");
var eventCount = element("eventCount");
var recordingTimer = element("recordingTimer");
var recordLabel = element("recordLabel");
var errorText = element("errorText");
var runtimeCard = element("runtimeCard");
var runtimeStateDot = element("runtimeStateDot");
var runtimeState = element("runtimeState");
var runtimeCommand = element("runtimeCommand");
var runtimeTarget = element("runtimeTarget");
var runtimeTab = element("runtimeTab");
var runtimeMessage = element("runtimeMessage");
var unsupportedCard = element("unsupportedCard");
var unsupportedReason = element("unsupportedReason");
var activityFeed = element("activityFeed");
var emptyActivity = element("emptyActivity");
var lastActivity = element("lastActivity");
var eventPageLabel = element("eventPageLabel");
var prevEventsButton = element("prevEventsButton");
var nextEventsButton = element("nextEventsButton");
var recordingsList = element("recordingsList");
var emptyRecordings = element("emptyRecordings");
var recordingsSource = element("recordingsSource");
var recordingsPageLabel = element("recordingsPageLabel");
var refreshRecordingsButton = element("refreshRecordingsButton");
var prevRecordingsButton = element("prevRecordingsButton");
var nextRecordingsButton = element("nextRecordingsButton");
var settingsDrawer = element("settingsDrawer");
var settingsBackdrop = element("settingsBackdrop");
var pairingOverlay = element("pairingOverlay");
var pairingReferenceCode = element("pairingReferenceCode");
var overlayCancelButton = element("overlayCancelButton");
var recordingLockOverlay = element("recordingLockOverlay");
var recordingLockMessage = element("recordingLockMessage");
var recordingLockDismissButton = element("recordingLockDismissButton");
var currentStatus;
var currentView = "recorder";
var eventPage = 1;
var eventTotal = 0;
var recordingsPage = 1;
var recordingsTotal;
var timerHandle;
void refresh();
startTimerLoop();
applyLayoutMode();
settingsButton.addEventListener("click", () => {
  setSettingsOpen(true);
});
closeSettingsButton.addEventListener("click", () => {
  setSettingsOpen(false);
});
settingsBackdrop.addEventListener("click", () => setSettingsOpen(false));
connectButton.addEventListener("click", () => {
  void sendCommand(RUNTIME_MESSAGES.connect, { settings: readSettingsFromForm() });
});
disconnectButton.addEventListener("click", () => {
  void sendCommand(RUNTIME_MESSAGES.disconnect);
});
resetSessionButton.addEventListener("click", () => {
  void sendCommand(RUNTIME_MESSAGES.resetSession);
});
recordButton.addEventListener("click", () => {
  if (currentStatus?.recordingState === "recording") {
    void sendCommand(RUNTIME_MESSAGES.stopRecording);
  } else {
    eventPage = 1;
    void sendCommand(RUNTIME_MESSAGES.startRecording);
  }
});
overlayCancelButton.addEventListener("click", () => {
  void sendCommand(RUNTIME_MESSAGES.disconnect);
});
recordingLockDismissButton.addEventListener("click", () => {
  void sendCommand(RUNTIME_MESSAGES.dismissRecordingLock);
});
recorderTab.addEventListener("click", () => switchView("recorder"));
eventsTab.addEventListener("click", () => switchView("events"));
recordingsTab.addEventListener("click", () => switchView("recordings"));
for (const tab of [recorderTab, eventsTab, recordingsTab]) {
  tab.addEventListener("keydown", (event) => handleTabKeydown(event));
}
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !settingsDrawer.hidden) setSettingsOpen(false);
});
prevEventsButton.addEventListener("click", () => {
  if (eventPage <= 1) return;
  eventPage -= 1;
  void refreshEventLog();
});
nextEventsButton.addEventListener("click", () => {
  if (eventPage * eventPageSize >= eventTotal) return;
  eventPage += 1;
  void refreshEventLog();
});
refreshRecordingsButton.addEventListener("click", () => {
  void refreshRecordings();
});
prevRecordingsButton.addEventListener("click", () => {
  if (recordingsPage <= 1) return;
  recordingsPage -= 1;
  void refreshRecordings();
});
nextRecordingsButton.addEventListener("click", () => {
  if (recordingsTotal !== void 0 && recordingsPage * recordingsPageSize >= recordingsTotal) return;
  recordingsPage += 1;
  void refreshRecordings();
});
chrome.runtime.onMessage.addListener((message) => {
  const typed = message;
  if (typed.type === RUNTIME_MESSAGES.statusChanged && typed.status) {
    const previousStartedAt = currentStatus?.recordingStartedAt;
    renderStatus(typed.status);
    if (typed.status.recordingStartedAt !== previousStartedAt) eventPage = 1;
    if (currentView === "events") void refreshEventLog();
  }
});
async function refresh() {
  const response = await runtimeSendMessage({ type: RUNTIME_MESSAGES.getStatus });
  if (response.ok) {
    renderStatus(response.status);
    await refreshEventLog();
  } else {
    renderError(response.error);
  }
}
async function sendCommand(type, payload = {}) {
  setBusy(true);
  try {
    const response = await runtimeSendMessage({ type, ...payload });
    if (response.ok) {
      renderStatus(response.status);
      await refreshEventLog();
    } else {
      renderError(response.error);
    }
  } catch (error) {
    renderError(error instanceof Error ? error.message : "Command failed.");
  } finally {
    setBusy(false);
    if (currentStatus) renderStatus(currentStatus);
  }
}
function renderStatus(status) {
  currentStatus = status;
  const defaults = defaultSettings();
  const settings = { ...defaults, ...status.settings };
  gatewayUrl.value = settings.gatewayUrl || status.gatewayUrl || defaults.gatewayUrl;
  coreApiUrl.value = settings.coreApiUrl || defaults.coreApiUrl;
  autoReconnect.checked = settings.autoReconnect;
  captureMutations.checked = settings.captureMutations;
  captureInputValues.checked = settings.captureInputValues;
  captureSnapshots.checked = settings.captureSnapshots;
  clientId.textContent = status.clientId;
  sessionId.textContent = status.sessionId ?? "-";
  activeTab.textContent = status.activeTabUrl ?? (status.activeTabId === void 0 ? "-" : String(status.activeTabId));
  activeDomain.textContent = domainLabel(status.activeTabUrl);
  queueSize.textContent = String(status.queueSize);
  eventCount.textContent = String(status.eventCount);
  connectionLabel.textContent = status.connectionState.replace("_", " ");
  lastActivity.textContent = status.lastActivityAt ? relativeTime(status.lastActivityAt) : "Idle";
  statusDot.className = "dot";
  if (status.recordingState === "recording") statusDot.classList.add("recording");
  else if (status.connectionState === "connected") statusDot.classList.add("connected");
  else if (["connecting", "reconnecting", "pairing"].includes(status.connectionState)) statusDot.classList.add("connecting");
  const connected = status.connectionState === "connected";
  const recording = status.recordingState === "recording";
  const unsupported = Boolean(status.unsupportedPage);
  recordButton.classList.toggle("active", recording);
  recordLabel.textContent = recording ? "Stop recording" : "Start recording";
  recordButton.setAttribute("aria-label", recording ? "Stop recording" : "Start recording");
  recordButton.disabled = !connected || unsupported;
  connectButton.disabled = status.connectionState === "connected" || status.connectionState === "connecting";
  disconnectButton.disabled = status.connectionState === "disconnected";
  unsupportedCard.hidden = !status.unsupportedPage;
  unsupportedReason.textContent = status.unsupportedPage?.reason ?? "";
  renderPairingOverlay(status);
  renderRecordingLockOverlay(status);
  renderRuntime(status);
  renderError(status.lastError);
  renderTimer();
}
function renderRuntime(status) {
  const runtime = status.runtime;
  const state = runtime?.state ?? "idle";
  runtimeCard.classList.toggle("running", state === "running");
  runtimeCard.classList.toggle("succeeded", state === "succeeded");
  runtimeCard.classList.toggle("failed", state === "failed");
  runtimeStateDot.className = `runtime-state-dot ${state}`;
  runtimeState.textContent = state === "idle" ? "Runtime idle" : state === "running" ? "Runtime running" : state === "succeeded" ? "Runtime succeeded" : "Runtime failed";
  runtimeCommand.textContent = runtime?.label ?? runtime?.actionType ?? "No command running";
  runtimeTarget.textContent = runtime?.target ?? runtime?.url ?? "-";
  runtimeTab.textContent = runtime?.tabId === void 0 ? "-" : `Tab ${runtime.tabId}`;
  runtimeMessage.textContent = runtime?.error ?? runtime?.message ?? (runtime?.startedAt ? relativeTime(runtime.startedAt) : "-");
}
async function refreshEventLog() {
  const response = await runtimeSendMessage({
    type: RUNTIME_MESSAGES.getRecordingLog,
    page: eventPage,
    pageSize: eventPageSize
  });
  if (!response.ok) {
    renderError(response.error);
    return;
  }
  renderActivities(response.log);
}
async function refreshRecordings() {
  recordingsSource.textContent = "Loading...";
  refreshRecordingsButton.disabled = true;
  try {
    const response = await runtimeSendMessage({
      type: RUNTIME_MESSAGES.listRecordings,
      page: recordingsPage,
      pageSize: recordingsPageSize
    });
    if (response.ok) {
      renderRecordings(response.recordings);
    } else {
      renderRecordingsError(response.error);
    }
  } catch (error) {
    renderRecordingsError(error instanceof Error ? error.message : "Could not load recordings.");
  } finally {
    refreshRecordingsButton.disabled = false;
  }
}
function renderActivities(log) {
  eventTotal = log.total;
  eventPage = log.page;
  activityFeed.replaceChildren();
  emptyActivity.hidden = log.items.length > 0;
  for (const activity of log.items) {
    const item = document.createElement("li");
    if (activity.tone) item.classList.add(activity.tone);
    const title = document.createElement("div");
    title.className = "activity-title";
    const label = document.createElement("span");
    label.textContent = activity.label;
    const time = document.createElement("span");
    time.textContent = relativeTime(activity.timestamp);
    title.append(label, time);
    item.append(title);
    if (activity.detail) {
      const detail = document.createElement("div");
      detail.className = "activity-detail";
      detail.textContent = activity.detail;
      item.append(detail);
    }
    activityFeed.append(item);
  }
  const totalPages = Math.max(1, Math.ceil(log.total / log.pageSize));
  eventPageLabel.textContent = `Page ${log.page} of ${totalPages}`;
  prevEventsButton.disabled = log.page <= 1;
  nextEventsButton.disabled = log.page >= totalPages;
}
function renderRecordings(page) {
  recordingsTotal = page.total;
  recordingsPage = page.page;
  recordingsSource.textContent = sourceHost(page.sourceUrl);
  recordingsList.replaceChildren();
  emptyRecordings.hidden = page.items.length > 0;
  for (const recording of page.items) recordingsList.append(recordingItem(recording));
  const totalPages = page.total === void 0 ? void 0 : Math.max(1, Math.ceil(page.total / page.pageSize));
  recordingsPageLabel.textContent = totalPages ? `Page ${page.page} of ${totalPages}` : `Page ${page.page}`;
  prevRecordingsButton.disabled = page.page <= 1;
  nextRecordingsButton.disabled = totalPages ? page.page >= totalPages : page.items.length < page.pageSize;
}
function renderRecordingsError(message) {
  recordingsTotal = 0;
  recordingsList.replaceChildren();
  emptyRecordings.hidden = false;
  emptyRecordings.textContent = message;
  recordingsSource.textContent = "Unavailable";
  recordingsPageLabel.textContent = `Page ${recordingsPage}`;
  prevRecordingsButton.disabled = recordingsPage <= 1;
  nextRecordingsButton.disabled = true;
}
function recordingItem(recording) {
  const item = document.createElement("li");
  const title = document.createElement("div");
  title.className = "recording-row-title";
  const name = document.createElement("span");
  name.textContent = recording.title;
  const status = document.createElement("span");
  status.className = "status-pill";
  status.textContent = recording.status ?? "saved";
  title.append(name, status);
  item.append(title);
  const meta = document.createElement("div");
  meta.className = "recording-meta";
  const count = recording.eventCount === void 0 ? "events unknown" : `${recording.eventCount} events`;
  const date = recording.startedAt ? relativeDate(recording.startedAt) : recording.updatedAt ? relativeDate(recording.updatedAt) : recording.id;
  meta.textContent = `${count} - ${date}`;
  item.append(meta);
  return item;
}
function switchView(view) {
  currentView = view;
  applyLayoutMode();
  if (view === "events") void refreshEventLog();
  if (view === "recordings") void refreshRecordings();
}
function applyLayoutMode() {
  recorderView.hidden = currentView !== "recorder";
  eventsView.hidden = currentView !== "events";
  recordingsView.hidden = currentView !== "recordings";
  for (const button of [recorderTab, eventsTab, recordingsTab]) {
    const selected = button.dataset.view === currentView;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  }
}
function handleTabKeydown(event) {
  const tabs = [recorderTab, eventsTab, recordingsTab];
  const currentIndex = tabs.indexOf(event.currentTarget);
  const nextIndex = event.key === "ArrowRight" ? (currentIndex + 1) % tabs.length : event.key === "ArrowLeft" ? (currentIndex - 1 + tabs.length) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : void 0;
  if (nextIndex === void 0) return;
  event.preventDefault();
  const nextTab = tabs[nextIndex];
  nextTab.focus();
  switchView(nextTab.dataset.view);
}
function setSettingsOpen(open) {
  settingsDrawer.hidden = !open;
  settingsBackdrop.hidden = !open;
  if (open) closeSettingsButton.focus();
  else settingsButton.focus();
}
function readSettingsFromForm() {
  return {
    gatewayUrl: gatewayUrl.value.trim() || defaultSettings().gatewayUrl,
    coreApiUrl: coreApiUrl.value.trim() || defaultSettings().coreApiUrl,
    autoReconnect: autoReconnect.checked,
    captureMutations: captureMutations.checked,
    captureInputValues: captureInputValues.checked,
    captureSnapshots: captureSnapshots.checked
  };
}
function setBusy(busy) {
  for (const button of [connectButton, disconnectButton, resetSessionButton, overlayCancelButton, recordButton]) button.disabled = busy;
}
function renderError(message) {
  errorText.hidden = !message;
  errorText.textContent = message ?? "";
}
function renderPairingOverlay(status) {
  const shouldShow = status.connectionState === "pairing";
  pairingOverlay.hidden = !shouldShow;
  if (!shouldShow) return;
  pairingReferenceCode.textContent = status.pairingReferenceCode ?? "------";
}
function renderRecordingLockOverlay(status) {
  const block = status.recordingBlock;
  recordingLockOverlay.hidden = !block;
  recordingLockMessage.textContent = block?.message ?? "";
}
function startTimerLoop() {
  timerHandle = setInterval(renderTimer, 1e3);
  window.addEventListener("unload", () => {
    if (timerHandle) clearInterval(timerHandle);
  });
}
function renderTimer() {
  const startedAt = currentStatus?.recordingStartedAt;
  if (!startedAt || currentStatus?.recordingState !== "recording") {
    recordingTimer.textContent = "00:00";
    return;
  }
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1e3));
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  recordingTimer.textContent = `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}
function domainLabel(url) {
  if (!url) return "No active page";
  try {
    const parsed = new URL(url);
    return parsed.hostname || parsed.protocol.replace(":", "");
  } catch {
    return url;
  }
}
function sourceHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return "FluxIQ Core";
  }
}
function relativeTime(timestamp) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1e3));
  if (seconds < 5) return "Now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}
function relativeDate(timestamp) {
  const date = new Date(timestamp);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}
function element(id) {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing popup element: ${id}`);
  return found;
}
//# sourceMappingURL=index.js.map
