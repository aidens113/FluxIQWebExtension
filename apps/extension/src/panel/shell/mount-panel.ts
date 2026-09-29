// The panel shell, mounted by both surfaces.
//
// `popup/index.ts` and `sidepanel/index.ts` each call `mountPanel` with the
// stub page's `#app`, their surface, and the views to host. The shell owns the
// header (name, Simple / Advanced switch, Settings gear), the one PanelStore,
// routing between the two views, and remembering the viewer's last route. It
// owns no view content: that is `panel/simple` (workstream B) and
// `panel/advanced` (workstream C), or `placeholderViews` until they land.
//
//   panel/shell/contracts.ts        the pinned seam types (PanelRoute, PanelView, ...)
//   panel/shell/mount-panel.ts      this file: store, header, routing, preference
//   panel/shell/header.ts           name, mode switch and the "Settings" gear
//   panel/shell/mode-switch.ts      the "View" radiogroup: Simple | Advanced
//   panel/shell/mode-preference.ts  fluxiq.ui.mode / fluxiq.ui.advancedTab in storage
//   panel/shell/view-host.ts        shows the routed view, hides the other
//   panel/shell/placeholder/        wave-1 views: status card, record, extract; the old
//                                   settings as Advanced, so the Lab can still set up
//   panel/state/                    PanelStore, panelRequest, PanelResult
//   panel/copy/                     connection, step and error sentences
//   panel/dom/                      createElement
//   panel/theme/tokens.css          light and dark colour tokens
//   panel/extraction/               the extraction sheet, mounted into a host
//
// The view never switches by itself, with one exception from the UI audit
// (section 4, "Switching"): while pairing is in progress the panel shows Simple,
// because the pairing card is part of the simple view.

import { createElement } from "../dom";
import { createPanelStore } from "../state";
import type { AdvancedTab, PanelRoute, PanelSurface, PanelViewContext, PanelViews } from "./contracts";
import { createHeader } from "./header";
import { readRoutePreference, writeRoutePreference } from "./mode-preference";
import { createModeSwitch } from "./mode-switch";
import { createViewHost, type ViewHost } from "./view-host";
import "../theme/tokens.css";
import "./shell.css";

const SIMPLE: PanelRoute = { mode: "simple" };

/** Mounts the panel into `root` for `surface`, hosting `views`. */
export function mountPanel(root: HTMLElement, surface: PanelSurface, views: PanelViews): void {
  document.documentElement.dataset.surface = surface;
  const store = createPanelStore();
  let route: PanelRoute = SIMPLE;
  let advancedTab: AdvancedTab = "activity";
  let viewerChose = false;
  let host: ViewHost | undefined;

  const modeSwitch = createModeSwitch((mode) => navigate(mode === "simple" ? SIMPLE : { mode: "advanced", tab: advancedTab }));
  const context: PanelViewContext = { store, navigate, surface };
  host = createViewHost({ simple: views.simple(context), advanced: views.advanced(context) });
  const header = createHeader(modeSwitch, () => navigate({ mode: "advanced", tab: "connection" }));
  root.replaceChildren(createElement("div", { className: "shell" }, [header, host.element]));
  apply(route);

  void readRoutePreference().then((stored) => {
    if (stored.mode === "advanced") advancedTab = stored.tab;
    if (!viewerChose && !pairing()) apply(stored);
  });

  store.subscribe((status) => {
    if (status.connectionState === "pairing" && route.mode !== "simple") apply(SIMPLE);
  });

  function navigate(next: PanelRoute): void {
    viewerChose = true;
    if (next.mode === "advanced") advancedTab = next.tab;
    apply(next);
    writeRoutePreference(next);
  }

  function apply(next: PanelRoute): void {
    route = next;
    modeSwitch.set(next.mode);
    host?.show(next);
  }

  function pairing(): boolean {
    return store.current()?.connectionState === "pairing";
  }
}
