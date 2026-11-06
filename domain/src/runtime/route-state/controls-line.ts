// The controls line of the route state (`state.page.controls`): the name of
// every rendered control the page offers, each once, in document order, joined
// with " | ", and the heading each fell under written where it changes
// (`./control-mark.ts`). Nothing is cut and no name is changed.
//
// The heading is the capture's own `heading` for the element: the nearest
// heading before it, passed over where it only repeats the element's own words
// (a link inside its card's title). A name seen before is not written again,
// and neither is its heading.
//
// It takes the controls already read (`./project.ts` picks them and names them
// as the page view does), so this module imports nothing from the evidence.

import { webRouteMarkedControl } from "./control-mark";

const LIST_SEPARATOR = " | ";

/** A control as the line needs it: its name, and the heading the capture put it under. */
export type WebRouteControl = { readonly name: string; readonly heading?: string | undefined };

export function webRouteControlsLine(controls: readonly WebRouteControl[]): string {
  const seen = new Set<string>();
  const entries: string[] = [];
  let written: string | undefined;
  for (const control of controls) {
    const name = control.name.replace(/\s+/gu, " ").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const heading = control.heading?.replace(/\s+/gu, " ").trim() || undefined;
    if (heading !== undefined && heading !== written) {
      entries.push(webRouteMarkedControl(heading, name));
      written = heading;
    } else entries.push(name);
  }
  return entries.join(LIST_SEPARATOR);
}
