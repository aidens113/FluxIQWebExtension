// Settings, opened by the gear in place of the chat, read top down by what a
// person cares about: whether FluxIQ is connected and has approved this browser,
// which project, whether the model key is ready (with Open FluxIQ), the status
// on the page, and Report a problem. Under Advanced, the technical things: the
// two addresses and the capture switches with an explicit Save, Disconnect, and
// Forget this pairing behind a confirmation (`advanced-section.ts`). There is no
// spending setting here: none exists behind any port. Nothing here edits a Flow.
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
import type { ModelKeyReading, SetupPort } from "../getting-started";
import { createOpenFluxIQButton } from "../open-fluxiq";
import type { PanelContext } from "../shell";
import type { PanelResult } from "../state";
import { createAdvancedSection } from "./advanced-section";
import { createSettingsForm } from "./address-form";
import { approvalLine } from "./approval-line";
import { readConnectionDraft, writeConnectionDraft } from "./draft-store";
import { createForgetConfirmation } from "./forget-confirmation";
import { modelKeyLine } from "./model-key-line";
import { createProblemReportSection } from "./problem-report-section";
import { projectLine } from "./project-line";
import { savePlan } from "./save-plan";
import "./settings.css";

/** The mounted settings screen; `shown` and `hidden` start and stop what it reads. */
export type SettingsView = { readonly element: HTMLElement; shown(): void; hidden(): void };

/** What settings reads beside the status: the model key, through the setup screens' one seam. Absent, the key line says it could not check. */
export type SettingsViewOptions = { readonly setup?: SetupPort };

