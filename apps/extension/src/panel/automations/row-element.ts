// One automation in the automations tab: its name and what its last run did,
// as one button that opens it in the chat. Updates retain the mounted nodes
// and the handler reads the latest view.

import { createElement } from "../dom";
import type { AutomationRowView } from "./controller";

/** Builds the `<li>` for `row`; pressing it calls `choose`. */
export function automationRowElement(row: AutomationRowView, choose: (row: AutomationRowView) => void): HTMLLIElement & { readonly button: HTMLButtonElement; update(row: AutomationRowView): void } {
  let current = row;
  const name = createElement("span", { className: "automation-row-name", text: row.name });
  const line = createElement("span", { className: "automation-row-line", text: row.lines[0] ?? "" });
  const button = createElement("button", { className: "automation-row", attrs: { type: "button", title: `Open ${row.name} in the chat` } }, [
    createElement("span", { className: "automation-row-text" }, [
      name,
      line
    ]),
    createElement("span", { className: "automation-row-go", text: "›", attrs: { "aria-hidden": "true" } })
  ]);
  button.addEventListener("click", () => choose(current));
  return Object.assign(createElement("li", {}, [button]), {
    button,
    update(next: AutomationRowView) {
      current = next;
      if (name.textContent !== next.name) name.textContent = next.name;
      const summary = next.lines[0] ?? "";
      if (line.textContent !== summary) line.textContent = summary;
      button.setAttribute("title", `Open ${next.name} in the chat`);
    }
  });
}
