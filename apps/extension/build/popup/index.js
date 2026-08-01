import { RUNTIME_MESSAGES } from "../shared/constants";
import { defaultSettings, runtimeSendMessage } from "../shared/browser";
const gatewayUrl = element("gatewayUrl");
const autoReconnect = element("autoReconnect");
const captureMutations = element("captureMutations");
const captureInputValues = element("captureInputValues");
const captureSnapshots = element("captureSnapshots");
const connectButton = element("connectButton");
const disconnectButton = element("disconnectButton");
const recordButton = element("recordButton");
const stopButton = element("stopButton");
const connectionLabel = element("connectionLabel");
const statusDot = element("statusDot");
const clientId = element("clientId");
const sessionId = element("sessionId");
const activeTab = element("activeTab");
const queueSize = element("queueSize");
const errorText = element("errorText");
const statusTab = element("statusTab");
const settingsTab = element("settingsTab");
const statusPanel = element("statusPanel");
const settingsPanel = element("settingsPanel");
const pairingOverlay = element("pairingOverlay");
const pairingReferenceCode = element("pairingReferenceCode");
const overlayCancelButton = element("overlayCancelButton");
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
chrome.runtime.onMessage.addListener((message) => {
    const typed = message;
    if (typed.type === RUNTIME_MESSAGES.statusChanged && typed.status)
        renderStatus(typed.status);
});
async function refresh() {
    const response = await runtimeSendMessage({ type: RUNTIME_MESSAGES.getStatus });
    if (response.ok)
        renderStatus(response.status);
    else
        renderError(response.error);
}
async function sendCommand(type, payload = {}) {
    setBusy(true);
    try {
        const response = await runtimeSendMessage({ type, ...payload });
        if (response.ok)
            renderStatus(response.status);
        else
            renderError(response.error);
    }
    catch (error) {
        renderError(error instanceof Error ? error.message : "Command failed.");
    }
    finally {
        setBusy(false);
    }
}
function renderStatus(status) {
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
    if (status.recordingState === "recording")
        statusDot.classList.add("recording");
    else if (status.connectionState === "connected")
        statusDot.classList.add("connected");
    else if (status.connectionState === "connecting" || status.connectionState === "reconnecting" || status.connectionState === "pairing")
        statusDot.classList.add("connecting");
    recordButton.disabled = status.connectionState !== "connected" || status.recordingState === "recording";
    stopButton.disabled = status.recordingState !== "recording";
    disconnectButton.disabled = status.connectionState === "disconnected";
    renderPairingOverlay(status);
    renderError(status.lastError);
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
function setTab(tab) {
    const showSettings = tab === "settings";
    settingsTab.classList.toggle("active", showSettings);
    statusTab.classList.toggle("active", !showSettings);
    settingsPanel.classList.toggle("active", showSettings);
    statusPanel.classList.toggle("active", !showSettings);
}
function setBusy(busy) {
    for (const button of [connectButton, disconnectButton, overlayCancelButton, recordButton, stopButton])
        button.disabled = busy;
}
function renderError(message) {
    errorText.hidden = !message;
    errorText.textContent = message ?? "";
}
function renderPairingOverlay(status) {
    const shouldShow = status.connectionState === "pairing";
    pairingOverlay.hidden = !shouldShow;
    if (!shouldShow)
        return;
    pairingReferenceCode.textContent = status.pairingReferenceCode ?? "------";
}
function element(id) {
    const found = document.getElementById(id);
    if (!found)
        throw new Error(`Missing popup element: ${id}`);
    return found;
}
//# sourceMappingURL=index.js.map