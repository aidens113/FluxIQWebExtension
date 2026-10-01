// The open automation, compactly, above its chat: what its last run did, Run,
// the last run's data to export, and Open in FluxIQ for everything else. A
// slim strip, not a card: the chat keeps the panel, and the chat's own header
// names the automation and leads back to the latest chat. Hidden while the
// chat shows no automation.

import type { ExtensionStatus } from "../../shared/protocol";
import { createElement } from "../dom";
import { createOpenFluxIQButton, type OpenFluxIQButton } from "../open-fluxiq";
import type { PanelStore } from "../state";
import type { AutomationRowView, AutomationsController, ExportFormat } from "./controller";

type AutomationName = { readonly flowId: string; readonly name: string };

/** The mounted strip. */
export type AutomationStrip = {
  readonly element: HTMLElement;
  /** Shows `automation`, or hides the strip for undefined. */
  show(automation: AutomationName | undefined): void;
  /** Passive metadata for the shown flow; never a navigation request. */
  onNameChange(listener: (automation: AutomationName) => void): () => void;
  /** Draws again from the controller's state. */
  draw(): void;
  render(status: ExtensionStatus): void;
};

/** Builds the strip over `controller`. */
export function createAutomationStrip(request: PanelStore["request"], controller: AutomationsController): AutomationStrip {
  const run = createElement("button", { className: "small-button strip-run", text: "Run", attrs: { type: "button" } });
  const open = createOpenFluxIQButton(request, { label: "Open in FluxIQ", look: "link" });
  const lines = createElement("p", { className: "strip-lines" });
  const hint = createElement("p", { className: "strip-hint", hidden: true });
  const exports = createElement("span", { className: "strip-exports", hidden: true });
  const notice = createElement("div", { className: "notice", hidden: true, attrs: { role: "status" } });
  const element = createElement("section", { className: "automation-strip", hidden: true, attrs: { "aria-label": "Open automation" } }, [
    createElement("div", { className: "strip-head" }, [lines, run]),
    hint,
    createElement("div", { className: "strip-links" }, [exports, open.element]),
    notice
  ]);
  let shown: AutomationName | undefined;
  const nameListeners = new Set<(automation: AutomationName) => void>();
  let lastStatus: ExtensionStatus | undefined;
  const datasets = new Map<string, { element: HTMLElement; label: HTMLElement; buttons: HTMLButtonElement[] }>();
  const noticeText = createElement("span");
  notice.append(noticeText);
  let noticeButton: OpenFluxIQButton | undefined;
  let noticeKey: string | undefined;

  run.addEventListener("click", () => {
    if (shown !== undefined) void controller.run(shown.flowId);
  });

  function exportLine(row: AutomationRowView | undefined): HTMLElement[] {
    const keys = new Set<string>();
    const ordered: HTMLElement[] = [];
    if (row === undefined || row.running) { datasets.clear(); return ordered; }
    const runId = row.runId;
    if (runId === undefined) { datasets.clear(); return ordered; }
    for (const dataset of row.datasets) {
      const key = JSON.stringify([row.flowId, runId, dataset.datasetId]);
      if (keys.has(key)) continue;
      keys.add(key);
      const label = dataset.label ?? "Data";
      const count = dataset.recordCount === undefined ? "" : ` (${dataset.recordCount} row${dataset.recordCount === 1 ? "" : "s"})`;
      let mounted = datasets.get(key);
      if (mounted === undefined) {
        const flowId = row.flowId;
        const datasetId = dataset.datasetId;
        const caption = createElement("span");
        const buttons = (["csv", "json"] as const).map((format: ExportFormat) => {
          const button = createElement("button", { className: "link-button", text: format.toUpperCase(), attrs: { type: "button" } });
          button.addEventListener("click", () => void controller.exportDataset(flowId, runId, datasetId, format));
          return button;
        });
        mounted = { element: createElement("span", { className: "strip-dataset" }, [caption, buttons[0]!, " · ", buttons[1]!]), label: caption, buttons };
        datasets.set(key, mounted);
      }
      mounted.label.textContent = `${label}${count}: `;
      for (const button of mounted.buttons) {
        button.disabled = row.exporting;
        button.setAttribute("aria-label", `Export ${label} as ${button.textContent}`);
      }
      ordered.push(mounted.element);
    }
    for (const key of datasets.keys()) if (!keys.has(key)) datasets.delete(key);
    return ordered;
  }

  function controls(): HTMLButtonElement[] {
    return [...exports.querySelectorAll<HTMLButtonElement>("button"), ...notice.querySelectorAll<HTMLButtonElement>("button")];
  }

  function visible(node: HTMLElement): boolean {
    for (let parent: HTMLElement | null = node; parent !== null; parent = parent.parentElement) if (parent.hidden) return false;
    return node.isConnected;
  }

  function draw(): void {
    if (shown === undefined) { element.hidden = true; return; }
    const previous = controls();
    const active = element.ownerDocument.activeElement;
    const index = previous.findIndex((button) => button === active);
    const ownedFocus = index >= 0 && visible(element) && element.ownerDocument.visibilityState === "visible" && element.ownerDocument.hasFocus();
    element.hidden = false;
    const state = controller.state();
    const row = state.rows.find((candidate) => candidate.flowId === shown?.flowId);
    const renamed = row && row.name !== shown.name ? { flowId: row.flowId, name: row.name } : undefined;
    if (renamed) shown = renamed;
    const unavailable = (state.mode === "list" || state.mode === "empty") && state.readError === undefined;
    lines.textContent = row === undefined
      ? (state.mode === "offline" ? "Connect to FluxIQ to see its runs." : unavailable ? "This automation is unavailable in the current list." : "")
      : row.running || row.runId === undefined ? row.lines.join(" · ") : `Last run: ${row.lines.join(" · ")}`;
    const blocked = row?.running ? undefined : state.working || state.runInFlight ? "Wait for FluxIQ to finish." : undefined;
    run.textContent = row?.running ? "Running..." : "Run";
    run.disabled = row === undefined || row.running || blocked !== undefined || state.mode !== "list";
    run.setAttribute("aria-label", `Run ${row?.name ?? shown.name}`);
    hint.textContent = blocked ?? "";
    hint.hidden = blocked === undefined;
    const ordered = exportLine(row);
    for (const child of Array.from(exports.children)) if (!ordered.includes(child as HTMLElement)) child.remove();
    ordered.forEach((child, position) => {
      if (exports.children[position] !== child) exports.insertBefore(child, exports.children[position] ?? null);
    });
    exports.hidden = ordered.length === 0;
    notice.hidden = row?.notice === undefined;
    noticeText.textContent = row?.notice?.sentence ?? "";
    notice.title = row?.notice?.detail ?? "";
    const nextNoticeKey = row?.notice?.openFluxIQ ? JSON.stringify([row.flowId, row.runId]) : undefined;
    if (nextNoticeKey !== noticeKey) {
      noticeButton?.element.remove();
      noticeButton = undefined;
      noticeKey = nextNoticeKey;
    }
    if (row?.notice !== undefined) {
      if (row.notice.openFluxIQ && noticeButton === undefined) {
        noticeButton = createOpenFluxIQButton(request, { label: "Open FluxIQ", look: "link" });
        if (lastStatus !== undefined) noticeButton.observe(lastStatus);
        notice.append(noticeButton.element);
      }
    }
    if (ownedFocus && visible(element)) {
      const current = controls();
      const focused = previous[index]!;
      const available = (button: HTMLButtonElement) => !button.disabled && visible(button);
      const target = current.includes(focused) ? focused
        : [...previous.slice(index + 1), ...previous.slice(0, index).reverse()].find((button) => current.includes(button) && available(button))
          ?? current.find(available) ?? (available(run) ? run : open.element.querySelector<HTMLButtonElement>("button"));
      if (target !== null && target !== undefined && available(target) && element.ownerDocument.activeElement !== target) target.focus({ preventScroll: true });
    }
    if (renamed) for (const listener of [...nameListeners]) listener(renamed);
  }

  return {
    element,
    show(automation) {
      shown = automation;
      void controller.focus(automation?.flowId);
      draw();
    },
    draw,
    onNameChange(listener) {
      nameListeners.add(listener);
      return () => { nameListeners.delete(listener); };
    },
    render(status) {
      lastStatus = status;
      open.observe(status);
      noticeButton?.observe(status);
    }
  };
}
