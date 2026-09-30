// The automations tab (plan 3.1, 3.5, 3.9): the person's saved automations,
// newest first, each with what its last run did. Choosing one opens it in the
// chat (`choose`), where the strip (`automation-strip.ts`) shows its runs,
// Run, its data and Open in FluxIQ. Below the list, the ways to make a new
// one: describe it in the chat, or record it (`newAutomation`, the recording
// module's). A recording that just ended is reviewed at the top (`review`).
//
// What it knows and asks for is `createAutomationsController`. The list is
// read when the tab becomes active while connected, when the connection comes
// back while it is active, after a run, and on a slow timer while active and
// the page visible. Nothing is read while the panel is hidden or offline.

import type { ExtensionStatus } from "../../shared/protocol";
import { createElement } from "../dom";
import { createOpenFluxIQButton } from "../open-fluxiq";
import type { PanelContext } from "../shell";
import { createAutomationStrip, type AutomationStrip } from "./automation-strip";
import { createAutomationsController, type AutomationRowView } from "./controller";
import { downloadFile } from "./download-file";
import { automationRowElement } from "./row-element";
import "./automations.css";

/** How often the list is re-read while the panel is visible; never faster than 15s. */
const REFRESH_MS = 30_000;

/** What the tab is given: where a choice goes, and the recording module's parts. */
export type AutomationsTabHooks = {
  /** The person chose `row`: open it in the chat. */
  choose(row: AutomationRowView): void;
  /** The review of a recording that just ended, shown at the top. */
  readonly review: HTMLElement;
  /** Record a new automation, and extract data, shown under the list. */
  readonly newAutomation: HTMLElement;
};

/** The mounted tab, and the strip it feeds above the chat. */
export type AutomationsTab = {
  readonly element: HTMLElement;
  readonly strip: AutomationStrip;
  render(status: ExtensionStatus): void;
  /** Starts or stops reading the list; starting reads it at once when connected. */
  setActive(active: boolean): void;
  /** Whether FluxIQ is working, held steady by the shell; Run waits while it is. */
  setWorking(working: boolean): void;
};

/** Builds the automations tab. */
export function createAutomationsTab(context: PanelContext, hooks: AutomationsTabHooks): AutomationsTab {
  const request = context.store.request;
  const controller = createAutomationsController(request, { onChange: () => draw(), download: downloadFile });
  const strip = createAutomationStrip(request, controller);

  const offline = createElement("p", { className: "card-line", text: "Connect to FluxIQ to see your automations.", hidden: true });
  const loading = createElement("p", { className: "card-line", text: "Loading your automations...", hidden: true });
  const empty = createElement("p", { className: "card-line", text: "No automations yet. Describe one in the chat, or record it below.", hidden: true });
  const readNotice = createElement("p", { className: "notice", hidden: true, attrs: { role: "status" } });
  const list = createElement("ul", { className: "automations-list", hidden: true, attrs: { "aria-label": "Your automations" } });
  const fallbackOpen = createOpenFluxIQButton(request, { label: "Open FluxIQ", look: "small" });
  const fallback = createElement("div", { className: "automations-fallback", hidden: true }, [
    createElement("p", { className: "card-line", text: "Your saved automations are in FluxIQ." }),
    fallbackOpen.element
  ]);
  const element = createElement("section", { className: "automations-screen", hidden: true, attrs: { "aria-label": "Automations" } }, [
    createElement("div", { className: "automations-column" }, [
      hooks.review,
      createElement("h2", { className: "automations-title", text: "Your automations" }),
      offline,
      loading,
      empty,
      readNotice,
      list,
      fallback,
      hooks.newAutomation
    ])
  ]);

  let active = false;
  let timer: ReturnType<typeof setInterval> | undefined;

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
    list.replaceChildren(...(state.mode === "list" ? state.rows : []).map((row) => automationRowElement(row, hooks.choose)));
    strip.draw();
  }

  function stopTimer(): void {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  }

  draw();

  return {
    element,
    strip,
    render(status) {
      fallbackOpen.observe(status);
      strip.render(status);
      if (controller.observe(status) && active) void controller.refresh();
    },
    setWorking: (working) => controller.setWorking(working),
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
