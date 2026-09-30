// One folded group of work: a quiet summary line ("Worked for 2m 5s · 46
// steps") that opens to a tidy list, one line per step with its mark, title,
// tool or node id in monospace, and Core's sentence beneath when it sent one.
//
// It lives as long as its group: a render updates the summary and each step
// in place (a step is rebuilt only when it changed), so an opened fold stays
// open while steps arrive and when it moves from the live line to the turn
// that answered. Text goes in through `textContent` only.

import { createElement } from "../../dom";
import { workSummary, type ActivityRow, type WorkGroup } from "../stream";
import { placeChildren } from "./place-children";

/** The mounted fold. */
export type WorkDisclosure = {
  readonly element: HTMLElement;
  update(group: WorkGroup, working: boolean): void;
};

const MARKS: Readonly<Record<string, { mark: string; label: string }>> = {
  succeeded: { mark: "\u2713", label: "Done" },
  failed: { mark: "\u2715", label: "Failed" },
  started: { mark: "", label: "Working" },
  none: { mark: "\u2022", label: "" }
};

/** Creates an empty fold; `onToggle` hears the person open or close it. */
export function createWorkDisclosure(onToggle: () => void): WorkDisclosure {
  const label = createElement("span", { className: "chat-work-label" });
  const summary = createElement("summary", { className: "chat-work-summary" }, [label]);
  const list = createElement("ol", { className: "chat-steps" });
  const element = createElement("details", { className: "chat-work" }, [summary, list]);
  element.addEventListener("toggle", onToggle);
  const steps = new Map<string, { element: HTMLElement; signature: string }>();

  return {
    element,
    update(group, working) {
      const text = workSummary(group, working);
      if (label.textContent !== text) label.textContent = text;
      const state = working ? "working" : group.rows.some((row) => row.status === "failed") ? "failed" : "done";
      if (element.getAttribute("data-state") !== state) element.setAttribute("data-state", state);
      const wanted = group.rows.map((row) => {
        const status = row.status ?? "none";
        // A step still marked started once the work settled never finished: it shows as a plain step.
        const shown = status === "started" && !working ? "none" : status;
        const signature = `${row.sequence}|${shown}|${row.title}|${row.text ?? ""}|${row.ref ?? ""}`;
        const known = steps.get(row.key);
        if (known && known.signature === signature) return known.element;
        const made = { element: stepElement(row, shown), signature };
        steps.set(row.key, made);
        return made.element;
      });
      const keys = new Set(group.rows.map((row) => row.key));
      for (const key of [...steps.keys()]) if (!keys.has(key)) steps.delete(key);
      placeChildren(list, wanted);
    }
  };
}

function stepElement(row: ActivityRow, status: string): HTMLElement {
  const mark = MARKS[status] ?? MARKS.none!;
  const head: HTMLElement[] = [createElement("span", { className: "chat-step-title", text: row.title })];
  if (row.ref !== undefined) head.push(createElement("code", { className: "chat-step-ref", text: row.ref }));
  const copy: HTMLElement[] = [createElement("div", { className: "chat-step-head" }, head)];
  if (row.text !== undefined && row.text !== row.title) copy.push(createElement("p", { className: "chat-step-text", text: row.text, attrs: { title: row.text } }));
  const markAttrs: Record<string, string> = mark.label === "" ? { "aria-hidden": "true" } : { role: "img", "aria-label": mark.label };
  return createElement("li", { className: "chat-step", attrs: { "data-status": status, "data-kind": row.kind } }, [
    createElement("span", { className: "chat-step-mark", text: mark.mark, attrs: markAttrs }),
    createElement("div", { className: "chat-step-copy" }, copy)
  ]);
}
