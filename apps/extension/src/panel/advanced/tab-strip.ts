// The Advanced view's four tabs as an ARIA tablist: arrow keys, Home and End
// move between them, and choosing one selects it at once. Selecting goes through
// the shell's `navigate`, so the chosen tab is remembered like the view is.

import type { AdvancedTab } from "../shell";
import { createElement } from "../dom";

/** The tabs in display order, with their labels (UI audit, section 4, "What moves to Advanced"). */
export const TAB_LABELS: ReadonlyArray<{ readonly tab: AdvancedTab; readonly label: string }> = [
  { tab: "activity", label: "Activity" },
  { tab: "recordings", label: "Recordings" },
  { tab: "step", label: "Current step" },
  { tab: "connection", label: "Connection" }
];

/** The strip's element, and a way to reflect the selected tab without firing `onSelect`. */
export type TabStrip = { readonly element: HTMLElement; select(tab: AdvancedTab): void };

/** Builds the strip; `onSelect` fires when the viewer picks a tab. */
export function createTabStrip(onSelect: (tab: AdvancedTab) => void): TabStrip {
  const buttons = TAB_LABELS.map(({ tab, label }) => createElement("button", {
    id: tabId(tab),
    className: "tab-button",
    text: label,
    attrs: { type: "button", role: "tab", "aria-controls": panelId(tab), "data-tab": tab }
  }));

  buttons.forEach((button, index) => {
    button.addEventListener("click", () => onSelect(TAB_LABELS[index]!.tab));
    button.addEventListener("keydown", (event) => {
      const last = buttons.length - 1;
      const target = event.key === "ArrowRight" ? (index + 1) % buttons.length
        : event.key === "ArrowLeft" ? (index + last) % buttons.length
          : event.key === "Home" ? 0
            : event.key === "End" ? last
              : undefined;
      if (target === undefined) return;
      event.preventDefault();
      buttons[target]!.focus();
      onSelect(TAB_LABELS[target]!.tab);
    });
  });

  return {
    element: createElement("div", { className: "tab-strip", attrs: { role: "tablist", "aria-label": "Advanced sections" } }, buttons),
    select(selected) {
      buttons.forEach((button, index) => {
        const on = TAB_LABELS[index]!.tab === selected;
        button.setAttribute("aria-selected", String(on));
        button.tabIndex = on ? 0 : -1;
        button.classList.toggle("active", on);
      });
    }
  };
}

/** The id of `tab`'s button, which labels its panel. */
export function tabId(tab: AdvancedTab): string {
  return `advancedTab-${tab}`;
}

/** The id of `tab`'s panel, which its button controls. */
export function panelId(tab: AdvancedTab): string {
  return `advancedPanel-${tab}`;
}
