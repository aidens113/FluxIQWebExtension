// One recent automation, drawn: its name, what its last run did, Run, the
// last run's exports, and the row's own message. Rebuilt whole from its view
// on every change; nothing here holds state.

import { createElement } from "../../dom";
import type { AutomationRowView, ExportFormat } from "./controller";

/** What a row's buttons do, and whether Run may be pressed now. */
export type AutomationRowActions = {
  /** Why Run is disabled, or undefined when it may be pressed. */
  runBlocked?: string | undefined;
  run(flowId: string): void;
  exportDataset(flowId: string, runId: string, datasetId: string, format: ExportFormat): void;
  /** A fresh Open FluxIQ button for the row's message. */
  openFluxIQ(): HTMLElement;
};

/** Builds the `<li>` for `row`. */
export function automationRowElement(row: AutomationRowView, actions: AutomationRowActions): HTMLLIElement {
  const name = createElement("p", { className: "automations-name", text: row.name });
  const lines = createElement("ul", { className: "automations-lines" }, row.lines.map((line) => createElement("li", { text: line })));

  const blocked = row.running ? undefined : actions.runBlocked;
  const run = createElement("button", {
    className: "small-button automations-run",
    text: row.running ? "Running..." : "Run",
    attrs: { type: "button", "aria-label": `Run ${row.name}` }
  });
  run.disabled = row.running || blocked !== undefined;
  if (blocked !== undefined) run.title = blocked;
  run.addEventListener("click", () => actions.run(row.flowId));
  const head = createElement("div", { className: "automations-head" }, [name, run]);

  const children: HTMLElement[] = [head, lines];
  if (blocked !== undefined) children.push(createElement("p", { className: "automations-hint", text: blocked }));

  const runId = row.runId;
  if (runId !== undefined && row.datasets.length > 0) {
    children.push(createElement("div", { className: "automations-exports" }, row.datasets.map((dataset) => {
      const label = dataset.label ?? "Data";
      const count = dataset.recordCount === undefined ? "" : ` (${dataset.recordCount} row${dataset.recordCount === 1 ? "" : "s"})`;
      const button = (format: ExportFormat, text: string) => {
        const element = createElement("button", {
          className: "link-button",
          text,
          attrs: { type: "button", "aria-label": `${text} of ${label}` }
        });
        element.disabled = row.exporting;
        element.addEventListener("click", () => actions.exportDataset(row.flowId, runId, dataset.datasetId, format));
        return element;
      };
      return createElement("div", { className: "automations-dataset" }, [
        createElement("span", { className: "automations-dataset-label", text: `${label}${count}` }),
        button("csv", "Export CSV"),
        button("json", "Export JSON")
      ]);
    })));
  }

  if (row.notice !== undefined) {
    const notice = createElement("div", { className: "notice", attrs: { role: "status" } }, [row.notice.sentence]);
    if (row.notice.detail !== undefined) notice.title = row.notice.detail;
    if (row.notice.openFluxIQ) notice.append(actions.openFluxIQ());
    children.push(notice);
  }
  return createElement("li", { className: "automations-row" }, children);
}
