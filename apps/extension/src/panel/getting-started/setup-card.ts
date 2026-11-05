// The setup card: shown above the chat once the browser is connected and the model key
// is missing or locked. It takes the place of the chat's own key line while it shows
// (`getting-started.css` hides that line), so nothing about the key is told twice, and it
// leaves the composer reachable: the Lab connects, adds its key just before it types, and
// must never wait on a screen. "Not now" puts the reminder back in the chat's line for
// the rest of this panel session. Hidden by CSS whenever the chat's empty state is not on
// screen, so a chat holding work is never nagged.

import { createElement } from "../dom";
import { createOpenFluxIQButton } from "../open-fluxiq";
import type { PanelContext } from "../shell";
import type { ExtensionStatus } from "../../shared/protocol";
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
  const element = createElement("section", { className: "setup-card", hidden: true, attrs: { "aria-label": "One more step", "aria-live": "polite" } }, [
    createElement("p", { className: "setup-card-done", text: `✓ ${DONE_LINE}` }),
    title,
    line,
    createElement("div", { className: "start-actions" }, [open.element, later])
  ]);
  let dismissed = false;
  let latest: StartGuide | undefined;

  later.addEventListener("click", () => {
    dismissed = true;
    if (latest !== undefined) draw(latest);
  });

  function draw(guide: StartGuide): void {
    const current = guide.steps.find((step) => step.state === "current");
    element.hidden = dismissed || !guide.card || current === undefined;
    if (element.hidden || current === undefined) return;
    title.textContent = current.title;
    line.textContent = current.line ?? "";
  }

  return {
    element,
    render(guide, status) {
      latest = guide;
      if (status !== undefined) open.observe(status);
      draw(guide);
    }
  };
}
