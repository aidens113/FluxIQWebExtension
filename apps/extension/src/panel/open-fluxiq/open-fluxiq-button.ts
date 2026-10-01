// An "Open FluxIQ" button: asks the background to open the FluxIQ web address
// in a tab (`panelOpenFluxIQ`). Several places need one -- the getting-started
// steps, the chat's fallback and turns, the automations tab and settings --
// and each shows its own failure beside it, which ends when the person presses
// again or changes the FluxIQ web address.

import { RUNTIME_MESSAGES } from "../../shared/constants";
import type { ExtensionStatus } from "../../shared/protocol";
import { createElement } from "../dom";
import { createStickyError, type PanelStore } from "../state";

/** A mounted Open FluxIQ button and its failure line. */
export type OpenFluxIQButton = {
  readonly element: HTMLElement;
  /** Reads the latest status, so a failure ends once the web address changes. */
  observe(status: ExtensionStatus): void;
};

/**
 * How the button looks: its words, and whether it is a primary button, a
 * small one, a link, or the top bar's icon (the words are then its name and
 * tooltip).
 */
export type OpenFluxIQStyle = { label: string; look: "primary" | "small" | "link" | "icon" };

const FAILED = "Couldn't open FluxIQ. Check its web address in Settings.";
const LOOKS = { primary: "primary-button", small: "small-button", link: "link-button", icon: "icon-button" } as const;

/** Creates an Open FluxIQ button that sends through `request`. */
export function createOpenFluxIQButton(request: PanelStore["request"], style: OpenFluxIQStyle): OpenFluxIQButton {
  const error = createStickyError<ExtensionStatus>();
  const button = style.look === "icon"
    ? createElement("button", { className: LOOKS.icon, text: "↗", attrs: { type: "button", "aria-label": style.label, title: style.label } })
    : createElement("button", { className: LOOKS[style.look], text: style.label, attrs: { type: "button" } });
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
    if (pending) return;
    pending = true;
    error.clear();
    render();
    button.disabled = true;
    const failedAt = address;
    try {
      const result = await request({ type: RUNTIME_MESSAGES.panelOpenFluxIQ });
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
    observe(status) {
      address = status.settings?.coreApiUrl;
      if (error.observe(status)) render();
    }
  };
}
