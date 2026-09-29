// Holds the two mounted views and shows the one a route names, hiding the other.

import { createElement } from "../dom";
import type { PanelRoute, PanelView } from "./contracts";

/** The main area and a way to show a route in it. */
export type ViewHost = { readonly element: HTMLElement; show(route: PanelRoute): void };

/** Puts both views in one main element; nothing is shown until `show` is called. */
export function createViewHost(views: { simple: PanelView; advanced: PanelView }): ViewHost {
  const element = createElement("main", { className: "app-main" }, [views.simple.element, views.advanced.element]);
  return {
    element,
    show(route) {
      const shown = route.mode === "simple" ? views.simple : views.advanced;
      const hidden = route.mode === "simple" ? views.advanced : views.simple;
      hidden.hide();
      shown.show(route);
    }
  };
}
