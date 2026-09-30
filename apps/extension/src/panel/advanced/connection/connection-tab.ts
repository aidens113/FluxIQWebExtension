// The Connection tab (UI audit, section 4, "Connection tab copy"): the raw
// connection state, the settings with an explicit Save, Disconnect, the queue,
// the ids, Report a problem, and Forget this pairing behind a confirmation.
//
// Every outcome stays where it happened until the viewer acts again (audit
// defect F1): a status push refills the ids and the state line but never wipes
// "Saved." or a failure. The form is refilled from status only while the viewer
// has nothing unsaved in it, and what they typed survives the Firefox popup
// closing (defect S1, `draft-store.ts`).

import { defaultSettings } from "../../../shared/browser";
import { RUNTIME_MESSAGES } from "../../../shared/constants";
import type { ExtensionStatus, FluxIQSettings } from "../../../shared/protocol";
import { createElement } from "../../dom";
import type { PanelResult } from "../../state";
import type { PanelViewContext } from "../../shell";
import type { AdvancedTabPanel } from "../tab-panel";
import { readConnectionDraft, writeConnectionDraft } from "./draft-store";
import { createForgetConfirmation } from "./forget-confirmation";
import { createProblemReportSection } from "./problem-report-section";
import { savePlan } from "./save-plan";
import { createSettingsForm } from "./settings-form";

/** Mounts the Connection tab. */
export function mountConnectionTab(context: PanelViewContext): AdvancedTabPanel {
  const { store } = context;
  let dirty = false;

  const stateLine = createElement("p", { className: "card-line", text: "State: unknown" });
  const draftLine = createElement("p", { className: "card-line", text: "You have changes that aren't saved yet.", hidden: true });
  const form = createSettingsForm();
  const saveButton = createElement("button", { id: "saveSettingsButton", className: "primary-button", text: "Save", attrs: { type: "button" } });
  const disconnectButton = createElement("button", { id: "disconnectButton", className: "small-button", text: "Disconnect", attrs: { type: "button" } });
  const message = createElement("p", { className: "card-line success-line", hidden: true, attrs: { role: "status" } });
  const notice = createElement("div", { className: "notice danger", hidden: true, attrs: { role: "alert" } });
  const queueLine = createElement("p", { className: "card-line", text: "Waiting to send: 0" });
  const clientId = createElement("dd", { id: "clientId", text: "None" });
  const sessionId = createElement("dd", { id: "sessionId", text: "None" });
  const activeTab = createElement("dd", { id: "activeTab", text: "None" });
  const forget = createForgetConfirmation(forgetPairing);

  const element = createElement("div", { className: "advanced-tab connection-tab" }, [
    createElement("h2", { className: "card-title", text: "Connection" }),
    stateLine,
    draftLine,
    form.element,
    createElement("div", { className: "card-actions" }, [saveButton, disconnectButton]),
    message,
    notice,
    queueLine,
    createElement("dl", { className: "diagnostics" }, [
      createElement("div", {}, [createElement("dt", { text: "This browser's ID" }), clientId]),
      createElement("div", {}, [createElement("dt", { text: "Connection ID" }), sessionId]),
      createElement("div", {}, [createElement("dt", { text: "Current tab" }), activeTab])
    ]),
    createProblemReportSection(context),
    forget.element
  ]);

  form.onEdit(() => {
    dirty = true;
    draftLine.hidden = false;
    message.hidden = true;
    form.markInvalid(undefined);
    writeConnectionDraft(form.read());
  });

  function clearOutcome(): void {
    message.hidden = true;
    notice.hidden = true;
  }

  function showSuccess(text: string): void {
    message.textContent = text;
    message.hidden = false;
  }

  function showFailure(sentence: string, detail?: string): void {
    notice.replaceChildren(createElement("span", { text: sentence }));
    // Advanced keeps the raw text beside the sentence (UI audit, section 4, "Error sentences").
    if (detail !== undefined && detail !== sentence) notice.append(createElement("span", { className: "notice-detail", text: detail }));
    notice.hidden = false;
  }

  function failed(result: PanelResult<unknown>): boolean {
    if (result.ok) return false;
    showFailure(result.sentence, result.detail);
    return true;
  }

  async function save(): Promise<void> {
    clearOutcome();
    const plan = savePlan(form.read(), store.current());
    if (!plan.ok) {
      form.markInvalid(plan.field);
      showFailure(plan.sentence);
      return;
    }
    form.markInvalid(undefined);
    setSaving(true);
    const saved = await store.request({ type: RUNTIME_MESSAGES.panelSaveSettings, settings: plan.settings });
    setSaving(false);
    if (failed(saved)) return;
    dirty = false;
    draftLine.hidden = true;
    writeConnectionDraft(undefined);
    form.fill(plan.settings);
    showSuccess("Saved.");
    // The open socket still points at the old address; `connect` dials the stored one.
    if (plan.reconnect) failed(await store.request({ type: RUNTIME_MESSAGES.connect }));
  }

  async function disconnect(): Promise<void> {
    clearOutcome();
    disconnectButton.disabled = true;
    const result = await store.request({ type: RUNTIME_MESSAGES.disconnect });
    render();
    failed(result);
  }

  async function forgetPairing(): Promise<void> {
    clearOutcome();
    forget.setBusy(true);
    const result = await store.request({ type: RUNTIME_MESSAGES.resetSession });
    forget.setBusy(false);
    if (!failed(result)) showSuccess("Pairing forgotten. Connect again to pair this browser.");
  }

  function setSaving(saving: boolean): void {
    saveButton.disabled = saving;
    saveButton.textContent = saving ? "Saving..." : "Save";
  }

  saveButton.addEventListener("click", () => void save());
  disconnectButton.addEventListener("click", () => void disconnect());

  function render(): void {
    const status = store.current();
    if (status === undefined) return;
    stateLine.textContent = `State: ${status.connectionState}`;
    disconnectButton.disabled = status.connectionState === "disconnected";
    queueLine.textContent = `Waiting to send: ${status.queueSize}`;
    clientId.textContent = status.clientId || "None";
    sessionId.textContent = status.sessionId ?? "None";
    activeTab.textContent = status.activeTabUrl ?? (status.activeTabId === undefined ? "None" : String(status.activeTabId));
    if (!dirty) form.fill(savedSettings(status));
  }

  store.subscribe(render);
  void readConnectionDraft().then((draft) => {
    if (draft === undefined || dirty) return;
    dirty = true;
    draftLine.hidden = false;
    form.fill(draft);
  });

  return {
    element,
    shown: render,
    hidden() {
      /* nothing runs while hidden */
    }
  };
}

function savedSettings(status: ExtensionStatus): FluxIQSettings {
  const defaults = defaultSettings();
  const settings = { ...defaults, ...status.settings };
  return { ...settings, gatewayUrl: settings.gatewayUrl || status.gatewayUrl || defaults.gatewayUrl, coreApiUrl: settings.coreApiUrl || defaults.coreApiUrl };
}
