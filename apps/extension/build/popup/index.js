// src/shared/constants.ts
var DEFAULT_GATEWAY_URL = "ws://127.0.0.1:4777/client";
var RUNTIME_MESSAGES = {
  getStatus: "fluxiq.getStatus",
  connect: "fluxiq.connect",
  disconnect: "fluxiq.disconnect",
  resetSession: "fluxiq.resetSession",
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
var gatewayUrl = element("gatewayUrl");
var autoReconnect = element("autoReconnect");
var captureMutations = element("captureMutations");
var captureInputValues = element("captureInputValues");
var captureSnapshots = element("captureSnapshots");
var connectButton = element("connectButton");
var disconnectButton = element("disconnectButton");
var resetSessionButton = element("resetSessionButton");
var recordButton = element("recordButton");
var stopButton = element("stopButton");
var settingsButton = element("settingsButton");
var closeSettingsButton = element("closeSettingsButton");
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
var unsupportedCard = element("unsupportedCard");
var unsupportedReason = element("unsupportedReason");
var activityFeed = element("activityFeed");
var emptyActivity = element("emptyActivity");
var lastActivity = element("lastActivity");
var settingsDrawer = element("settingsDrawer");
var pairingOverlay = element("pairingOverlay");
var pairingReferenceCode = element("pairingReferenceCode");
var overlayCancelButton = element("overlayCancelButton");
var currentStatus;
var timerHandle;
void refresh();
startTimerLoop();
settingsButton.addEventListener("click", () => {
  settingsDrawer.hidden = false;
});
closeSettingsButton.addEventListener("click", () => {
  settingsDrawer.hidden = true;
});
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
    void sendCommand(RUNTIME_MESSAGES.startRecording);
  }
});
stopButton.addEventListener("click", () => {
  void sendCommand(RUNTIME_MESSAGES.stopRecording);
});
overlayCancelButton.addEventListener("click", () => {
  void sendCommand(RUNTIME_MESSAGES.disconnect);
});
chrome.runtime.onMessage.addListener((message) => {
  const typed = message;
  if (typed.type === RUNTIME_MESSAGES.statusChanged && typed.status) renderStatus(typed.status);
});
async function refresh() {
  const response = await runtimeSendMessage({ type: RUNTIME_MESSAGES.getStatus });
  if (response.ok) renderStatus(response.status);
  else renderError(response.error);
}
async function sendCommand(type, payload = {}) {
  setBusy(true);
  try {
    const response = await runtimeSendMessage({ type, ...payload });
    if (response.ok) renderStatus(response.status);
    else renderError(response.error);
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
  recordLabel.textContent = recording ? "Recording" : "Record";
  recordButton.disabled = !connected || unsupported;
  stopButton.disabled = !recording;
  connectButton.disabled = status.connectionState === "connected" || status.connectionState === "connecting";
  disconnectButton.disabled = status.connectionState === "disconnected";
  unsupportedCard.hidden = !status.unsupportedPage;
  unsupportedReason.textContent = status.unsupportedPage?.reason ?? "";
  renderActivities(status.recentActivities);
  renderPairingOverlay(status);
  renderError(status.lastError);
  renderTimer();
}
function renderActivities(activities) {
  activityFeed.replaceChildren();
  emptyActivity.hidden = activities.length > 0;
  for (const activity of activities) {
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
}
function readSettingsFromForm() {
  return {
    gatewayUrl: gatewayUrl.value.trim() || defaultSettings().gatewayUrl,
    autoReconnect: autoReconnect.checked,
    captureMutations: captureMutations.checked,
    captureInputValues: captureInputValues.checked,
    captureSnapshots: captureSnapshots.checked
  };
}
function setBusy(busy) {
  for (const button of [connectButton, disconnectButton, resetSessionButton, overlayCancelButton, recordButton, stopButton]) button.disabled = busy;
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
function relativeTime(timestamp) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1e3));
  if (seconds < 5) return "Now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}
function element(id) {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing popup element: ${id}`);
  return found;
}
//# sourceMappingURL=index.js.map
