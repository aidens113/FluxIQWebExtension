import { RUNTIME_MESSAGES } from "../shared/constants";
import { defaultSettings, runtimeSendMessage } from "../shared/browser";
import type {
  ActivityEntry,
  CoreRecordingsPage,
  CoreRecordingSummary,
  ExtensionStatus,
  FluxIQSettings,
  RecordingLogPage
} from "../shared/protocol";

type RuntimeResponse<T> = ({ ok: true } & T) | { ok: false; error: string };
type ViewName = "recorder" | "events" | "recordings";

const eventPageSize = 25;
const recordingsPageSize = 10;
const shell = element<HTMLElement>("shell");
const gatewayUrl = element<HTMLInputElement>("gatewayUrl");
const coreApiUrl = element<HTMLInputElement>("coreApiUrl");
const autoReconnect = element<HTMLInputElement>("autoReconnect");
const captureMutations = element<HTMLInputElement>("captureMutations");
const captureInputValues = element<HTMLInputElement>("captureInputValues");
const captureSnapshots = element<HTMLInputElement>("captureSnapshots");
const connectButton = element<HTMLButtonElement>("connectButton");
const disconnectButton = element<HTMLButtonElement>("disconnectButton");
const resetSessionButton = element<HTMLButtonElement>("resetSessionButton");
const recordButton = element<HTMLButtonElement>("recordButton");
const settingsButton = element<HTMLButtonElement>("settingsButton");
const closeSettingsButton = element<HTMLButtonElement>("closeSettingsButton");
const recorderTab = element<HTMLButtonElement>("recorderTab");
const eventsTab = element<HTMLButtonElement>("eventsTab");
const recordingsTab = element<HTMLButtonElement>("recordingsTab");
const recorderView = element<HTMLElement>("recorderView");
const eventsView = element<HTMLElement>("eventsView");
const recordingsView = element<HTMLElement>("recordingsView");
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
const runtimeCard = element<HTMLElement>("runtimeCard");
const runtimeStateDot = element<HTMLElement>("runtimeStateDot");
const runtimeState = element<HTMLElement>("runtimeState");
const runtimeCommand = element<HTMLElement>("runtimeCommand");
const runtimeTarget = element<HTMLElement>("runtimeTarget");
const runtimeTab = element<HTMLElement>("runtimeTab");
const runtimeMessage = element<HTMLElement>("runtimeMessage");
const unsupportedCard = element<HTMLElement>("unsupportedCard");
const unsupportedReason = element<HTMLElement>("unsupportedReason");
const activityFeed = element<HTMLOListElement>("activityFeed");
const emptyActivity = element<HTMLElement>("emptyActivity");
const lastActivity = element<HTMLElement>("lastActivity");
const eventPageLabel = element<HTMLElement>("eventPageLabel");
const prevEventsButton = element<HTMLButtonElement>("prevEventsButton");
const nextEventsButton = element<HTMLButtonElement>("nextEventsButton");
const recordingsList = element<HTMLOListElement>("recordingsList");
const emptyRecordings = element<HTMLElement>("emptyRecordings");
const recordingsSource = element<HTMLElement>("recordingsSource");
const recordingsPageLabel = element<HTMLElement>("recordingsPageLabel");
const refreshRecordingsButton = element<HTMLButtonElement>("refreshRecordingsButton");
const prevRecordingsButton = element<HTMLButtonElement>("prevRecordingsButton");
const nextRecordingsButton = element<HTMLButtonElement>("nextRecordingsButton");
const settingsDrawer = element<HTMLElement>("settingsDrawer");
const settingsBackdrop = element<HTMLElement>("settingsBackdrop");
const pairingOverlay = element<HTMLElement>("pairingOverlay");
const pairingReferenceCode = element<HTMLElement>("pairingReferenceCode");
const overlayCancelButton = element<HTMLButtonElement>("overlayCancelButton");
const recordingLockOverlay = element<HTMLElement>("recordingLockOverlay");
const recordingLockMessage = element<HTMLElement>("recordingLockMessage");
const recordingLockDismissButton = element<HTMLButtonElement>("recordingLockDismissButton");

let currentStatus: ExtensionStatus | undefined;
let currentView: ViewName = "recorder";
let eventPage = 1;
let eventTotal = 0;
let recordingsPage = 1;
let recordingsTotal: number | undefined;
let timerHandle: ReturnType<typeof setInterval> | undefined;

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
  if (recordingsTotal !== undefined && recordingsPage * recordingsPageSize >= recordingsTotal) return;
  recordingsPage += 1;
  void refreshRecordings();
});

chrome.runtime.onMessage.addListener((message: unknown) => {
  const typed = message as { type?: string; status?: ExtensionStatus };
  if (typed.type === RUNTIME_MESSAGES.statusChanged && typed.status) {
    const previousStartedAt = currentStatus?.recordingStartedAt;
    renderStatus(typed.status);
    if (typed.status.recordingStartedAt !== previousStartedAt) eventPage = 1;
    if (currentView === "events") void refreshEventLog();
  }
});

async function refresh(): Promise<void> {
  const response = await runtimeSendMessage<RuntimeResponse<{ status: ExtensionStatus }>>({ type: RUNTIME_MESSAGES.getStatus });
  if (response.ok) {
    renderStatus(response.status);
    await refreshEventLog();
  } else {
    renderError(response.error);
  }
}

