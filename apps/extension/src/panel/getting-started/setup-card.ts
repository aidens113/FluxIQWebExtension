// The setup card: shown above the chat once the browser is connected and the model key
// is missing or unavailable. It takes the place of the chat's own key line while it shows
// (`getting-started.css` hides that line), so nothing about the key is told twice, and it
// leaves the composer reachable: the Lab connects, adds its key just before it types, and
// must never wait on a screen. "Not now" hides it, and the chat's own line, for this FluxIQ
// server from then on (`model-key-dismissal.ts`). Hidden by CSS whenever the chat's empty state is not on
// screen, so a chat holding work is never nagged.

import { createElement } from "../dom";
import { createOpenFluxIQButton } from "../open-fluxiq";
import type { PanelContext } from "../shell";
import type { ExtensionStatus } from "../../shared/protocol";
import { dismissSetup, isSetupDismissed } from "./model-key-dismissal";
import type { StartGuide } from "./start";
import "./getting-started.css";

/** The mounted card. */
export type SetupCard = { readonly element: HTMLElement; render(guide: StartGuide, status: ExtensionStatus | undefined): void };

/** The line that says what is already done, true only because the card shows once the browser is connected and approved. */
const DONE_LINE = "FluxIQ is running, and this browser is connected and approved.";

/** Builds the card. */
export function createSetupCard(context: PanelContext): SetupCard {
  const open = createOpenFluxIQButton(context.store.request, { label: "Open FluxIQ", look: "small", purpose: "model-key" });
  const title = createElement("strong", { className: "setup-card-step" });
  const line = createElement("p", { className: "setup-card-line" });
  const later = createElement("button", { className: "link-button", text: "Not now", attrs: { type: "button" } });
  const element = createElement("section", { className: "setup-card", hidden: true, attrs: { "aria-label": "Model configuration", "aria-live": "polite" } }, [
    createElement("p", { className: "setup-card-done", text: `✓ ${DONE_LINE}` }),
    title,
    line,
    createElement("div", { className: "start-actions" }, [open.element, later])
  ]);
  let server = "";
  let latest: StartGuide | undefined;

  later.addEventListener("click", () => {
    dismissSetup(server);
    if (latest !== undefined) draw(latest);
  });

  function draw(guide: StartGuide): void {
    const dismissed = isSetupDismissed(server);
    // The chat's own key line stays away too once dismissed (`getting-started.css`).
    element.setAttribute("data-dismissed", dismissed ? "true" : "false");
    const current = guide.steps.find((step) => step.state === "current" || step.state === "problem");
    element.hidden = dismissed || !guide.card || current === undefined;
    if (element.hidden || current === undefined) return;
    title.textContent = current.title;
    line.textContent = current.line ?? "";
  }

  return {
    element,
    render(guide, status) {
      latest = guide;
      if (status !== undefined) server = status.gatewayUrl;
      if (status !== undefined) open.observe(status);
      draw(guide);
    }
  };
}
