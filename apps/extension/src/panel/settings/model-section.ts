// Settings > AI key: the shared AI-key card, in its full form. It reads the key's state through the setup port (the one
// reader, `panel/getting-started`) and shows it in place: the same words and the same single action as the chat's card.
// The extension only shows the key (the port's `canWrite` is false): the card says to add or change it in the FluxIQ
// panel, and its action opens the
// panel's Settings at AI keys. "Try now" reads again. The card follows the key as the background pushes it (no timer, no second reader). Nothing reads while the browser is not connected: the section
// says to connect instead. The pasted value is the card's and the port's business, never kept here.

import { createModelKeyCard, defaultModelKeyProviders, type ModelKeyCard, type ModelKeyHostAction } from "@fluxiq/ui-components";
import { COULD_NOT_CHECK_KEY, modelKeysPort } from "../chat/transport/ports";
import { createElement } from "../dom";
import type { SetupPort } from "../getting-started";
import { createOpenFluxIQButton, OPEN_IN_PANEL } from "../open-fluxiq";
import type { PanelContext } from "../shell";
import type { ExtensionStatus } from "../../shared/protocol";

/** What the section says while the browser is not connected. */
export const MODEL_NOT_CONNECTED = "Connect to FluxIQ to see your AI key.";

/** The mounted section. `render` follows the status; `shown` and `refresh` read the key again (settings opened, the panel came back); `hidden` stops reading. */
export type ModelSection = { readonly element: HTMLElement; render(status: ExtensionStatus): void; shown(): void; hidden(): void; refresh(): void };

/** Builds the section; `setup` is the one reader, and its absence means the port reads the readiness message itself. */
export function createModelSection(context: PanelContext, setup?: SetupPort): ModelSection {
  const { store } = context;
  // Pressed by the card's host actions; only its failure ("Couldn't open FluxIQ") shows.
  const open = createOpenFluxIQButton(store.request, { label: OPEN_IN_PANEL, look: "silent", purpose: "model-key" });
  const notConnected = createElement("p", { className: "card-line", text: MODEL_NOT_CONNECTED, hidden: true });
  const slot = createElement("div", { className: "model-section-card", hidden: true });
  const element = createElement("section", { className: "settings-group", attrs: { "aria-label": "AI key" } }, [
    createElement("h3", { className: "settings-group-title", text: "AI key" }),
    notConnected,
    slot,
    open.element
  ]);
  const read = setup === undefined
    ? undefined
    : async () => {
        const reading = await setup.readModelKey();
        return reading === "unknown" ? { ok: false as const, message: COULD_NOT_CHECK_KEY } : { ok: true as const, state: reading };
      };
  let card: ModelKeyCard | undefined;
  let connected = false;
  let visible = false;

  function onAction(action: ModelKeyHostAction): void {
    if (action === "try-now") void card?.refresh();
    else open.press();
  }

  function refresh(): void {
    if (!visible || !connected) return;
    if (card === undefined) {
      card = createModelKeyCard({ port: modelKeysPort(store.request, read, setup?.subscribeModelKey?.bind(setup)), variant: "full", providers: defaultModelKeyProviders, onAction });
      slot.append(card.element);
      return;
    }
    void card.refresh();
  }

  return {
    element,
    render(status) {
      open.observe(status);
      const now = status.connectionState === "connected";
      notConnected.hidden = now;
      slot.hidden = !now;
      if (now && !connected) {
        connected = true;
        refresh();
        return;
      }
      connected = now;
    },
    shown() {
      visible = true;
      refresh();
    },
    hidden() {
      visible = false;
    },
    refresh
  };
}
