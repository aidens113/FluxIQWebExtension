// One activity row of the stream. A row with more than its title is a
// `<details>` whose summary is the title and whose body is the text, the tool
// or node id, and the status; one with only a title is a plain line. Text goes
// in through `textContent` only.

import { createElement } from "../../dom";
import type { ActivityRow } from "./stream-items";

const KIND_LABELS: Readonly<Record<ActivityRow["kind"], string>> = {
  thought: "Thought",
  tool: "Tool",
  step: "Step",
  check: "Check",
  ask: "Question",
  note: "Note"
};

const STATUS_LABELS: Readonly<Record<NonNullable<ActivityRow["status"]>, string>> = {
  started: "Working",
  succeeded: "Done",
  failed: "Failed"
};

/** The row's element. `open` sets whether it starts expanded; `onToggle` hears the person expand or collapse it. */
export function activityRowElement(row: ActivityRow, open: boolean, onToggle: (open: boolean) => void): HTMLElement {
  const kind = createElement("span", { className: "chat-row-kind", text: KIND_LABELS[row.kind] ?? row.kind });
  const title = createElement("span", { className: "chat-row-title", text: row.title });
  const status = row.status === undefined ? [] : [createElement("span", { className: "chat-row-status", text: STATUS_LABELS[row.status] ?? row.status })];
  const head: HTMLElement[] = [kind, title, ...status];
  const attrs = { "data-kind": row.kind, "data-status": row.status ?? "none" };
  if (!row.expandable) {
    return createElement("li", { className: "chat-row", attrs }, [createElement("div", { className: "chat-row-head" }, head)]);
  }
  const body: HTMLElement[] = [createElement("p", { className: "chat-row-detail-title", text: row.title })];
  if (row.text !== undefined) body.push(createElement("p", { className: "chat-row-text", text: row.text }));
  if (row.ref !== undefined) body.push(detailLine("Ref", row.ref, "chat-row-ref"));
  if (row.status !== undefined) body.push(detailLine("Status", STATUS_LABELS[row.status] ?? row.status));
  const details = createElement("details", { className: "chat-row-details" }, [
    createElement("summary", { className: "chat-row-head" }, head),
    createElement("div", { className: "chat-row-body" }, body)
  ]);
  details.open = open;
  details.addEventListener("toggle", () => onToggle(details.open));
  return createElement("li", { className: "chat-row", attrs }, [details]);
}

function detailLine(name: string, value: string, valueClass?: string): HTMLElement {
  return createElement("p", { className: "chat-row-line" }, [
    createElement("span", { className: "chat-row-name", text: `${name}: ` }),
    createElement("span", valueClass === undefined ? { text: value } : { className: valueClass, text: value })
  ]);
}