async function sendCommand(type: string, payload: Record<string, unknown> = {}): Promise<void> {
  setBusy(true);
  try {
    const response = await runtimeSendMessage<RuntimeResponse<{ status: ExtensionStatus }>>({ type, ...payload });
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

function renderStatus(status: ExtensionStatus): void {
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

function renderRuntime(status: ExtensionStatus): void {
  const runtime = status.runtime;
  const state = runtime?.state ?? "idle";
  runtimeCard.classList.toggle("running", state === "running");
  runtimeCard.classList.toggle("succeeded", state === "succeeded");
  runtimeCard.classList.toggle("failed", state === "failed");
  runtimeStateDot.className = `runtime-state-dot ${state}`;
  runtimeState.textContent = state === "idle" ? "Runtime idle"
    : state === "running" ? "Runtime running"
      : state === "succeeded" ? "Runtime succeeded"
        : "Runtime failed";
  runtimeCommand.textContent = runtime?.label ?? runtime?.actionType ?? "No command running";
  runtimeTarget.textContent = runtime?.target ?? runtime?.url ?? "-";
  runtimeTab.textContent = runtime?.tabId === undefined ? "-" : `Tab ${runtime.tabId}`;
  runtimeMessage.textContent = runtime?.error ?? runtime?.message ?? (runtime?.startedAt ? relativeTime(runtime.startedAt) : "-");
}

async function refreshEventLog(): Promise<void> {
  const response = await runtimeSendMessage<RuntimeResponse<{ log: RecordingLogPage }>>({
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

async function refreshRecordings(): Promise<void> {
  recordingsSource.textContent = "Loading...";
  refreshRecordingsButton.disabled = true;
  try {
    const response = await runtimeSendMessage<RuntimeResponse<{ recordings: CoreRecordingsPage }>>({
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

function renderActivities(log: RecordingLogPage): void {
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

function renderRecordings(page: CoreRecordingsPage): void {
  recordingsTotal = page.total;
  recordingsPage = page.page;
  recordingsSource.textContent = sourceHost(page.sourceUrl);
  recordingsList.replaceChildren();
  emptyRecordings.hidden = page.items.length > 0;
  for (const recording of page.items) recordingsList.append(recordingItem(recording));
  const totalPages = page.total === undefined ? undefined : Math.max(1, Math.ceil(page.total / page.pageSize));
  recordingsPageLabel.textContent = totalPages ? `Page ${page.page} of ${totalPages}` : `Page ${page.page}`;
  prevRecordingsButton.disabled = page.page <= 1;
  nextRecordingsButton.disabled = totalPages ? page.page >= totalPages : page.items.length < page.pageSize;
}

function renderRecordingsError(message: string): void {
  recordingsTotal = 0;
  recordingsList.replaceChildren();
  emptyRecordings.hidden = false;
  emptyRecordings.textContent = message;
  recordingsSource.textContent = "Unavailable";
  recordingsPageLabel.textContent = `Page ${recordingsPage}`;
  prevRecordingsButton.disabled = recordingsPage <= 1;
  nextRecordingsButton.disabled = true;
}

function recordingItem(recording: CoreRecordingSummary): HTMLLIElement {
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
  const count = recording.eventCount === undefined ? "events unknown" : `${recording.eventCount} events`;
  const date = recording.startedAt ? relativeDate(recording.startedAt) : recording.updatedAt ? relativeDate(recording.updatedAt) : recording.id;
  meta.textContent = `${count} - ${date}`;
  item.append(meta);
  return item;
}

function switchView(view: ViewName): void {
  currentView = view;
  applyLayoutMode();
  if (view === "events") void refreshEventLog();
  if (view === "recordings") void refreshRecordings();
}

function applyLayoutMode(): void {
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

function handleTabKeydown(event: KeyboardEvent): void {
  const tabs: HTMLButtonElement[] = [recorderTab, eventsTab, recordingsTab];
  const currentIndex = tabs.indexOf(event.currentTarget as HTMLButtonElement);
  const nextIndex = event.key === "ArrowRight" ? (currentIndex + 1) % tabs.length
    : event.key === "ArrowLeft" ? (currentIndex - 1 + tabs.length) % tabs.length
      : event.key === "Home" ? 0
        : event.key === "End" ? tabs.length - 1
          : undefined;
  if (nextIndex === undefined) return;
  event.preventDefault();
  const nextTab = tabs[nextIndex]!;
  nextTab.focus();
  switchView(nextTab.dataset.view as ViewName);
}

function setSettingsOpen(open: boolean): void {
  settingsDrawer.hidden = !open;
  settingsBackdrop.hidden = !open;
  if (open) closeSettingsButton.focus();
  else settingsButton.focus();
}

function readSettingsFromForm(): FluxIQSettings {
  return {
    gatewayUrl: gatewayUrl.value.trim() || defaultSettings().gatewayUrl,
    coreApiUrl: coreApiUrl.value.trim() || defaultSettings().coreApiUrl,
    autoReconnect: autoReconnect.checked,
    captureMutations: captureMutations.checked,
    captureInputValues: captureInputValues.checked,
    captureSnapshots: captureSnapshots.checked
  };
}

function setBusy(busy: boolean): void {
  for (const button of [connectButton, disconnectButton, resetSessionButton, overlayCancelButton, recordButton]) button.disabled = busy;
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

function sourceHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "FluxIQ Core";
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

function relativeDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing popup element: ${id}`);
  return found as T;
}
