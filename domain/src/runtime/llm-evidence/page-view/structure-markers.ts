// The marker lines that say where the element lines are (t223, "Structure
// markers"), each printed where what it marks changes:
//
//  - the screen: `--- below the fold ---`, `--- above the screen ---`,
//    `--- off screen ---` and `--- on screen ---`; lines start on screen;
//  - the region: `[<frame id> <dialog handle> <landmark> <form id>]`, such as
//    `[frame 2 main]` or `[main form checkout]`, and `[page]` for no region
//    once one was named;
//  - the list item: `- i/n`, only for a list of more than one;
//  - the table row: `- row r`.
//
// A new region starts its item and row afresh, so a list that spans two
// regions says which item it is in again.

import type { WebLlmEvidenceElement } from "../elements";
import type { WebLlmEvidenceViewport } from "../page-evidence";
import { webLlmElementWhere, type WebLlmElementWhere } from "./element";

const SCREEN_MARKERS: Readonly<Record<WebLlmElementWhere, string>> = {
  "on screen": "--- on screen ---",
  below: "--- below the fold ---",
  above: "--- above the screen ---",
  "off screen": "--- off screen ---",
  // A line is only ever written for a visible element, which is neither of
  // these; were one to arrive, it is not on screen, and says so.
  "off-page": "--- off screen ---",
  "not rendered": "--- off screen ---"
};

/** A marker writer for one page: given each line's element in order, the marker lines to print before it. */
export function webLlmStructureMarkers(viewport: WebLlmEvidenceViewport | undefined): (element: WebLlmEvidenceElement) => string[] {
  let screen = SCREEN_MARKERS["on screen"];
  let region: string | undefined;
  let item: string | undefined;
  let row: number | undefined;
  return (element) => {
    const markers: string[] = [];
    const nextScreen = SCREEN_MARKERS[webLlmElementWhere(element, viewport)];
    if (nextScreen !== screen) markers.push(nextScreen);
    screen = nextScreen;
    const nextRegion = regionOf(element);
    if (nextRegion !== region) {
      if (nextRegion !== undefined) markers.push(`[${nextRegion}]`);
      else markers.push("[page]");
      region = nextRegion;
      item = undefined;
      row = undefined;
    }
    const nextItem = element.item !== undefined && element.item.total > 1 ? `${element.item.index}/${element.item.total}` : undefined;
    if (nextItem !== item && nextItem !== undefined) markers.push(`- ${nextItem}`);
    item = nextItem;
    const nextRow = element.cell?.row;
    if (nextRow !== row && nextRow !== undefined) markers.push(`- row ${nextRow}`);
    row = nextRow;
    return markers;
  };
}

function regionOf(element: WebLlmEvidenceElement): string | undefined {
  const parts = [
    element.frameId === undefined ? undefined : `frame ${element.frameId}`,
    element.inDialog === undefined ? undefined : `dialog ${element.inDialog}`,
    element.landmark,
    element.form === undefined ? undefined : `form ${element.form}`
  ].filter((part): part is string => part !== undefined);
  return parts.length > 0 ? parts.join(" ") : undefined;
}
