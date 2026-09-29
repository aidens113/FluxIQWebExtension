// The simple view: the panel's default surface (UI audit, section 4). It
// answers three questions top to bottom -- is FluxIQ connected and working,
// what is it doing right now, what do I want it to do or to stop -- in four
// cards:
//
//   status-card.ts          connected or not, with the pairing card inline
//   now-card.ts             what FluxIQ is doing, with Stop or Stop recording
//   conversation/card.ts    FluxIQ Core's conversation, shown and fed
//   manual-actions.ts       Start recording
//
// Every card renders from the one PanelStore status. A one-second tick keeps
// the recording clock, the one-minute "Done" window and Stop's wait moving; it
// and the conversation's polling run only while this view is shown.

import { RUNTIME_MESSAGES } from "../../shared/constants";
import type { ExtensionStatus } from "../../shared/protocol";
import { createElement } from "../dom";
import type { PanelView, PanelViewContext } from "../shell";
import { createConversationCard } from "./conversation";
import { createManualActions } from "./manual-actions";
import { createNowCard } from "./now-card";
import { createRunStop } from "./run-stop";
import { createStatusCard } from "./status-card";
import "./simple.css";

const TICK_MS = 1_000;

/** Mounts the simple view (pinned by the UI audit, section 5). */
export function mountSimpleView(context: PanelViewContext): PanelView {
  const { store } = context;
  const statusCard = createStatusCard(context);
  const nowCard = createNowCard(context, createRunStop(store.request));
  const conversation = createConversationCard(store.request);
  const manual = createManualActions(context);
  // Until the first status arrives only the status card shows ("Checking the connection...").
  const rest = [nowCard.element, conversation.element, manual.element];
  for (const card of rest) card.hidden = true;
  const element = createElement("section", { className: "simple-view", attrs: { "aria-label": "Simple" } }, [
    statusCard.element,
    ...rest
  ]);
  let known = false;
  let tick: ReturnType<typeof setInterval> | undefined;

  function render(status: ExtensionStatus): void {
    if (!known) {
      known = true;
      nowCard.element.hidden = false;
      conversation.element.hidden = false;
    }
    statusCard.render(status);
    nowCard.render(status, Date.now());
    conversation.render(status);
    manual.render(status);
  }

  store.subscribe(render);
  // The store asks once on creation; asking here too is what lets the status
  // card say so when the background never answers (audit defect E2).
  void store.request({ type: RUNTIME_MESSAGES.getStatus }).then((result) => {
    if (!result.ok) statusCard.showNoAnswer(result.detail);
  });

  function start(): void {
    conversation.setActive(true);
    if (tick !== undefined) return;
    tick = setInterval(() => {
      const current = store.current();
      if (current !== undefined) nowCard.render(current, Date.now());
    }, TICK_MS);
  }

  function stop(): void {
    conversation.setActive(false);
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