/** Builds settings; `close` goes back to where the person was. */
export function createSettingsView(context: PanelContext, close: () => void, options: SettingsViewOptions = {}): SettingsView {
  const { store } = context;
  let dirty = false;
  let editRevision = 0;
  let mutation: "save" | "disconnect" | "forget" | undefined;
  let modelKey: ModelKeyReading = "unknown";
  let reading = 0;
  let isShown = false;

  const back = createElement("button", { className: "icon-button settings-back", text: "←", attrs: { type: "button", "aria-label": "Close settings", title: "Close settings" } });
  back.addEventListener("click", close);
  const dot = createElement("span", { className: "dot", attrs: { "aria-hidden": "true" } });
  const stateLine = createElement("p", { className: "settings-state-text", text: "Checking the connection..." });
  const approval = createElement("p", { className: "card-line" });
  const project = createElement("p", { className: "card-line" });
  const keyLine = createElement("p", { className: "card-line" });
  const draftLine = createElement("p", { className: "card-line", text: "You have changes that aren't saved yet.", hidden: true });
  const form = createSettingsForm();
  const saveButton = createElement("button", { id: "saveSettingsButton", className: "primary-button", text: "Save", attrs: { type: "button" } });
  const disconnectButton = createElement("button", { id: "disconnectButton", className: "small-button", text: "Disconnect", attrs: { type: "button" } });
  const message = createElement("p", { className: "card-line success-line", hidden: true, attrs: { role: "status" } });
  const notice = createElement("div", { className: "notice danger", hidden: true, attrs: { role: "alert" } });
  // The on-page status preference is the chat's (`panel/chat/settings`); settings only hold it.
  const onPage = createOnPageStatusSetting(store.request);
  const forget = createForgetConfirmation(forgetPairing);
  const open = createOpenFluxIQButton(store.request, { label: "Open FluxIQ", look: "small", purpose: "model-key" });
  const advanced = createAdvancedSection([
    draftLine,
    form.element,
    createElement("div", { className: "card-actions" }, [saveButton, disconnectButton]),
    message,
    notice,
    forget.element
  ]);

  const element = createElement("section", { className: "settings-screen", hidden: true, attrs: { "aria-label": "Settings" } }, [
    createElement("div", { className: "settings-column" }, [
      createElement("header", { className: "settings-head" }, [back, createElement("h2", { className: "settings-title", text: "Settings" })]),
      createElement("section", { className: "settings-group", attrs: { "aria-label": "Connection" } }, [
        createElement("h3", { className: "settings-group-title", text: "Connection" }),
        createElement("div", { className: "settings-state" }, [dot, stateLine]),
        approval
      ]),
      createElement("section", { className: "settings-group", attrs: { "aria-label": "Project" } }, [
        createElement("h3", { className: "settings-group-title", text: "Project" }),
        project
      ]),
      createElement("section", { className: "settings-group", attrs: { "aria-label": "Model key" } }, [
        createElement("h3", { className: "settings-group-title", text: "Model key" }),
        keyLine,
        open.element
      ]),
      createElement("section", { className: "settings-group", attrs: { "aria-label": "Status on the page" } }, [onPage.element]),
      createElement("section", { className: "settings-group", attrs: { "aria-label": "Help" } }, [createProblemReportSection(context)]),
      advanced.element
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
    advanced.reveal();
  }

  function failed(result: PanelResult<unknown>): boolean {
    if (result.ok) return false;
    showFailure(result.sentence, result.detail);
    return true;
  }

  async function save(): Promise<void> {
    if (mutation !== undefined) return;
    clearOutcome();
    const plan = savePlan(form.read(), store.current());
    if (!plan.ok) {
      form.markInvalid(plan.field);
      showFailure(plan.sentence);
      return;
    }
    form.markInvalid(undefined);
    const submittedRevision = editRevision;
    mutation = "save";
    renderBusy();
    try {
      const saved = await store.request({ type: RUNTIME_MESSAGES.panelSaveSettings, settings: plan.settings });
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
    } catch {
      showFailure("Couldn't finish saving and connecting. Try Save again.");
    } finally {
      mutation = undefined;
      renderBusy();
    }
  }

  async function disconnect(): Promise<void> {
    if (mutation !== undefined) return;
    clearOutcome();
    mutation = "disconnect";
    renderBusy();
    try {
      failed(await store.request({ type: RUNTIME_MESSAGES.disconnect }));
    } catch {
      showFailure("Couldn't disconnect. Try Disconnect again.");
    } finally {
      mutation = undefined;
      renderBusy();
    }
  }

  async function forgetPairing(): Promise<boolean> {
    if (mutation !== undefined) return false;
    clearOutcome();
    mutation = "forget";
    renderBusy();
    try {
      if (failed(await store.request({ type: RUNTIME_MESSAGES.resetSession }))) return false;
      showSuccess("Pairing forgotten. Connect again to pair this browser.");
      return true;
    } catch {
      showFailure("Couldn't forget this pairing. Try Forget again.");
      return false;
    } finally {
      mutation = undefined;
      renderBusy();
    }
  }

  function renderBusy(): void {
    saveButton.disabled = mutation !== undefined;
    saveButton.textContent = mutation === "save" ? "Saving..." : "Save";
    disconnectButton.disabled = mutation !== undefined || store.current()?.connectionState === "disconnected";
    forget.setBusy(mutation !== undefined);
  }

  saveButton.addEventListener("click", () => void save());
  disconnectButton.addEventListener("click", () => void disconnect());

  function render(): void {
    renderBusy();
    const status = store.current();
    if (status === undefined) return;
    const copy = connectionCopy(status);
    dot.className = `dot dot-${copy.dot}`;
    stateLine.textContent = copy.sentence;
    approval.textContent = approvalLine(status);
    project.textContent = projectLine(status);
    keyLine.textContent = modelKeyLine(modelKey, status.connectionState === "connected");
    open.observe(status);
    // Before filling, so a switch Core's policy forbids fills as off.
    form.allow(status.captureAllowed);
    if (!dirty) form.fill(savedSettings(status));
  }

  /** Reads the model key again (settings just opened, or the panel came back from FluxIQ); the newest read wins. */
  async function readKey(): Promise<void> {
    if (options.setup === undefined || store.current()?.connectionState !== "connected") return;
    const mine = ++reading;
    let next: ModelKeyReading;
    try {
      next = await options.setup.readModelKey();
    } catch {
      next = "unknown";
    }
    if (mine !== reading) return;
    modelKey = next;
    render();
  }

  store.subscribe(render);
  globalThis.addEventListener?.("focus", () => { if (isShown) void readKey(); });
  void readConnectionDraft().then((draft) => {
    if (draft === undefined || dirty) return;
    editRevision += 1;
    dirty = true;
    draftLine.hidden = false;
    form.fill(draft);
    advanced.reveal();
  });

  return {
    element,
    shown() {
      isShown = true;
      render();
      void readKey();
      onPage.setActive(true);
    },
    hidden() {
      isShown = false;
      onPage.setActive(false);
    }
  };
}

function savedSettings(status: ExtensionStatus): FluxIQSettings {
  const defaults = defaultSettings();
  const settings = { ...defaults, ...status.settings };
  return { ...settings, gatewayUrl: settings.gatewayUrl || status.gatewayUrl || defaults.gatewayUrl, coreApiUrl: settings.coreApiUrl || defaults.coreApiUrl };
}
