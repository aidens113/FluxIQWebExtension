// Settings, opened by the gear in place of the chat: the connection (the two
// addresses and four switches, with an explicit Save, and Disconnect), the
// on-page status, Report a problem, Forget this pairing behind a confirmation,
// and a way into FluxIQ for everything richer. Nothing here edits a Flow.
//
// The labels, "Save", "Saved.", "Forget this pairing" and "Forget" are the
// names the Lab presses and waits for (packages/test-runner/src/demo-workspace/
// browser-session.ts, ui-e2e/journeys/extension-project.ts), and the ids are
// kept from the old drawer.
//
// Every outcome stays where it happened until the person acts again (audit
// defect F1): a status push refills the form only while nothing in it is
// unsaved, and never wipes "Saved." or a failure. What they typed survives the
// Firefox popup closing (defect S1, `draft-store.ts`).

import { defaultSettings } from "../../shared/browser";
import { RUNTIME_MESSAGES } from "../../shared/constants";
import type { ExtensionStatus, FluxIQSettings } from "../../shared/protocol";
import { createOnPageStatusSetting } from "../chat";
import { connectionCopy } from "../copy";
import { createElement } from "../dom";
import { createOpenFluxIQButton } from "../open-fluxiq";
import type { PanelContext } from "../shell";
import type { PanelResult } from "../state";
import { createSettingsForm } from "./address-form";
import { readConnectionDraft, writeConnectionDraft } from "./draft-store";
import { createForgetConfirmation } from "./forget-confirmation";
import { createProblemReportSection } from "./problem-report-section";
import { savePlan } from "./save-plan";
import "./settings.css";

/** The mounted settings screen; `shown` and `hidden` start and stop what it reads. */
export type SettingsView = { readonly element: HTMLElement; shown(): void; hidden(): void };

/** Builds settings; `close` goes back to where the person was. */
export function createSettingsView(context: PanelContext, close: () => void): SettingsView {
  const { store } = context;
  let dirty = false;
  let editRevision = 0;

  const back = createElement("button", { className: "icon-button settings-back", text: "←", attrs: { type: "button", "aria-label": "Close settings", title: "Close settings" } });
  back.addEventListener("click", close);
  const dot = createElement("span", { className: "dot", attrs: { "aria-hidden": "true" } });
  const stateLine = createElement("p", { className: "settings-state-text", text: "Checking the connection..." });
  const draftLine = createElement("p", { className: "card-line", text: "You have changes that aren't saved yet.", hidden: true });
  const form = createSettingsForm();
  const saveButton = createElement("button", { id: "saveSettingsButton", className: "primary-button", text: "Save", attrs: { type: "button" } });
  const disconnectButton = createElement("button", { id: "disconnectButton", className: "small-button", text: "Disconnect", attrs: { type: "button" } });
  const message = createElement("p", { className: "card-line success-line", hidden: true, attrs: { role: "status" } });
  const notice = createElement("div", { className: "notice danger", hidden: true, attrs: { role: "alert" } });
  // The on-page status preference is the chat's (`panel/chat/settings`); settings only hold it.
  const onPage = createOnPageStatusSetting(store.request);
  const forget = createForgetConfirmation(forgetPairing);
  const open = createOpenFluxIQButton(store.request, { label: "Open FluxIQ", look: "small" });

  const element = createElement("section", { className: "settings-screen", hidden: true, attrs: { "aria-label": "Settings" } }, [
    createElement("div", { className: "settings-column" }, [
      createElement("header", { className: "settings-head" }, [back, createElement("h2", { className: "settings-title", text: "Settings" })]),
      createElement("section", { className: "settings-group", attrs: { "aria-label": "Connection" } }, [
        createElement("h3", { className: "settings-group-title", text: "Connection" }),
        createElement("div", { className: "settings-state" }, [dot, stateLine]),
        draftLine,
        form.element,
        createElement("div", { className: "card-actions" }, [saveButton, disconnectButton]),
        message,
        notice
      ]),
      createElement("section", { className: "settings-group", attrs: { "aria-label": "Status on the page" } }, [onPage.element]),
      createElement("section", { className: "settings-group", attrs: { "aria-label": "Help" } }, [createProblemReportSection(context), forget.element]),
      createElement("section", { className: "settings-group settings-more", attrs: { "aria-label": "More in FluxIQ" } }, [
        createElement("p", { className: "card-line", text: "Your Flows, their runs and everything else are in FluxIQ." }),
        open.element
      ])
    ])
  ]);

  form.onEdit(() => {
    editRevision += 1;
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
    // The raw text sits beside the sentence, for whoever is fixing the connection.
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
    const submittedRevision = editRevision;
    setSaving(true);
    const saved = await store.request({ type: RUNTIME_MESSAGES.panelSaveSettings, settings: plan.settings });
    setSaving(false);
    if (failed(saved)) return;
    if (submittedRevision === editRevision) {
      dirty = false;
      draftLine.hidden = true;
      writeConnectionDraft(undefined);
      form.fill(plan.settings);
      showSuccess("Saved.");
    } else showSuccess("Saved the earlier settings. Your newer changes aren't saved yet.");
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
    const copy = connectionCopy(status);
    dot.className = `dot dot-${copy.dot}`;
    stateLine.textContent = copy.sentence;
    disconnectButton.disabled = status.connectionState === "disconnected";
    open.observe(status);
    if (!dirty) form.fill(savedSettings(status));
  }

  store.subscribe(render);
  void readConnectionDraft().then((draft) => {
    if (draft === undefined || dirty) return;
    editRevision += 1;
    dirty = true;
    draftLine.hidden = false;
    form.fill(draft);
  });

  return {
    element,
    shown() {
      render();
      onPage.setActive(true);
    },
    hidden() {
      onPage.setActive(false);
    }
  };
}

function savedSettings(status: ExtensionStatus): FluxIQSettings {
  const defaults = defaultSettings();
  const settings = { ...defaults, ...status.settings };
  return { ...settings, gatewayUrl: settings.gatewayUrl || status.gatewayUrl || defaults.gatewayUrl, coreApiUrl: settings.coreApiUrl || defaults.coreApiUrl };
}
