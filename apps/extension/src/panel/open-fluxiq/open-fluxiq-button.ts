// An "Open in FluxIQ panel" button: asks the background to open the FluxIQ web address
// in a tab (`panelOpenFluxIQ`). Several places need one -- the getting-started
// steps, the chat's fallback and turns, the automations tab and settings --
// and each shows its own failure beside it, which ends when the person presses
// again or changes the FluxIQ web address.

import { RUNTIME_MESSAGES } from "../../shared/constants";
import type { ExtensionStatus } from "../../shared/protocol";
import { createElement } from "../dom";
import { createStickyError, type PanelStore } from "../state";
import type { PanelOpenFluxIQRequest } from "../../shared/protocol";

/** A mounted Open FluxIQ button and its failure line. */
export type OpenFluxIQButton = {
  readonly element: HTMLElement;
  /** Reads the latest status, so a failure ends once the web address changes. */
  observe(status: ExtensionStatus): void;
  /** Opens FluxIQ as pressing the button does (a host action from the key card). */
  press(): void;
};

/**
 * How the button looks: its words, and whether it is a primary button, a
 * small one, a link, or the top bar's icon (the words are then its name and
 * tooltip). `silent` draws no button: the host presses it with `press`, and only a failure shows.
 */
export type OpenFluxIQStyle = {
  label: string;
  look: "primary" | "small" | "link" | "icon" | "silent";
  canOpen?: () => boolean;
  /** What the chat opens it for: a model key to add goes straight to the keys page; a question only FluxIQ can show opens the web address. */
  purpose?: OpenFluxIQPurpose | (() => OpenFluxIQPurpose);
};

/** The chat thread the panel should land on: both ids, or none. */
export type OpenFluxIQConversation = { conversationId?: string; projectId?: string };

/** `projects` opens the panel's projects page; `pairing` opens the home page for approving this browser's connection request (its sign-in page says so). */
export type OpenFluxIQPurpose = "model-key" | "projects" | "ask" | "pairing";

const FAILED = "Couldn't open FluxIQ. Check its web address in Settings.";
const LOOKS = { primary: "primary-button", small: "small-button", link: "link-button", icon: "icon-button", silent: "small-button" } as const;

/** Sends through `request`; an optional Flow getter is read at click time. */
export function createOpenFluxIQButton(request: PanelStore["request"], style: OpenFluxIQStyle, flowId?: () => string | undefined, conversation?: () => OpenFluxIQConversation | undefined): OpenFluxIQButton {
  const error = createStickyError<ExtensionStatus>();
  const button = style.look === "icon"
    ? createElement("button", { className: LOOKS.icon, text: "↗", attrs: { type: "button", "aria-label": style.label, title: style.label } })
    : createElement("button", { className: LOOKS[style.look], text: style.label, hidden: style.look === "silent", attrs: { type: "button" } });
  const notice = createElement("p", { className: "notice", hidden: true, attrs: { role: "status" } });
  const element = createElement("span", { className: "open-fluxiq" }, [button, notice]);
  let address: string | undefined;
  let pending = false;

  function render(): void {
    const shown = error.current();
    notice.textContent = shown?.sentence ?? "";
    notice.title = shown?.detail ?? "";
    notice.hidden = shown === undefined;
  }

  async function open(): Promise<void> {
    if (pending || style.canOpen?.() === false) return;
    pending = true;
    error.clear();
    render();
    button.disabled = true;
    const failedAt = address;
    try {
      // A model key is added on FluxIQ's keys page: the background opens that rather than the front page.
      const purpose = typeof style.purpose === "function" ? style.purpose() : style.purpose;
      // Typed locally: the protocol's message gains `conversationId` and `projectId` from the background's side (I6).
      const message: PanelOpenFluxIQRequest & OpenFluxIQConversation & { type: string } = { type: RUNTIME_MESSAGES.panelOpenFluxIQ, ...(purpose === "model-key" || purpose === "projects" || purpose === "pairing" ? { purpose } : {}) };
      const selectedFlowId = flowId?.();
      if (selectedFlowId !== undefined) message.flowId = selectedFlowId;
      else if (purpose === undefined || purpose === "ask") {
        // With no Flow and no page of its own to open, the panel lands on the chat the person is looking at.
        const thread = conversation?.();
        if (thread?.conversationId !== undefined && thread.projectId !== undefined) {
          message.conversationId = thread.conversationId;
          message.projectId = thread.projectId;
        }
      }
      const result = await request(message);
      if (!result.ok && address === failedAt) error.show(FAILED, (status) => status.settings?.coreApiUrl !== failedAt, result.detail);
    } catch {
      if (address === failedAt) error.show(FAILED, (status) => status.settings?.coreApiUrl !== failedAt);
    } finally {
      pending = false;
      button.disabled = false;
      render();
    }
  }
  button.addEventListener("click", () => void open());

  return {
    element,
    press: () => void open(),
    observe(status) {
      address = status.settings?.coreApiUrl;
      if (error.observe(status)) render();
    }
  };
}
