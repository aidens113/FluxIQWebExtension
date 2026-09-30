// Where the overlay goes: the corner of the viewport where it covers no part
// of the page that stays put over the content -- a cookie banner, a chat
// widget, a sticky header, a dialog -- and, failing every corner, a small dot
// at the place that covers least (U3 of the t174 live lane's UI review, and
// the supervisor's review #7: the bottom-left pill sat over company-website's
// cookie banner).
//
// Pure: the page is reached only through `probe`, which says what lies under
// one point, so the choice is tested against synthetic rectangles in Node.
//
// The rules:
//
// 1. A corner is **busy** when any sampled point of the pill's box there lies
//    on a fixed or sticky part of the page. Ordinary content scrolls away from
//    under the pill, so it only breaks ties: among clear corners the one over
//    the fewest controls (links, buttons, fields) wins, and after that the
//    first in `CORNERS` order. The left corners come first because the side
//    panel opens on the right and, in the Lab's emulated viewport, covers the
//    right 400 pixels of the page without narrowing it (t191 round 1).
// 2. **The overlay stays put while its corner is clear.** A corner it already
//    holds is kept for as long as nothing fixed moves under it, so scrolling
//    past links never makes it hop between corners.
// 3. When every corner is busy it becomes a **dot**: the smallest mark, at
//    whichever of the corners and side midpoints covers the least, fixed parts
//    weighing far more than controls.

/** A place on the viewport's edge the overlay is pinned to. */
export type OverlayAnchor = "bottom-left" | "top-left" | "bottom-right" | "top-right" | "left" | "right";

/** Where the overlay is, and whether it is the full pill or the dot. */
export type OverlayPlacement = { readonly shape: "pill" | "dot"; readonly anchor: OverlayAnchor };

/** What lies under one point: a fixed or sticky part of the page, an ordinary control, or nothing in the way. */
export type PointCover = "fixed" | "control" | null;

export type PlacementInput = {
  /** The viewport's client area, scrollbars excluded. */
  readonly viewport: { readonly width: number; readonly height: number };
  /** The pill's box in its current mode. */
  readonly box: { readonly width: number; readonly height: number };
  /** The dot's diameter. */
  readonly dot: number;
  /** The gap between the overlay and the viewport's edge. */
  readonly margin: number;
  readonly probe: (x: number, y: number) => PointCover;
  /** Where the overlay is now, if it is up. */
  readonly current?: OverlayPlacement | undefined;
};

const CORNERS: readonly OverlayAnchor[] = ["bottom-left", "top-left", "bottom-right", "top-right"];
const DOT_ANCHORS: readonly OverlayAnchor[] = [...CORNERS, "left", "right"];

/** How much more one fixed point weighs than one control when a dot looks for the least-busy place. */
const FIXED_WEIGHT = 100;
/** The most pixels between two sampled points along either side of a box. */
const SAMPLE_STEP = 36;
/** Points are sampled this far inside the box's edge, where a neighbour's anti-aliased border cannot count. */
const SAMPLE_INSET = 2;

type Cost = { readonly fixed: number; readonly controls: number };

/** The placement for `input`: a clear corner, the corner already held, or a dot. */
export function choosePlacement(input: PlacementInput): OverlayPlacement {
  const { current } = input;
  if (current?.shape === "pill" && CORNERS.includes(current.anchor) && costAt(input, current.anchor, input.box).fixed === 0) return current;
  let best: { anchor: OverlayAnchor; controls: number } | undefined;
  for (const anchor of CORNERS) {
    const cost = costAt(input, anchor, input.box);
    if (cost.fixed > 0) continue;
    if (!best || cost.controls < best.controls) best = { anchor, controls: cost.controls };
  }
  if (best) return { shape: "pill", anchor: best.anchor };
  const dotBox = { width: input.dot, height: input.dot };
  let dot: { anchor: OverlayAnchor; weight: number } | undefined;
  for (const anchor of DOT_ANCHORS) {
    const cost = costAt(input, anchor, dotBox);
    const weight = cost.fixed * FIXED_WEIGHT + cost.controls;
    const keeps = current?.shape === "dot" && current.anchor === anchor;
    if (!dot || weight < dot.weight || (weight === dot.weight && keeps)) dot = { anchor, weight };
  }
  return { shape: "dot", anchor: dot?.anchor ?? "bottom-left" };
}

/** The box `size` pinned at `anchor`, in viewport coordinates, clipped to the viewport. */
function rectAt(input: PlacementInput, anchor: OverlayAnchor, size: PlacementInput["box"]): { left: number; top: number; right: number; bottom: number } {
  const { viewport, margin } = input;
  const width = Math.min(size.width, Math.max(0, viewport.width - 2 * margin));
  const height = Math.min(size.height, Math.max(0, viewport.height - 2 * margin));
  const left = anchor.endsWith("right") || anchor === "right" ? viewport.width - margin - width : margin;
  const top = anchor.startsWith("top") ? margin : anchor.startsWith("bottom") ? viewport.height - margin - height : (viewport.height - height) / 2;
  return { left, top, right: left + width, bottom: top + height };
}

function costAt(input: PlacementInput, anchor: OverlayAnchor, size: PlacementInput["box"]): Cost {
  const rect = rectAt(input, anchor, size);
  let fixed = 0;
  let controls = 0;
  for (const x of samples(rect.left, rect.right)) {
    for (const y of samples(rect.top, rect.bottom)) {
      const cover = input.probe(x, y);
      if (cover === "fixed") fixed += 1;
      else if (cover === "control") controls += 1;
    }
  }
  return { fixed, controls };
}

/** Evenly spaced points from `start` to `end`, both edges included, at most `SAMPLE_STEP` apart. */
function samples(start: number, end: number): number[] {
  const from = start + SAMPLE_INSET;
  const to = end - SAMPLE_INSET;
  if (to <= from) return [Math.round((start + end) / 2)];
  const count = Math.ceil((to - from) / SAMPLE_STEP) + 1;
  return Array.from({ length: count }, (_, index) => Math.round(from + ((to - from) * index) / (count - 1)));
}
