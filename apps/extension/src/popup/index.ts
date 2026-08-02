import { RUNTIME_MESSAGES } from "../shared/constants";
import { defaultSettings, runtimeSendMessage } from "../shared/browser";
import type { ActivityEntry, ExtensionStatus, FluxIQSettings } from "../shared/protocol";

type RuntimeResponse<T> = ({ ok: true } & T) | { ok: false; error: string };

const gatewayUrl = element<HTMLInputElement>("gatewayUrl");
const autoReconnect = element<HTMLInputElement>("autoReconnect");
const captureMutations = element<HTMLInputElement>("captureMutations");
const captureInputValues = element<HTMLInputElement>("captureInputValues");
const captureSnapshots = element<HTMLInputElement>("captureSnapshots");
const connectButton = element<HTMLButtonElement>("connectButton");
const disconnectButton = element<HTMLButtonElement>("disconnectButton");
const resetSessionButton = element<HTMLButtonElement>("resetSessionButton");
const recordButton = element<HTMLButtonElement>("recordButton");
const stopButton = element<HTMLButtonElement>("stopButton");
const settingsButton = element<HTMLButtonElement>("settingsButton");
const closeSettingsButton = element<HTMLButtonElement>("closeSettingsButton");
const connectionLabel = element<HTMLElement>("connectionLabel");
const activeDomain = element<HTMLElement>("activeDomain");
const statusDot = element<HTMLElement>("statusDot");
const clientId = element<HTMLElement>("clientId");
const sessionId = element<HTMLElement>("sessionId");
const activeTab = element<HTMLElement>("activeTab");
const queueSize = element<HTMLElement>("queueSize");
const eventCount = element<HTMLElement>("eventCount");
const recordingTimer = element<HTMLElement>("recordingTimer");
const recordLabel = element<HTMLElement>("recordLabel");
const errorText = element<HTMLElement>("errorText");
const unsupportedCard = element<HTMLElement>("unsupportedCard");
const unsupportedReason = element<HTMLElement>("unsupportedReason");
const activityFeed = element<HTMLOListElement>("activityFeed");
const emptyActivity = element<HTMLElement>("emptyActivity");
const lastActivity = element<HTMLElement>("lastActivity");
const settingsDrawer = element<HTMLElement>("settingsDrawer");
const pairingOverlay = element<HTMLElement>("pairingOverlay");
const pairingReferenceCode = element<HTMLElement>("pairingReferenceCode");
const overlayCancelButton = element<HTMLButtonElement>("overlayCancelButton");
const recordingLockOverlay = element<HTMLElement>("recordingLockOverlay");
const recordingLockMessage = element<HTMLElement>("recordingLockMessage");
const recordingLockDismissButton = element<HTMLButtonElement>("recordingLockDismissButton");

let currentStatus: ExtensionStatus | undefined;
let timerHandle: ReturnType<typeof setInterval> | undefined;

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

recordingLockDismissButton.addEventListener("click", () => {
  void sendCommand(RUNTIME_MESSAGES.dismissRecordingLock);
});

chrome.runtime.onMessage.addListener((message: unknown) => {
  const typed = message as { type?: string; status?: ExtensionStatus };
  if (typed.type === RUNTIME_MESSAGES.statusChanged && typed.status) renderStatus(typed.status);
});

async function refresh(): Promise<void> {
  const response = await runtimeSendMessage<RuntimeResponse<{ status: ExtensionStatus }>>({ type: RUNTIME_MESSAGES.getStatus });
  if (response.ok) renderStatus(response.status);
  else renderError(response.error);
}

async function sendCommand(type: string, payload: Record<string, unknown> = {}): Promise<void> {
  setBusy(true);
  try {
    const response = await runtimeSendMessage<RuntimeResponse<{ status: ExtensionStatus }>>({ type, ...payload });
    if (response.ok) renderStatus(response.status);
    else renderError(response.error);
  } catch (error) {
    renderError(error instanceof Error ? error.message : "Command failed.");
  } finally {
    setBusy(false);
    if (currentStatus) renderStatus(currentStatus);
  }
}

function renderStatus(status: ExtensionStatus): void {
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
  activeTab.textContent = status.activeTabUrl ?? (status.activeTabId === undefined ? "-" : String(status.activeTabId));
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
  renderRecordingLockOverlay(status);
  renderError(status.lastError);
  renderTimer();
}

function renderActivities(activities: ActivityEntry[]): void {
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

function readSettingsFromForm(): FluxIQSettings {
  return {
    gatewayUrl: gatewayUrl.value.trim() || defaultSettings().gatewayUrl,
    autoReconnect: autoReconnect.checked,
    captureMutations: captureMutations.checked,
    captureInputValues: captureInputValues.checked,
    captureSnapshots: captureSnapshots.checked
  };
}

function setBusy(busy: boolean): void {
  for (const button of [connectButton, disconnectButton, resetSessionButton, overlayCancelButton, recordButton, stopButton]) button.disabled = busy;
}

function renderError(message: string | undefined): void {
  errorText.hidden = !message;
  errorText.textContent = message ?? "";
}

function renderPairingOverlay(status: ExtensionStatus): void {
  const shouldShow = status.connectionState === "pairing";
  pairingOverlay.hidden = !shouldShow;
  if (!shouldShow) return;
  pairingReferenceCode.textContent = status.pairingReferenceCode ?? "------";
}

function renderRecordingLockOverlay(status: ExtensionStatus): void {
  const block = status.recordingBlock;
  recordingLockOverlay.hidden = !block;
  recordingLockMessage.textContent = block?.message ?? "";
}

function startTimerLoop(): void {
  timerHandle = setInterval(renderTimer, 1_000);
  window.addEventListener("unload", () => {
    if (timerHandle) clearInterval(timerHandle);
  });
}

function renderTimer(): void {
  const startedAt = currentStatus?.recordingStartedAt;
  if (!startedAt || currentStatus?.recordingState !== "recording") {
    recordingTimer.textContent = "00:00";
    return;
  }
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1_000));
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  recordingTimer.textContent = `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function domainLabel(url: string | undefined): string {
  if (!url) return "No active page";
  try {
    const parsed = new URL(url);
    return parsed.hostname || parsed.protocol.replace(":", "");
  } catch {
    return url;
  }
}

function relativeTime(timestamp: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1_000));
  if (seconds < 5) return "Now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing popup element: ${id}`);
  return found as T;
}
