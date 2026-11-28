// The getting-started screen: plain numbered steps with their buttons, drawn
// from `startGuide`, in place of the chat until the browser is connected.
//
// Ids and names the Lab and older journeys use are kept: `#connectButton`
// ("Connect", "Try again", "Try now") and `#pairingReferenceCode` (the
// "Approval code"). A failed Connect or Cancel stays on screen until its cause
// is gone or the person presses again.
//
// Open FluxIQ sits under the "Connect and approve" step, also while the approval
// code waits. Step one says where FluxIQ was found and offers Change, one field:
// the web address. Connect uses the connection address that FluxIQ's own discovery
// document names, so a person types one address.
//
// Once FluxIQ is found the request goes out by itself, once (`autoSent`): the code
// shows at once and Connect is only the retry after a request failed or was
// cancelled. It never goes out by itself again after this panel saw the browser
// connected, so a person who disconnected or was removed is not re-asked.

import { RUNTIME_MESSAGES } from "../../../shared/constants";
import type { ExtensionStatus } from "../../../shared/protocol";
import { createElement } from "../../dom";
import { createOpenFluxIQButton, OPEN_IN_PANEL } from "../../open-fluxiq";
import type { PanelContext } from "../../shell";
import { createStickyError } from "../../state";
import { discoveryProbe, type ReachabilityProbe } from "../reachability";
import { createChangeAddress, saveServerAddress } from "./server";
import type { StartGuide, StartStep, StartStepKey } from "./steps";
import "../getting-started.css";

/** The mounted screen. */
export type StartView = {
  readonly element: HTMLElement;
  render(guide: StartGuide, status: ExtensionStatus | undefined): void;
  /** The connection request already went out by itself from this screen. */
  autoSent(): boolean;
};

/** The key step's link: it opens the FluxIQ panel at its keys page. */
const KEY_LINK = "Add your AI key in the FluxIQ panel";
const KEYS: readonly StartStepKey[] = ["start", "approve", "key"];
const MARKS: Readonly<Record<StartStepKey, string>> = { start: "1", approve: "2", key: "3" };
const STATE_WORDS: Readonly<Record<StartStep["state"], string>> = { done: "Done", current: "Next", waiting: "In progress", problem: "Needs attention", todo: "To do" };

