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

import type { TasksScreen } from "@fluxiq/ui-components";
import type { ExtensionStatus } from "../../shared/protocol";
import { createElement } from "../dom";
import { createOpenFluxIQButton } from "../open-fluxiq";
import type { PanelContext } from "../shell";
import { createAutomationStrip, type AutomationStrip } from "./automation-strip";
import { createAutomationsController, type AutomationRowView } from "./controller";
import { downloadFile } from "./download-file";
import { automationRowElement } from "./row-element";
import { createSearchBox } from "./search-box";
import { createSegments, type SegmentName } from "./segments";
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
  /**
   * The person's tasks (`panel/tasks`). With this or `library`, the tab gains a search box over
   * everything and a Tasks / Library switch; without either it is the plain list below.
   */
  readonly tasks?: TasksScreen;
  /** The subflow library (`panel/library`), shown under the Library segment. `search` and `onMatches` are how one box reaches it. */
  readonly library?: {
    readonly element: HTMLElement;
    search(text: string): void;
    setActive(active: boolean): void;
    onMatches(listener: (count: number | null) => void): void;
  };
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
  /** Shows the Tasks segment with its list (not an open task), where New automation is. */
  showTasks(): void;
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
  const heading = createElement("h2", { className: "automations-title", text: "Your automations", attrs: { tabindex: "-1" } });
  empty.setAttribute("tabindex", "-1");
  const { tasks, library } = hooks;
  const segmented = tasks !== undefined || library !== undefined;
  const noMatch = createElement("p", { className: "card-line", hidden: true });
  const automationParts = [heading, offline, loading, empty, readNotice, ...(segmented ? [noMatch] : []), list, fallback, hooks.newAutomation];
  const names: SegmentName[] = library === undefined ? ["tasks"] : ["tasks", "library"];
  let text = "";
  let segment: SegmentName = "tasks";
  let taskMatches: number | null = null;
  let taskOpen = false;
  const searchBox = createSearchBox((typed) => {
    text = typed;
    tasks?.search(typed);
    library?.search(typed);
    draw();
  });
  const segments = createSegments(names, (name) => {
    segment = name;
    applyView();
  });
  const controls = createElement("div", { className: "automations-controls" }, [searchBox.element, ...(names.length > 1 ? [segments.element] : [])]);
  const automationsGroup = createElement("div", { className: "automations-group" }, automationParts);
  const tasksPane = createElement("div", { className: "automations-pane", attrs: { "data-pane": "tasks" } }, [...(tasks === undefined ? [] : [tasks.element]), automationsGroup]);
  const libraryPane = createElement("div", { className: "automations-pane", hidden: true, attrs: { "data-pane": "library" } }, library === undefined ? [] : [library.element]);
  const column = createElement("div", { className: "automations-column" }, segmented ? [hooks.review, controls, tasksPane, libraryPane] : [hooks.review, ...automationParts]);
  const element = createElement("section", { className: "automations-screen", hidden: true, attrs: { "aria-label": "Automations" } }, [column]);
  tasks?.onMatches((count) => {
    taskMatches = count;
    syncCounts();
  });
  tasks?.onOpenChange((open) => {
    taskOpen = open;
    applyView();
  });
  library?.onMatches((count) => segments.setCount("library", text.trim() === "" ? null : count));

  const mountedRows = new Map<string, ReturnType<typeof automationRowElement>>();
  let rowOrder: string[] = [];
  let renderedOwner = controller.state().ownerRevision;
  let active = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  function draw(): void {
    const state = controller.state();
    if (renderedOwner !== state.ownerRevision) {
      for (const mounted of mountedRows.values()) mounted.remove();
      mountedRows.clear(); rowOrder = []; renderedOwner = state.ownerRevision;
    }
    const shown = state.mode === "list" ? matching(state.rows) : [];
    const noneMatch = state.mode === "list" && state.rows.length > 0 && shown.length === 0;
    const focusTarget = reconcileRows(shown, state.mode === "empty" ? empty : heading);
    noMatch.hidden = !noneMatch;
    noMatch.textContent = noneMatch ? `No automations match “${text.trim()}”.` : "";
    offline.hidden = state.mode !== "offline";
    loading.hidden = state.mode !== "loading" || state.readError !== undefined;
    empty.hidden = state.mode !== "empty";
    fallback.hidden = state.mode !== "fallback";
    readNotice.textContent = state.readError?.sentence ?? "";
    readNotice.title = state.readError?.detail ?? "";
    readNotice.hidden = state.readError === undefined || state.mode === "offline";
    list.hidden = state.mode !== "list" || noneMatch;
    syncCounts();
    syncTimer();
    strip.draw();
    if (focusTarget && active && !element.hidden && document.visibilityState === "visible" && document.activeElement !== focusTarget) {
      focusTarget.focus({ preventScroll: true });
    }
  }

  /** The automations whose name has the search text; all of them when nothing is typed. */
  function matching(rows: readonly AutomationRowView[]): readonly AutomationRowView[] {
    const wanted = text.trim().toLowerCase();
    return wanted === "" ? rows : rows.filter((row) => row.name.toLowerCase().includes(wanted));
  }

  /** The Tasks segment counts its tasks and its automations; both are searched by the one box. */
  function syncCounts(): void {
    if (!segmented) return;
    const state = controller.state();
    const searching = text.trim() !== "";
    const automations = state.mode === "list" ? matching(state.rows).length : 0;
    segments.setCount("tasks", searching && (taskMatches !== null || automations > 0) ? (taskMatches ?? 0) + automations : null);
  }

  /** Which segment shows, and whether an open task takes the whole tab. */
  function applyView(): void {
    controls.hidden = taskOpen;
    automationsGroup.hidden = taskOpen;
    tasksPane.hidden = segment !== "tasks";
    libraryPane.hidden = segment !== "library" || taskOpen;
    segments.select(segment);
    library?.setActive(active && segment === "library" && !taskOpen);
  }

  function reconcileRows(rows: readonly AutomationRowView[], fallbackTarget: HTMLElement): HTMLElement | undefined {
    const previousOrder = rowOrder;
    const focusedId = previousOrder.find((id) => mountedRows.get(id)?.button === document.activeElement);
    const focusedIndex = focusedId === undefined ? -1 : previousOrder.indexOf(focusedId);
    const ids = new Set(rows.map((row) => row.flowId));
    for (const [id, mounted] of mountedRows) {
      if (!ids.has(id)) { mounted.remove(); mountedRows.delete(id); }
    }
    for (const [index, row] of rows.entries()) {
      let mounted = mountedRows.get(row.flowId);
      if (mounted === undefined) {
        const owner = renderedOwner;
        const created = automationRowElement(row, (chosen) => {
          const state = controller.state();
          if (owner === state.ownerRevision && mountedRows.get(chosen.flowId) === created && state.mode === "list" && state.rows.some((current) => current.flowId === chosen.flowId)) hooks.choose(chosen);
        });
        mounted = created;
        mountedRows.set(row.flowId, mounted);
      } else mounted.update(row);
      // Leave correctly placed nodes untouched; moving a focused node may blur it.
      if (list.children[index] !== mounted) list.insertBefore(mounted, list.children[index] ?? null);
    }
    rowOrder = rows.map((row) => row.flowId);
    if (focusedId === undefined) return undefined;
    const nextId = mountedRows.has(focusedId) ? focusedId
      : previousOrder.slice(focusedIndex + 1).find((id) => ids.has(id))
        ?? previousOrder.slice(0, focusedIndex).reverse().find((id) => ids.has(id))
        ?? rowOrder[0];
    return (nextId === undefined ? undefined : mountedRows.get(nextId)?.button) ?? fallbackTarget;
  }

  function stopTimer(): void {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  }

  function syncTimer(): void {
    const mode = controller.state().mode;
    if (!active || document.visibilityState !== "visible" || mode === "fallback" || mode === "offline") { stopTimer(); return; }
    if (timer === undefined) timer = setInterval(() => {
      if (active && document.visibilityState === "visible") void controller.refresh();
    }, REFRESH_MS);
  }

  applyView();
  draw();

  return {
    element,
    strip,
    render(status) {
      fallbackOpen.observe(status);
      strip.render(status);
      if (controller.observe(status) && active && document.visibilityState === "visible") void controller.refresh();
      syncTimer();
      tasks?.restore();
    },
    setWorking: (working) => controller.setWorking(working),
    showTasks() {
      segment = "tasks";
      tasks?.back();
      applyView();
    },
    setActive(next) {
      if (next === active) return;
      active = next;
      tasks?.setActive(next);
      if (next) tasks?.restore();
      applyView();
      stopTimer();
      if (!next) return;
      if (document.visibilityState === "visible") void controller.refresh();
      syncTimer();
    }
  };
}
