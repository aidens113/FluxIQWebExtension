// The first-run checklist (plan 4.2, "Suggested Flow"): FluxIQ running, this
// browser approved, an AI model key set, with the one-sentence onboarding
// message above it. It is shown until the checklist is complete, and is text
// and status only: Connect and the pairing code are the status card's, just
// above, so no button here repeats one.
//
// The model key is asked for once per connection (`modelReadiness`, a relay
// this extension may not have yet; `model-key.ts` reads an unsupported reply as
// "unknown"), and the one button this card owns opens FluxIQ, where the key is
// added.

import type { ExtensionStatus } from "../../../shared/protocol";
import { createElement } from "../../dom";
import type { PanelViewContext } from "../../shell";
import { createOpenFluxIQButton } from "../open-fluxiq-button";
import { SIMPLE_RELAY_MESSAGES } from "../relay";
import { modelKeyFromReply } from "./model-key";
import { ONBOARDING_MESSAGE, setupSteps, type ModelKeyState, type SetupStepState } from "./setup-steps";

/** The mounted checklist. */
export type SetupCard = {
  readonly element: HTMLElement;
  render(status: ExtensionStatus): void;
};

const MARKS: Readonly<Record<SetupStepState, string>> = { done: "Done", waiting: "In progress", todo: "To do", check: "Check" };

/** Creates the first-run checklist. */
export function createSetupCard(context: PanelViewContext): SetupCard {
  const { store } = context;
  const list = createElement("ol", { className: "setup-steps" });
  const open = createOpenFluxIQButton(store.request, { label: "Add a key in FluxIQ", look: "small" });
  open.element.hidden = true;
  const element = createElement("section", { className: "card simple-setup", hidden: true, attrs: { "aria-label": "Get set up" } }, [
    createElement("h2", { className: "card-title", text: "Get set up" }),
    createElement("p", { className: "card-line", text: ONBOARDING_MESSAGE }),
    list,
    open.element
  ]);
  let modelKey: ModelKeyState = "unknown";
  let askedThisConnection = false;
  let latest: ExtensionStatus | undefined;

  function askForKey(): void {
    askedThisConnection = true;
    void store.request({ type: SIMPLE_RELAY_MESSAGES.modelReadiness }).then((result) => {
      modelKey = modelKeyFromReply(result);
      if (latest !== undefined) render(latest);
    });
  }

  function render(status: ExtensionStatus): void {
    latest = status;
    const connected = status.connectionState === "connected";
    if (!connected) askedThisConnection = false;
    else if (!askedThisConnection) askForKey();
    const checklist = setupSteps(status, modelKey);
    element.hidden = checklist.complete;
    list.replaceChildren(...checklist.steps.map((step) => createElement("li", { className: "setup-step", attrs: { "data-state": step.state } }, [
      createElement("span", { className: "setup-mark", text: MARKS[step.state] }),
      createElement("span", { className: "setup-copy" }, [
        createElement("strong", { text: step.title }),
        ...(step.line === undefined ? [] : [createElement("span", { className: "card-line", text: step.line })])
      ])
    ])));
    open.element.hidden = !connected || modelKey === "present";
    open.observe(status);
  }

  return { element, render };
}
