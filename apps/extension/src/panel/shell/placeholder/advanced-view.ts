// The wave-1 Advanced view: the old settings drawer's controls, kept under their
// old labels and ids so the Lab can still set up a session until workstream C
// lands. `packages/test-runner/src/demo-workspace/browser-session.ts` opens
// "Settings", fills "Gateway URL" and "Core API URL", checks "Auto reconnect",
// "DOM mutations", "Input values" and "Snapshots", then presses "Close"; and
// `ui-e2e/journeys/extension-project.ts` presses "Reset Session" and "Close".
// With the empty view the UI audit specified for wave 1, every Lab run would
// stop at its first settings step. C replaces this view and those journeys
// together, with the section 4 labels.

import { defaultSettings } from "../../../shared/browser";
import { RUNTIME_MESSAGES } from "../../../shared/constants";
import type { ExtensionStatus, FluxIQSettings } from "../../../shared/protocol";
import { createElement } from "../../dom";
import type { PanelView, PanelViewContext } from "../contracts";
import type { SettingsDraft } from "./settings-draft";

const TOGGLES = [
  { id: "autoReconnect", label: "Auto reconnect", key: "autoReconnect" },
  { id: "captureMutations", label: "DOM mutations", key: "captureMutations" },
  { id: "captureInputValues", label: "Input values", key: "captureInputValues" },
  { id: "captureSnapshots", label: "Snapshots", key: "captureSnapshots" }
] as const;

/** Mounts the placeholder Advanced view: connection settings, diagnostics and session controls. */
export function mountPlaceholderAdvancedView(context: PanelViewContext, draft: SettingsDraft): PanelView {
  const { store } = context;
  let dirty = false;

  const stateLine = createElement("p", { className: "card-line", text: "State: unknown" });
  const gatewayUrl = createElement("input", { id: "gatewayUrl", attrs: { type: "url", spellcheck: "false", autocomplete: "off" } });
  const coreApiUrl = createElement("input", { id: "coreApiUrl", attrs: { type: "url", spellcheck: "false", autocomplete: "off" } });
  const toggles = TOGGLES.map((toggle) => ({ ...toggle, input: createElement("input", { id: toggle.id, attrs: { type: "checkbox" } }) }));
  const clientId = createElement("dd", { id: "clientId", text: "-" });
  const sessionId = createElement("dd", { id: "sessionId", text: "-" });
  const activeTab = createElement("dd", { id: "activeTab", text: "-" });
  const notice = createElement("p", { className: "notice danger", hidden: true, attrs: { role: "alert" } });
  const disconnectButton = createElement("button", { id: "disconnectButton", className: "small-button", text: "Disconnect", attrs: { type: "button" } });
  const resetButton = createElement("button", { id: "resetSessionButton", className: "small-button danger-button", text: "Reset Session", attrs: { type: "button" } });
  const closeButton = createElement("button", { id: "closeSettingsButton", className: "small-button", text: "Close", attrs: { type: "button" } });

  const element = createElement("section", { className: "advanced-view card", hidden: true, attrs: { "aria-label": "Advanced" } }, [
    createElement("h2", { className: "card-title", text: "Connection" }),
    stateLine,
    createElement("label", { className: "field" }, [createElement("span", { text: "Gateway URL" }), gatewayUrl]),
    createElement("label", { className: "field" }, [createElement("span", { text: "Core API URL" }), coreApiUrl]),
    createElement("div", { className: "toggles" }, toggles.map((toggle) =>
      createElement("label", {}, [toggle.input, createElement("span", { text: toggle.label })]))),
    createElement("dl", { className: "diagnostics" }, [
      createElement("div", {}, [createElement("dt", { text: "Client" }), clientId]),
      createElement("div", {}, [createElement("dt", { text: "Session" }), sessionId]),
      createElement("div", {}, [createElement("dt", { text: "Tab" }), activeTab])
    ]),
    notice,
    createElement("div", { className: "card-actions" }, [disconnectButton, resetButton, closeButton])
  ]);

  for (const control of [gatewayUrl, coreApiUrl, ...toggles.map((toggle) => toggle.input)]) {
    control.addEventListener("input", () => { dirty = true; });
    control.addEventListener("change", () => { dirty = true; });
  }

  function readForm(): FluxIQSettings {
    const defaults = defaultSettings();
    const settings: FluxIQSettings = {
      gatewayUrl: gatewayUrl.value.trim() || defaults.gatewayUrl,
      coreApiUrl: coreApiUrl.value.trim() || defaults.coreApiUrl,
      autoReconnect: defaults.autoReconnect,
      captureMutations: defaults.captureMutations,
      captureInputValues: defaults.captureInputValues,
      captureSnapshots: defaults.captureSnapshots
    };
    for (const toggle of toggles) settings[toggle.key] = toggle.input.checked;
    return settings;
  }
  draft.attach({ read: readForm, markSaved: () => { dirty = false; } });

  async function send(type: string): Promise<void> {
    notice.hidden = true;
    for (const button of [disconnectButton, resetButton]) button.disabled = true;
    const result = await store.request({ type });
    for (const button of [disconnectButton, resetButton]) button.disabled = false;
    if (result.ok) return;
    notice.textContent = result.sentence;
    notice.title = result.detail ?? "";
    notice.hidden = false;
  }
  disconnectButton.addEventListener("click", () => void send(RUNTIME_MESSAGES.disconnect));
  resetButton.addEventListener("click", () => void send(RUNTIME_MESSAGES.resetSession));
  closeButton.addEventListener("click", () => context.navigate({ mode: "simple" }));

  function render(status: ExtensionStatus): void {
    stateLine.textContent = `State: ${status.connectionState.replace("_", " ")}`;
    disconnectButton.disabled = status.connectionState === "disconnected";
    clientId.textContent = status.clientId;
    sessionId.textContent = status.sessionId ?? "-";
    activeTab.textContent = status.activeTabUrl ?? (status.activeTabId === undefined ? "-" : String(status.activeTabId));
    if (dirty) return;
    const defaults = defaultSettings();
    const settings = { ...defaults, ...status.settings };
    gatewayUrl.value = settings.gatewayUrl || status.gatewayUrl || defaults.gatewayUrl;
    coreApiUrl.value = settings.coreApiUrl || defaults.coreApiUrl;
    for (const toggle of toggles) toggle.input.checked = settings[toggle.key];
  }
  store.subscribe(render);

  return {
    element,
    show() {
      element.hidden = false;
    },
    hide() {
      element.hidden = true;
    }
  };
}
