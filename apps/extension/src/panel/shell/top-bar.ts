// The slim top bar: FluxIQ, the Chat / Automations tabs, the record button,
// the connection dot, the gear, and Open FluxIQ.
//
// The gear keeps the id `settingsButton` and the accessible name "Settings",
// which the Lab presses. The tabs are an ARIA tablist: arrow keys, Home and End
// move between them and choosing one selects it at once. While settings or the
// getting-started steps fill the panel no tab is selected, and pressing one
// closes settings.

import type { ExtensionStatus } from "../../shared/protocol";
import { connectionCopy } from "../copy";
import { createElement } from "../dom";
import type { ShellScreen, ShellTab } from "./screen-state";

/** The mounted bar. */
export type TopBar = {
  readonly element: HTMLElement;
  /** Reflects the screen on show: the selected tab, and the gear's pressed state. */
  showScreen(screen: ShellScreen): void;
  render(status: ExtensionStatus | undefined): void;
};

/** What the bar is given: where presses go, and the controls other modules own. */
export type TopBarParts = {
  onTab(tab: ShellTab): void;
  onGear(): void;
  /** The record button (`panel/recording`). */
  readonly record: HTMLElement;
  /** The Open FluxIQ icon (`panel/open-fluxiq`). */
  readonly openFluxIQ: HTMLElement;
};

const SVG = "http://www.w3.org/2000/svg";
const TABS: ReadonlyArray<{ readonly tab: ShellTab; readonly label: string }> = [
  { tab: "chat", label: "Chat" },
  { tab: "automations", label: "Automations" }
];

/** Builds the top bar. */
export function createTopBar(parts: TopBarParts): TopBar {
  const tabs = TABS.map(({ tab, label }) => createElement("button", {
    id: tabId(tab),
    className: "top-tab",
    text: label,
    attrs: { type: "button", role: "tab", "aria-selected": "false", "aria-controls": screenId(tab), "data-tab": tab }
  }));
  tabs.forEach((button, index) => {
    button.addEventListener("click", () => parts.onTab(TABS[index]!.tab));
    button.addEventListener("keydown", (event) => {
      const last = tabs.length - 1;
      const target = event.key === "ArrowRight" ? (index + 1) % tabs.length
        : event.key === "ArrowLeft" ? (index + last) % tabs.length
          : event.key === "Home" ? 0
            : event.key === "End" ? last
              : undefined;
      if (target === undefined) return;
      event.preventDefault();
      tabs[target]!.focus();
      parts.onTab(TABS[target]!.tab);
    });
  });
  const tablist = createElement("div", { className: "top-tabs", attrs: { role: "tablist", "aria-label": "FluxIQ" } }, tabs);

  const dot = createElement("span", { className: "dot dot-grey top-dot", attrs: { role: "img", "aria-label": "Checking the connection", title: "Checking the connection" } });
  const gear = createElement("button", {
    id: "settingsButton",
    className: "icon-button top-icon",
    attrs: { type: "button", title: "Settings", "aria-label": "Settings", "aria-pressed": "false" }
  }, [gearIcon()]);
  gear.addEventListener("click", parts.onGear);

  const element = createElement("header", { className: "top-bar" }, [
    createElement("div", { className: "top-brand" }, [
      createElement("span", { className: "brand-mark", text: "F", attrs: { "aria-hidden": "true" } }),
      createElement("h1", { className: "top-name", text: "FluxIQ" })
    ]),
    tablist,
    createElement("div", { className: "top-actions" }, [parts.record, dot, gear, parts.openFluxIQ])
  ]);

  return {
    element,
    showScreen(screen) {
      tabs.forEach((button, index) => {
        const on = TABS[index]!.tab === screen;
        button.setAttribute("aria-selected", String(on));
        button.classList.toggle("active", on);
        button.tabIndex = on || (index === 0 && (screen === "settings" || screen === "getting-started")) ? 0 : -1;
      });
      gear.setAttribute("aria-pressed", String(screen === "settings"));
      gear.classList.toggle("active", screen === "settings");
    },
    render(status) {
      if (status === undefined) return;
      const copy = connectionCopy(status);
      dot.className = `dot dot-${copy.dot} top-dot`;
      dot.setAttribute("aria-label", copy.sentence);
      dot.title = copy.sentence;
    }
  };
}

/** The id of `tab`'s button, which labels its screen. */
export function tabId(tab: ShellTab): string {
  return `panelTab-${tab}`;
}

/** The id of `tab`'s screen, which its button controls. */
export function screenId(tab: ShellTab): string {
  return `panelScreen-${tab}`;
}

function gearIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const path = document.createElementNS(SVG, "path");
  path.setAttribute("fill", "currentColor");
  path.setAttribute("d", "M19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6ZM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z");
  path.setAttribute("transform", "translate(-1 0)");
  svg.append(path);
  return svg;
}
