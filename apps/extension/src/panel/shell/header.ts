// The panel header: the FluxIQ name, the Simple / Advanced switch, and the gear.
// The gear keeps the accessible name "Settings", which the Lab clicks, and opens
// Advanced on the Connection tab.

import { createElement } from "../dom";
import type { ModeSwitch } from "./mode-switch";

const SVG = "http://www.w3.org/2000/svg";

/** Builds the header around `modeSwitch`; `onSettings` fires when the gear is pressed. */
export function createHeader(modeSwitch: ModeSwitch, onSettings: () => void): HTMLElement {
  const settingsButton = createElement("button", {
    id: "settingsButton",
    className: "icon-button",
    attrs: { type: "button", title: "Settings", "aria-label": "Settings" }
  }, [gearIcon()]);
  settingsButton.addEventListener("click", onSettings);

  return createElement("header", { className: "app-header" }, [
    createElement("div", { className: "brand-mark", text: "F", attrs: { "aria-hidden": "true" } }),
    createElement("h1", { text: "FluxIQ" }),
    modeSwitch.element,
    settingsButton
  ]);
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
