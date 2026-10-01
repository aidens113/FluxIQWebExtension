// "Report a problem" in settings (plan 4.8): asks the background for
// its redacted diagnostic bundle, copies it, and offers it as a file, so a
// person can attach it to a report. What happened stays on screen until they
// press again (audit defect F1).

import { RUNTIME_MESSAGES } from "../../shared/constants";
import { createElement } from "../dom";
import type { PanelContext } from "../shell";
import { PROBLEM_REPORT_COPIED, PROBLEM_REPORT_SAVE_ONLY, problemReportOutcome } from "./problem-report-plan";

export function createProblemReportSection(context: PanelContext): HTMLElement {
  const button = createElement("button", { id: "reportProblemButton", className: "small-button", text: "Report a problem", attrs: { type: "button" } });
  const save = createElement("a", { id: "saveProblemReport", className: "small-button", text: "Save report", hidden: true });
  const line = createElement("p", { className: "card-line", hidden: true, attrs: { role: "status" } });
  let savedUrl: string | undefined;
  let pending = false;

  async function report(): Promise<void> {
    if (pending) return;
    pending = true;
    button.disabled = true;
    line.hidden = true;
    save.hidden = true;
    try {
      const outcome = problemReportOutcome(await context.store.request<{ report?: unknown }>({ type: RUNTIME_MESSAGES.panelReportProblem }));
      if (!outcome.ok) {
        line.textContent = outcome.detail && outcome.detail !== outcome.sentence ? `${outcome.sentence} (${outcome.detail})` : outcome.sentence;
        line.hidden = false;
        return;
      }
      let nextUrl: string | undefined;
      try { nextUrl = URL.createObjectURL(new Blob([outcome.text], { type: "application/json" })); }
      catch { /* best-effort: copying can deliver the report without a download */ }
      if (savedUrl) {
        try { URL.revokeObjectURL(savedUrl); }
        catch { /* best-effort: failed browser URL cleanup cannot prevent report delivery */ }
      }
      savedUrl = nextUrl;
      if (nextUrl) {
        save.href = nextUrl;
        save.download = outcome.fileName;
        save.hidden = false;
      }
      let copied = false;
      try { await navigator.clipboard.writeText(outcome.text); copied = true; }
      catch { /* best-effort: the prepared download remains available when clipboard access fails */ }
      line.textContent = copied ? PROBLEM_REPORT_COPIED : nextUrl ? PROBLEM_REPORT_SAVE_ONLY : "Couldn't copy or prepare the report here. Try again.";
      line.hidden = false;
    } catch {
      line.textContent = "Couldn't make the report here. Try again.";
      line.hidden = false;
    } finally {
      pending = false;
      button.disabled = false;
    }
  }

  button.addEventListener("click", () => void report());
  return createElement("section", { className: "problem-report" }, [
    createElement("h3", { className: "card-title", text: "Something wrong?" }),
    createElement("p", { className: "card-line", text: "Make a report you can attach when you tell us about a problem." }),
    createElement("div", { className: "card-actions" }, [button, save]),
    line
  ]);
}
