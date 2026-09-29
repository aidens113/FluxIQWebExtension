// The simple view: the panel's default surface and Simple Mode's primary
// screen (UI audit, section 4; plan 3.1). It answers, top to bottom, is FluxIQ
// connected and set up, what is it doing right now, what do I want it to do,
// and what has it done:
//
//   status-card.ts          connected or not, with the pairing card inline
//   start/setup-card.ts     the first-run checklist, until it is complete (plan 4.2)
//   now-card.ts             what FluxIQ is doing, with Stop or Stop recording
//   recording/steps/        the recording's newest steps, each removable (plan 3.3)
//   recording/review/       after a recording: analyze, preview, test, save (plan 3.3)
//   start/start-card.ts     describe it, show FluxIQ how (Start recording),
//                           extract data (the extraction sheet's entry)
//   conversation/card.ts    FluxIQ Core's conversation, shown and fed
//   automations/card.ts     recent automations, Run, what each run did, export
//                           (plan 3.1, 3.5, 3.9)
//
// Every card renders from the one PanelStore status. A one-second tick keeps
// the recording clock, the one-minute "Done" window and Stop's wait moving; it
// and the conversation's polling run only while this view is shown.

import { RUNTIME_MESSAGES } from "../../shared/constants";
import type { ExtensionStatus } from "../../shared/protocol";
import { createElement } from "../dom";
import type { PanelView, PanelViewContext } from "../shell";
import { createAutomationsCard } from "./automations";
import { createConversationCard } from "./conversation";
import { createNowCard } from "./now-card";
import { createRecordingReview, createRecordingSteps } from "./recording";
import { createRunStop } from "./run-stop";
import { createSetupCard, createStartCard } from "./start";
import { createStatusCard } from "./status-card";
import "./simple.css";

const TICK_MS = 1_000;

/** Mounts the simple view (pinned by the UI audit, section 5). */
export function mountSimpleView(context: PanelViewContext): PanelView {
  const { store } = context;
  const statusCard = createStatusCard(context);
  const nowCard = createNowCard(context, createRunStop(store.request));
  const setupCard = createSetupCard(context);
  // Both show themselves: the steps while recording, the review once a recording ends.
  const recordingSteps = createRecordingSteps(context);
  const recordingReview = createRecordingReview(context);
  const conversation = createConversationCard(store.request);
  const startCard = createStartCard(context, () => focusComposer(conversation.element));
  // Until the first status arrives only the status card shows ("Checking the connection...").
  // The setup card hides itself once its checklist is complete, so it is not in this list.
  const automations = createAutomationsCard(context);
  const rest = [nowCard.element, startCard.element, conversation.element, automations.element];
  for (const card of rest) card.hidden = true;
  const element = createElement("section", { className: "simple-view", attrs: { "aria-label": "Simple" } }, [
    statusCard.element,
    setupCard.element,
    nowCard.element,
    recordingSteps.element,
    recordingReview.element,
    startCard.element,
    conversation.element,
    automations.element
  ]);
  let known = false;
  let tick: ReturnType<typeof setInterval> | undefined;

  function render(status: ExtensionStatus): void {
    if (!known) {
      known = true;
      for (const card of rest) card.hidden = false;
    }
    statusCard.render(status);
    setupCard.render(status);
    nowCard.render(status, Date.now());
    recordingSteps.render(status);
    recordingReview.render(status);
    startCard.render(status);
    conversation.render(status);
    automations.render(status);
  }

  store.subscribe(render);
  // The store asks once on creation; asking here too is what lets the status
  // card say so when the background never answers (audit defect E2).
  void store.request({ type: RUNTIME_MESSAGES.getStatus }).then((result) => {
    if (!result.ok) statusCard.showNoAnswer(result.detail);
  });

  function start(): void {
    conversation.setActive(true);
    automations.setActive(true);
    if (tick !== undefined) return;
    tick = setInterval(() => {
      const current = store.current();
      if (current !== undefined) nowCard.render(current, Date.now());
    }, TICK_MS);
  }

  function stop(): void {
    conversation.setActive(false);
    automations.setActive(false);
    if (tick !== undefined) clearInterval(tick);
    tick = undefined;
  }

  window.addEventListener("pagehide", stop);

  return {
    element,
    show() {
      element.hidden = false;
      start();
    },
    hide() {
      element.hidden = true;
      stop();
    }
  };
}

/** "Describe an automation": the conversation's composer is where it is described. */
function focusComposer(card: HTMLElement): void {
  const box = card.querySelector<HTMLTextAreaElement>("textarea");
  if (!box) return;
  box.scrollIntoView({ block: "nearest" });
  box.focus();
}
