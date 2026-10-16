// The layers the run itself opened, which the clearing leaves alone (t656).
//
// **Why this exists.** bigbox-retail's cart Flow (`run-mvac0ddx-f52ba929`)
// opens the header's store picker in one step, runs an optional "dismiss the
// email offer if it shows" step, then presses "Set as my store" inside the
// picker. The offer had already been closed by the defence of the picker's own
// press, so the optional step's target was missing, and the clearing for a
// missing target pressed the close glyph of the only layer left: the picker.
// The next step's button then had no box. Nothing marked the picker as the
// Flow's own -- `clearing-target.ts` spares only the layer the *current* step
// works in -- so the defence undid what the previous step did. It failed six
// trials of eight and the playback, on the timing of the site's promotion.
//
// So a press that succeeded records the layers it opened, and the clearing
// (`clearable-layers.ts`) spares them as it spares the step's own, until they
// leave. A layer is the press's when it was **not over the page before the
// press** -- or offered another way out then -- and is **tied to the pressed
// control** by the page's own structure:
//
// - **it holds the control**: the sticky header whose chip opened its flyout,
//   a disclosure widget whose summary was pressed;
// - **it is inside the control's widget**: the control sits in a shadow root,
//   and the layer is inside that root's host -- the picker's flyout and its
//   chip are one custom element;
// - **the control names it**: `aria-controls` points at the layer, or at
//   something in it, or at something around it;
// - **the control says it expanded something**: `aria-expanded="true"`, and of
//   the new layers this is the one that shares the deepest container with the
//   control below `<body>`. A tie names none.
//
// A promotion appended to `<body>` on a timer is tied by none of these, even
// when it happens to appear during the press, so it stays clearable.
//
// **Until it leaves.** Each record keeps the way out the layer offered when it
// opened. Once the layer or that way out is no longer painted, or the layer
// offers another way out, the record is dropped: the picker closed and opened
// again by something else is the page's, not the run's.
//
// Records are held weakly, by layer, so a layer the page throws away takes its
// record with it. Everything here never throws: it runs inside the defence.

import { composedContains, composedParent, shadowHostsOf } from "../../shadow-dom";
import { overlaysOverPage } from "./overlays";
import { pressableWayOut } from "./pressable-way-out";

/**
 * The layers over the page at one moment, each with the way out it offered
 * then -- or, when the page could not be read, a snapshot that says so, after
 * which no press is recorded: what is new cannot be told from what was there.
 */
type LayerSnapshot = { readonly readable: true; readonly layers: ReadonlyMap<Element, Element | undefined> } | { readonly readable: false };

/** Each layer a press opened, and the way out it offered when it did. */
const opened = new WeakMap<Element, Element>();

/** The run's own layers: noted after a press, asked by the clearing. */
export const runOpenedLayers = Object.freeze({
  /** The layers over the page now and their ways out, for `note` to tell the new ones from. */
  snapshot(): LayerSnapshot {
    try {
      return { readable: true, layers: new Map(overlaysOverPage().map((layer) => [layer, pressableWayOut(layer)] as const)) };
    } catch {
      return { readable: false };
    }
  },

  /** After a press of `control` that succeeded: records each layer over the page that is new since `before` and tied to the control. */
  note(control: Element | undefined, before: LayerSnapshot): void {
    if (!control || !before.readable) return;
    try {
      const fresh: Array<{ layer: Element; wayOut: Element }> = [];
      for (const layer of overlaysOverPage()) {
        const wayOut = pressableWayOut(layer);
        if (wayOut && !(before.layers.has(layer) && before.layers.get(layer) === wayOut)) fresh.push({ layer, wayOut });
      }
      const tied = fresh.filter(({ layer }) => heldOrInWidget(layer, control) || namedByControl(layer, control));
      const expanded = nearestExpanded(fresh.filter((entry) => !tied.includes(entry)), control);
      for (const { layer, wayOut } of expanded ? [...tied, expanded] : tied) opened.set(layer, wayOut);
    } catch {
      /* best-effort: a press that cannot be read leaves nothing spared, which is the clearing as it was */
    }
  },

  /** Whether `layer` is one a press of the run opened and it has not left. */
  has(layer: Element): boolean {
    const wayOut = opened.get(layer);
    if (!wayOut) return false;
    try {
      if (painted(layer) && painted(wayOut) && pressableWayOut(layer) === wayOut) return true;
    } catch {
      /* best-effort: a layer that cannot be read has left as far as the clearing knows, so its record is dropped below */
    }
    opened.delete(layer);
    return false;
  }
});

/** The layer holds the control, or sits inside the shadow host the control is drawn in. */
function heldOrInWidget(layer: Element, control: Element): boolean {
  if (composedContains(layer, control)) return true;
  const host = shadowHostsOf(control)[0];
  return host !== undefined && composedContains(host, layer);
}

/** The control's `aria-controls` names the layer, something in it, or something around it. */
function namedByControl(layer: Element, control: Element): boolean {
  const ids = (control.getAttribute("aria-controls") ?? "").split(/\s+/u).filter((id) => id.length > 0);
  return ids.some((id) => {
    const named = byId(control, id);
    return named !== null && (composedContains(layer, named) || composedContains(named, layer));
  });
}

/** The element with this id in the control's own tree, else in the document. */
function byId(control: Element, id: string): Element | null {
  const root = control.getRootNode() as Partial<Pick<Document, "getElementById">>;
  const found = typeof root.getElementById === "function" ? root.getElementById(id) : null;
  return found ?? (typeof document === "undefined" ? null : document.getElementById(id));
}

/**
 * When the control says it expanded something, the one new layer that shares
 * the deepest container with it below `<body>`; none on a tie, or when every
 * layer shares only the body with it.
 */
function nearestExpanded<T extends { layer: Element }>(candidates: readonly T[], control: Element): T | undefined {
  if (control.getAttribute("aria-expanded") !== "true" || candidates.length === 0) return undefined;
  const containers = containersOf(control);
  let best: T | undefined;
  let bestDepth = Number.POSITIVE_INFINITY;
  let tied = false;
  for (const candidate of candidates) {
    const depth = containers.findIndex((container) => composedContains(container, candidate.layer));
    if (depth < 0) continue;
    if (depth < bestDepth) {
      best = candidate;
      bestDepth = depth;
      tied = false;
    } else if (depth === bestDepth) tied = true;
  }
  return tied ? undefined : best;
}

/** The control's composed ancestors below `<body>`, nearest first. */
function containersOf(control: Element): Element[] {
  const containers: Element[] = [];
  for (let current = composedParent(control); current && !isPageRoot(current); current = composedParent(current)) containers.push(current);
  return containers;
}

function isPageRoot(element: Element): boolean {
  const name = element.localName;
  return name === "body" || name === "html";
}

function painted(element: Element): boolean {
  return element.isConnected !== false && element.getClientRects().length > 0;
}