/** Builds the screen; `openSettings` opens settings (the connection address); `probe` asks a web address for its discovery document. */
export function createStartView(context: PanelContext, openSettings: () => void, probe: ReachabilityProbe = discoveryProbe): StartView {
  const { store } = context;
  const error = createStickyError<ExtensionStatus>();
  let pending = false;
  let autoSent = false;
  let autoRunning = false;
  let latestStatus: ExtensionStatus | undefined;
  let latestGuide: StartGuide | undefined;
  const title = createElement("h2", { className: "start-title" });
  const line = createElement("p", { className: "start-line" });
  // While FluxIQ waits for approval its sign-in page should say what it is for, so the button opens it with that purpose.
  let waitingForApproval = false;
  const open = createOpenFluxIQButton(store.request, { label: OPEN_IN_PANEL, look: "small", purpose: () => (waitingForApproval ? "pairing" : "ask") });
  // Keys are added in the FluxIQ panel, never here: the key step is that link.
  const keyOpen = createOpenFluxIQButton(store.request, { label: KEY_LINK, look: "link", purpose: "model-key" });
  const connectButton = createElement("button", { id: "connectButton", className: "primary-button", text: "Connect", attrs: { type: "button" } });
  const addressLink = createElement("button", { className: "link-button", text: "Check the connection address", attrs: { type: "button" } });
  const changeButton = createElement("button", { className: "small-button", text: "Change", attrs: { type: "button", "aria-label": "Change the FluxIQ web address" } });
  const change = createChangeAddress({ request: store.request, probe, status: () => latestStatus });
  const code = createElement("p", { id: "pairingReferenceCode", className: "pairing-code", attrs: { "aria-label": "Approval code" } });
  const cancelPairing = createElement("button", { className: "small-button", text: "Cancel approval request", attrs: { type: "button" } });
  const notice = createElement("p", { className: "notice", hidden: true, attrs: { role: "status" } });

  const changeActions = createElement("div", { className: "start-actions start-keep", hidden: true }, [changeButton]);
  const connectActions = createElement("div", { className: "start-actions" }, [connectButton, addressLink]);
  const keyActions = createElement("div", { className: "start-actions" }, [keyOpen.element]);
  const openActions = createElement("div", { className: "start-actions" }, [open.element]);
  const approveBlock = createElement("div", { className: "start-approve" }, [code, createElement("div", { className: "start-actions" }, [cancelPairing])]);
  const actions: Readonly<Record<StartStepKey, readonly HTMLElement[]>> = {
    start: [changeActions],
    approve: [connectActions, openActions, approveBlock],
    key: [keyActions]
  };
  const rows = KEYS.map((key) => {
    const mark = createElement("span", { className: "start-mark", text: MARKS[key], attrs: { "aria-hidden": "true" } });
    const name = createElement("strong", { className: "start-step-title" });
    const state = createElement("span", { className: "start-state" });
    const text = createElement("p", { className: "start-step-line" });
    const extra = key === "start" ? [change.element] : [];
    const item = createElement("li", { className: "start-step" }, [
      mark,
      createElement("div", { className: "start-step-body" }, [createElement("div", { className: "start-step-head" }, [name, state]), text, ...actions[key], ...extra])
    ]);
    return { key, item, mark, name, state, text };
  });
  const list = createElement("ol", { className: "start-steps", attrs: { "aria-label": "Steps" } }, rows.map((row) => row.item));
  const element = createElement("section", { className: "start-screen", hidden: true, attrs: { "aria-label": "Get started", "aria-live": "polite" } }, [
    createElement("div", { className: "start-column" }, [
      createElement("div", { className: "start-brand", text: "F", attrs: { "aria-hidden": "true" } }),
      title,
      line,
      list,
      notice
    ])
  ]);

  connectButton.addEventListener("click", () => void press(connectButton.dataset.action === "disconnect" ? "disconnect" : "connect"));
  cancelPairing.addEventListener("click", () => void press("disconnect"));
  addressLink.addEventListener("click", openSettings);
  changeButton.addEventListener("click", () => change.open(latestGuide?.server?.origin ?? latestStatus?.settings?.coreApiUrl));

  /** FluxIQ found at an address whose document names another connection address: connect there, not to the old one. */
  function adoptFoundGateway(): Promise<unknown> | undefined {
    const server = latestGuide?.server;
    if (server?.found !== true || server.gatewayUrl === undefined || latestStatus?.settings?.gatewayUrl === server.gatewayUrl) return undefined;
    return saveServerAddress(store.request, latestStatus, server.origin, server.gatewayUrl);
  }

  async function press(action: "connect" | "disconnect"): Promise<void> {
    if (pending) return;
    pending = true;
    error.clear();
    drawNotice();
    connectButton.disabled = true;
    cancelPairing.disabled = true;
    // The request that goes out by itself is not a button to press: Connect comes back only if it failed.
    if (autoRunning) connectButton.hidden = true;
    const causeGone = (status: ExtensionStatus) => status.connectionState === (action === "connect" ? "connected" : "disconnected");
    try {
      const adopting = action === "connect" ? adoptFoundGateway() : undefined;
      if (adopting !== undefined) await adopting;
      const result = await store.request({ type: action === "connect" ? RUNTIME_MESSAGES.connect : RUNTIME_MESSAGES.disconnect });
      if (!result.ok) error.show(result.sentence, causeGone, result.detail);
    } catch {
      error.show("The connection request could not finish. Try again.", causeGone);
    } finally {
      pending = false;
      autoRunning = false;
      connectButton.disabled = false;
      cancelPairing.disabled = false;
      connectButton.hidden = latestGuide?.connect === undefined;
      connectActions.hidden = connectButton.hidden && addressLink.hidden;
      if (latestStatus !== undefined) error.observe(latestStatus);
      drawNotice();
    }
  }

  function drawNotice(): void {
    const shown = error.current();
    notice.textContent = shown?.sentence ?? "";
    notice.title = shown?.detail ?? "";
    notice.hidden = shown === undefined;
  }

  return {
    element,
    autoSent: () => autoSent,
    render(guide, status) {
      latestStatus = status;
      latestGuide = guide;
      title.textContent = guide.heading;
      line.textContent = guide.line;
      list.hidden = guide.steps.length === 0;
      for (const row of rows) {
        const step = guide.steps.find((candidate) => candidate.key === row.key);
        row.item.hidden = step === undefined;
        // Open FluxIQ belongs to the approve step, and stays while the approval code waits.
        if (row.key === "approve") openActions.hidden = step === undefined || step.state === "done";
        if (row.key === "start") {
          changeActions.hidden = step?.change !== true;
          if (step?.change !== true) change.close();
        }
        if (step === undefined) continue;
        row.item.dataset.state = step.state;
        row.mark.textContent = step.state === "done" ? "✓" : MARKS[row.key];
        row.name.textContent = step.title;
        row.state.textContent = STATE_WORDS[step.state];
        row.text.textContent = step.line ?? "";
        row.text.hidden = step.line === undefined;
      }
      connectButton.hidden = guide.connect === undefined || autoRunning;
      connectButton.textContent = guide.connect?.label ?? "Connect";
      connectButton.dataset.action = guide.connect?.action ?? "connect";
      connectButton.className = guide.connect?.action === "disconnect" ? "small-button" : "primary-button";
      addressLink.hidden = !guide.addressLink;
      connectActions.hidden = connectButton.hidden && addressLink.hidden;
      approveBlock.hidden = guide.pairingCode === undefined;
      waitingForApproval = guide.pairingCode !== undefined;
      code.textContent = guide.pairingCode ?? "";
      if (status !== undefined) {
        open.observe(status);
        keyOpen.observe(status);
        if (error.observe(status)) drawNotice();
      }
      // FluxIQ is found and nothing has asked it yet: ask, once. The Connect button is the retry if this fails or is cancelled.
      if (guide.autoConnect && !autoSent && !pending) {
        autoSent = true;
        autoRunning = true;
        connectButton.hidden = true;
        connectActions.hidden = addressLink.hidden;
        void press("connect");
      }
    }
  };
}
