// The recent-automations card (plan 3.1, "recent automations, run controls";
// 3.5; 3.9): up to five saved automations, each with what its last run did,
// a Run button, and its data to export. What it knows and asks for is
// `createAutomationsController`; this file draws it.
//
// The list is read when the card becomes active while connected, when the
// connection comes back while it is active, after a run, and on a slow timer
// while the card is active and the page visible. The card never reads while
// hidden or offline.

import type { ExtensionStatus } from "../../../shared/protocol";
import { createElement } from "../../dom";
import type { PanelViewContext } from "../../shell";
import { createOpenFluxIQButton, type OpenFluxIQButton } from "../open-fluxiq-button";
import { automationRowElement } from "./row-element";
import { createAutomationsController } from "./controller";
import { downloadFile } from "./download-file";
import "./card.css";

/** How often the list is re-read while the card is visible; never faster than 15s. */
const REFRESH_MS = 30_000;

/** The mounted recent-automations card. */
export type AutomationsCard = {
  readonly element: HTMLElement;
  render(status: ExtensionStatus): void;
  /** Starts or stops reading the list; starting reads it at once when connected. */
  setActive(active: boolean): void;
};

/** Creates the recent-automations card for the simple view. */
export function createAutomationsCard(context: PanelViewContext): AutomationsCard {
  const request = context.store.request;
  const controller = createAutomationsController(request, { onChange: () => draw(), download: downloadFile });

  const title = createElement("h2", { className: "card-title", text: "Recent automations" });
  const offline = createElement("p", { className: "card-line", text: "Connect to FluxIQ to see your automations.", hidden: true });
  const loading = createElement("p", { className: "card-line", text: "Loading your automations...", hidden: true });
  const empty = createElement("p", { className: "card-line", text: "No automations yet. Record one or describe it above.", hidden: true });
  const readNotice = createElement("p", { className: "notice", hidden: true, attrs: { role: "status" } });
  const list = createElement("ul", { className: "automations-list", hidden: true, attrs: { "aria-label": "Recent automations" } });
  const fallbackOpen = createOpenFluxIQButton(request, { label: "Open FluxIQ", look: "small" });
  const fallback = createElement("div", { className: "automations-fallback", hidden: true }, [
    createElement("p", { className: "card-line", text: "Your saved automations are in FluxIQ." }),
    fallbackOpen.element
  ]);
  const element = createElement("section", { className: "card simple-automations", attrs: { "aria-label": "Recent automations" } }, [
    title, offline, loading, empty, readNotice, list, fallback
  ]);

  let active = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let lastStatus: ExtensionStatus | undefined;
  // The Open FluxIQ buttons inside rows; rebuilt with the rows, told every status.
  let rowButtons: OpenFluxIQButton[] = [];

  function draw(): void {
    const state = controller.state();
    offline.hidden = state.mode !== "offline";
    loading.hidden = state.mode !== "loading" || state.readError !== undefined;
    empty.hidden = state.mode !== "empty";
    fallback.hidden = state.mode !== "fallback";
    readNotice.textContent = state.readError?.sentence ?? "";
    readNotice.title = state.readError?.detail ?? "";
    readNotice.hidden = state.readError === undefined || state.mode === "offline";
    list.hidden = state.mode !== "list";
    if (state.mode === "fallback") stopTimer();

    const runBlocked = state.runtimeBusy || state.runInFlight ? "Wait for FluxIQ to finish." : undefined;
    rowButtons = [];
    list.replaceChildren(...(state.mode === "list" ? state.rows : []).map((row) => automationRowElement(row, {
      runBlocked,
      run: (flowId) => void controller.run(flowId),
      exportDataset: (flowId, runId, datasetId, format) => void controller.exportDataset(flowId, runId, datasetId, format),
      openFluxIQ: () => {
        const button = createOpenFluxIQButton(request, { label: "Open FluxIQ", look: "link" });
        if (lastStatus !== undefined) button.observe(lastStatus);
        rowButtons.push(button);
        return button.element;
      }
    })));
  }

  function stopTimer(): void {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  }

  draw();

  return {
    element,
    render(status) {
      lastStatus = status;
      fallbackOpen.observe(status);
      for (const button of rowButtons) button.observe(status);
      if (controller.observe(status) && active) void controller.refresh();
    },
    setActive(next) {
      if (next === active) return;
      active = next;
      stopTimer();
      if (!next) return;
      void controller.refresh();
      if (controller.state().mode === "fallback") return;
      timer = setInterval(() => {
        if (document.visibilityState === "visible") void controller.refresh();
      }, REFRESH_MS);
    }
  };
}
