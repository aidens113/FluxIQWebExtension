import { RUNTIME_MESSAGES } from "../shared/constants";
import { defaultSettings, runtimeSendMessage } from "../shared/browser";
import type { ExtensionStatus, FluxIQSettings } from "../shared/protocol";

type RuntimeResponse<T> = { ok: true } & T | { ok: false; error: string };

const gatewayUrl = element<HTMLInputElement>("gatewayUrl");
const autoReconnect = element<HTMLInputElement>("autoReconnect");
const captureMutations = element<HTMLInputElement>("captureMutations");
const captureInputValues = element<HTMLInputElement>("captureInputValues");
const captureSnapshots = element<HTMLInputElement>("captureSnapshots");
const connectButton = element<HTMLButtonElement>("connectButton");
const disconnectButton = element<HTMLButtonElement>("disconnectButton");
const recordButton = element<HTMLButtonElement>("recordButton");
const stopButton = element<HTMLButtonElement>("stopButton");
const connectionLabel = element<HTMLElement>("connectionLabel");
const statusDot = element<HTMLElement>("statusDot");
const clientId = element<HTMLElement>("clientId");
const sessionId = element<HTMLElement>("sessionId");
const activeTab = element<HTMLElement>("activeTab");
const queueSize = element<HTMLElement>("queueSize");
const errorText = element<HTMLElement>("errorText");
const statusTab = element<HTMLButtonElement>("statusTab");
const settingsTab = element<HTMLButtonElement>("settingsTab");
const statusPanel = element<HTMLElement>("statusPanel");
const settingsPanel = element<HTMLElement>("settingsPanel");
const pairingOverlay = element<HTMLElement>("pairingOverlay");
const pairingReferenceCode = element<HTMLElement>("pairingReferenceCode");
const overlayCancelButton = element<HTMLButtonElement>("overlayCancelButton");

void refresh();

statusTab.addEventListener("click", () => setTab("status"));
settingsTab.addEventListener("click", () => setTab("settings"));

connectButton.addEventListener("click", () => {
  void sendCommand(RUNTIME_MESSAGES.connect, { settings: readSettingsFromForm() });
});

overlayCancelButton.addEventListener("click", () => {
  void sendCommand(RUNTIME_MESSAGES.disconnect);
});

disconnectButton.addEventListener("click", () => {
  void sendCommand(RUNTIME_MESSAGES.disconnect);
});

recordButton.addEventListener("click", () => {
  void sendCommand(RUNTIME_MESSAGES.startRecording);
});

stopButton.addEventListener("click", () => {
  void sendCommand(RUNTIME_MESSAGES.stopRecording);
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
  }
}

function renderStatus(status: ExtensionStatus): void {
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
  queueSize.textContent = String(status.queueSize);
  connectionLabel.textContent = `${status.connectionState}${status.recordingState === "recording" ? " - recording" : ""}`;
  statusDot.className = "dot";
  if (status.recordingState === "recording") statusDot.classList.add("recording");
  else if (status.connectionState === "connected") statusDot.classList.add("connected");
  else if (status.connectionState === "connecting" || status.connectionState === "reconnecting" || status.connectionState === "pairing") statusDot.classList.add("connecting");
  recordButton.disabled = status.connectionState !== "connected" || status.recordingState === "recording";
  stopButton.disabled = status.recordingState !== "recording";
  disconnectButton.disabled = status.connectionState === "disconnected";
  renderPairingOverlay(status);
  renderError(status.lastError);
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

function setTab(tab: "status" | "settings"): void {
  const showSettings = tab === "settings";
  settingsTab.classList.toggle("active", showSettings);
  statusTab.classList.toggle("active", !showSettings);
  settingsPanel.classList.toggle("active", showSettings);
  statusPanel.classList.toggle("active", !showSettings);
}

function setBusy(busy: boolean): void {
  for (const button of [connectButton, disconnectButton, overlayCancelButton, recordButton, stopButton]) button.disabled = busy;
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

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing popup element: ${id}`);
  return found as T;
}
