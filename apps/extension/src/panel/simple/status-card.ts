// The status card: is FluxIQ connected and working? (UI audit, section 4,
// "1. Status card".) The words are `connectionCopy`, the buttons
// `statusControls`; this file puts them on screen and sends what is pressed.
//
// A failed Connect or Cancel is said in this card and stays until its cause is
// gone -- the connection comes up, or ends, as the button asked -- or the
// person presses again. The raw `lastError` is never shown here; its sentence
// is the state's own ("Can't reach FluxIQ"), and the raw text is in Advanced.

import { RUNTIME_MESSAGES } from "../../shared/constants";
import type { ExtensionStatus } from "../../shared/protocol";
import { connectionCopy, EXTENSION_RESTARTED } from "../copy";
import { createElement } from "../dom";
import type { PanelViewContext } from "../shell";
import { createOpenFluxIQButton } from "./open-fluxiq-button";
import { createPairingCard } from "./pairing-card";
import { statusControls, type StatusAction } from "./status-controls";
import { createStickyError } from "./sticky-error";

/** The mounted status card. */
export type StatusCard = {
  readonly element: HTMLElement;
  render(status: ExtensionStatus): void;
  /** Says the background did not answer; the next status to arrive ends it. */
  showNoAnswer(detail?: string): void;
};

/** Creates the status card. */
export function createStatusCard(context: PanelViewContext): StatusCard {
  const { store } = context;
  const error = createStickyError<ExtensionStatus>();

  const dot = createElement("span", { className: "dot dot-grey", attrs: { "aria-hidden": "true" } });
  const sentence = createElement("h2", { className: "card-title", text: "Checking the connection..." });
  const line = createElement("p", { className: "card-line", hidden: true });
  const addressLink = createElement("button", { className: "link-button", attrs: { type: "button" }, hidden: true });
  const open = createOpenFluxIQButton(store.request, { label: "Open FluxIQ", look: "primary" });
  const pairing = createPairingCard(open);
  const notice = createElement("p", { className: "notice", hidden: true, attrs: { role: "status" } });
  // "Connect" is the exact name the Lab presses; the id is kept from the single-file popup.
  const connectButton = createElement("button", { id: "connectButton", className: "primary-button", text: "Connect", attrs: { type: "button" }, hidden: true });
  const cancelButton = createElement("button", { className: "small-button", text: "Cancel", attrs: { type: "button" }, hidden: true });
  const actions = createElement("div", { className: "card-actions" }, [connectButton, cancelButton]);
  const element = createElement("section", { className: "card simple-status", attrs: { "aria-label": "Connection", "aria-live": "polite" } }, [
    createElement("div", { className: "simple-status-row" }, [dot, createElement("div", { className: "simple-status-copy" }, [sentence, line, addressLink])]),
    pairing.element,
    notice,
    actions
  ]);

  addressLink.addEventListener("click", () => context.navigate({ mode: "advanced", tab: "connection" }));
  connectButton.addEventListener("click", () => void press("connect"));
  cancelButton.addEventListener("click", () => void press("disconnect"));
  pairing.cancelButton.addEventListener("click", () => void press("disconnect"));

  async function press(action: Exclude<StatusAction, "openFluxIQ">): Promise<void> {
    const buttons = [connectButton, cancelButton, pairing.cancelButton];
    error.clear();
    renderNotice();
    for (const button of buttons) button.disabled = true;
    const result = await store.request({ type: action === "connect" ? RUNTIME_MESSAGES.connect : RUNTIME_MESSAGES.disconnect });
    for (const button of buttons) button.disabled = false;
    if (!result.ok) {
      const done = action === "connect" ? "connected" : "disconnected";
      error.show(result.sentence, (status) => status.connectionState === done, result.detail);
    }
    renderNotice();
  }

  function renderNotice(): void {
    const shown = error.current();
    notice.textContent = shown?.sentence ?? "";
    notice.title = shown?.detail ?? "";
    notice.hidden = shown === undefined;
  }

  return {
    element,
    render(status) {
      const copy = connectionCopy(status);
      const controls = statusControls(status);
      dot.className = `dot dot-${copy.dot}`;
      sentence.textContent = copy.sentence;
      // While pairing, the line follows the code, inside the pairing card.
      line.textContent = copy.line ?? "";
      line.hidden = copy.line === undefined || controls.pairing;
      addressLink.textContent = controls.addressLink ?? "";
      addressLink.hidden = controls.addressLink === undefined;
      pairing.render(status);
      open.observe(status);

      const connect = controls.pairing ? undefined : controls.buttons.find((button) => button.action === "connect");
      const cancel = controls.pairing ? undefined : controls.buttons.find((button) => button.action === "disconnect");
      connectButton.hidden = connect === undefined;
      connectButton.textContent = connect?.label ?? "Connect";
      cancelButton.hidden = cancel === undefined;
      error.observe(status);
      renderNotice();
    },
    showNoAnswer(detail) {
      error.show(EXTENSION_RESTARTED, () => true, detail);
      renderNotice();
    }
  };
}
