// One automation in the automations tab: its name and what its last run did,
// as one button that opens it in the chat. Rebuilt whole from its view on
// every change; nothing here holds state.

import { createElement } from "../dom";
import type { AutomationRowView } from "./controller";

/** Builds the `<li>` for `row`; pressing it calls `choose`. */
export function automationRowElement(row: AutomationRowView, choose: (row: AutomationRowView) => void): HTMLLIElement {
  const button = createElement("button", { className: "automation-row", attrs: { type: "button", title: `Open ${row.name} in the chat` } }, [
    createElement("span", { className: "automation-row-text" }, [
      createElement("span", { className: "automation-row-name", text: row.name }),
      createElement("span", { className: "automation-row-line", text: row.lines[0] ?? "" })
    ]),
    createElement("span", { className: "automation-row-go", text: "›", attrs: { "aria-hidden": "true" } })
  ]);
  button.addEventListener("click", () => choose(row));
  return createElement("li", {}, [button]);
}
