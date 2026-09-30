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

/** The mounted strip. */
export type AutomationStrip = {
  readonly element: HTMLElement;
  /** Shows `automation`, or hides the strip for undefined. */
  show(automation: { readonly flowId: string; readonly name: string } | undefined): void;
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
  let shown: { readonly flowId: string; readonly name: string } | undefined;
  let lastStatus: ExtensionStatus | undefined;
  let noticeButtons: OpenFluxIQButton[] = [];

  run.addEventListener("click", () => {
    if (shown !== undefined) void controller.run(shown.flowId);
  });

  function exportLine(row: AutomationRowView): HTMLElement[] {
    const runId = row.runId;
    if (runId === undefined) return [];
    return row.datasets.map((dataset) => {
      const label = dataset.label ?? "Data";
      const count = dataset.recordCount === undefined ? "" : ` (${dataset.recordCount} row${dataset.recordCount === 1 ? "" : "s"})`;
      const button = (format: ExportFormat, text: string): HTMLButtonElement => {
        const made = createElement("button", { className: "link-button", text, attrs: { type: "button", "aria-label": `Export ${label} as ${text}` } });
        made.disabled = row.exporting;
        made.addEventListener("click", () => void controller.exportDataset(row.flowId, runId, dataset.datasetId, format));
        return made;
      };
      return createElement("span", { className: "strip-dataset" }, [`${label}${count}: `, button("csv", "CSV"), " · ", button("json", "JSON")]);
    });
  }

  function draw(): void {
    element.hidden = shown === undefined;
    if (shown === undefined) return;
    const state = controller.state();
    const row = state.rows.find((candidate) => candidate.flowId === shown?.flowId);
    lines.textContent = row === undefined
      ? (state.mode === "offline" ? "Connect to FluxIQ to see its runs." : "")
      : row.running || row.runId === undefined ? row.lines.join(" · ") : `Last run: ${row.lines.join(" · ")}`;
    const blocked = row?.running ? undefined : state.runtimeBusy || state.runInFlight ? "Wait for FluxIQ to finish." : undefined;
    run.textContent = row?.running ? "Running..." : "Run";
    run.disabled = row === undefined || row.running || blocked !== undefined || state.mode !== "list";
    run.setAttribute("aria-label", `Run ${row?.name ?? shown.name}`);
    hint.textContent = blocked ?? "";
    hint.hidden = blocked === undefined;
    const datasets = row === undefined || row.running ? [] : exportLine(row);
    exports.replaceChildren(...datasets);
    exports.hidden = datasets.length === 0;
    noticeButtons = [];
    notice.replaceChildren();
    notice.hidden = row?.notice === undefined;
    if (row?.notice !== undefined) {
      notice.append(row.notice.sentence);
      notice.title = row.notice.detail ?? "";
      if (row.notice.openFluxIQ) {
        const button = createOpenFluxIQButton(request, { label: "Open FluxIQ", look: "link" });
        if (lastStatus !== undefined) button.observe(lastStatus);
        noticeButtons.push(button);
        notice.append(button.element);
      }
    }
  }

  return {
    element,
    show(automation) {
      shown = automation;
      void controller.focus(automation?.flowId);
      draw();
    },
    draw,
    render(status) {
      lastStatus = status;
      open.observe(status);
      for (const button of noticeButtons) button.observe(status);
    }
  };
}
