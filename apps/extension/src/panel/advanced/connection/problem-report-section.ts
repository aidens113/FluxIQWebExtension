// "Report a problem" on the Connection tab (plan 4.8): asks the background for
// its redacted diagnostic bundle, copies it, and offers it as a file, so a
// person can attach it to a report. What happened stays on screen until they
// press again (audit defect F1).

import { RUNTIME_MESSAGES } from "../../../shared/constants";
import { createElement } from "../../dom";
import type { PanelViewContext } from "../../shell";
import { PROBLEM_REPORT_COPIED, PROBLEM_REPORT_SAVE_ONLY, problemReportOutcome } from "./problem-report-plan";

export function createProblemReportSection(context: PanelViewContext): HTMLElement {
  const button = createElement("button", { id: "reportProblemButton", className: "small-button", text: "Report a problem", attrs: { type: "button" } });
  const save = createElement("a", { id: "saveProblemReport", className: "small-button", text: "Save report", hidden: true });
  const line = createElement("p", { className: "card-line", hidden: true, attrs: { role: "status" } });
  let savedUrl: string | undefined;

  async function report(): Promise<void> {
    button.disabled = true;
    line.hidden = true;
    const outcome = problemReportOutcome(await context.store.request<{ report?: unknown }>({ type: RUNTIME_MESSAGES.panelReportProblem }));
    button.disabled = false;
    if (!outcome.ok) {
      line.textContent = outcome.detail && outcome.detail !== outcome.sentence ? `${outcome.sentence} (${outcome.detail})` : outcome.sentence;
      line.hidden = false;
      save.hidden = true;
      return;
    }
    if (savedUrl) URL.revokeObjectURL(savedUrl);
    savedUrl = URL.createObjectURL(new Blob([outcome.text], { type: "application/json" }));
    save.href = savedUrl;
    save.download = outcome.fileName;
    save.hidden = false;
    const copied = await navigator.clipboard.writeText(outcome.text).then(() => true, () => false);
    line.textContent = copied ? PROBLEM_REPORT_COPIED : PROBLEM_REPORT_SAVE_ONLY;
    line.hidden = false;
  }

  button.addEventListener("click", () => void report());
  return createElement("section", { className: "problem-report" }, [
    createElement("h3", { className: "card-title", text: "Something wrong?" }),
    createElement("p", { className: "card-line", text: "Make a report you can attach when you tell us about a problem." }),
    createElement("div", { className: "card-actions" }, [button, save]),
    line
  ]);
}
