// Where the overlay goes: the corner of the viewport where it covers no part
// of the page that stays put over the content -- a cookie banner, a chat
// widget, a sticky header, a dialog -- and, failing every corner, the
// least-busy place on the viewport's edge, still as a pill that carries its
// words (U3 of the t174 live lane's UI review, the supervisor's review #7: the
// bottom-left pill sat over company-website's cookie banner).
//
// It never shrinks to a text-less dot. Until 2026-10-02 it did, whenever every
// corner held a fixed part, and on a busy page -- a social feed with a sticky
// header, a fixed bottom bar and a chat dock, a store -- that was the common
// case: lane D's run-murdouox-c5294247 showed a 30-pixel dot, no status
// readable, at three of nine moments. The user's rule is that the status is
// readable on the page whenever FluxIQ works.
//
// Covering a fixed part is a matter of what the person watching can see, never
// of what the automation can do: the overlay takes no pointer, so a hit test
// and a click pass through it, and the cover checks skip it by its marker
// (`../status-pill.ts`, `../tests/cover-detection.test.ts`). So when no place
// is clear, the least of the page is covered and the words stay.
//
// Pure: the page is reached only through `probe`, which says what lies under
// one point, so the choice is tested against synthetic rectangles in Node.
//
// The rules:
//
// 0. **The left side first, whatever it covers.** The side panel opens on the
//    right, and in the Lab's emulated viewport it covers the right 400 pixels
//    of the page without narrowing it (t191 round 1), so a pill on the right
//    can sit wholly under it: screenshot 00004 of the run-murwd8le-79e735a8 UI
//    review, where a sticky category column on the left sent the pill to the
//    right midpoint, out of sight. The status must be readable whether the
//    panel is open or not, so the rules below choose among the left corners
//    and the left midpoint only; the right side is searched as well only when
//    every place on the left, full pill or narrow, lies wholly on fixed parts
//    of the page (a left rail from top to bottom).
// 1. A corner is **busy** when any sampled point of the pill's box there lies
//    on a fixed or sticky part of the page. Ordinary content scrolls away from
//    under the pill, so it only breaks ties: among clear corners the one over
//    the fewest controls wins, and after that the first in `CORNERS` order. The
//    left corners come first because the side panel opens on the right and, in
//    the Lab's emulated viewport, covers the right 400 pixels of the page
//    without narrowing it (t191 round 1).
// 2. **The overlay stays put while its corner is clear.** A corner it already
//    holds is kept for as long as nothing fixed moves under it, so scrolling
//    past links never makes it hop between corners.
// 3. When every corner is busy it takes the **least-busy place**: of the
//    corners and the side midpoints, with the full pill or a narrower one, the
//    one over the fewest fixed points; then the full pill before the narrow
//    one, so more of the words fit; then the place it already holds, so
//    controls scrolling past do not move it (rule 2); then the fewest
//    controls; then `FALLBACK_ANCHORS` order. The narrow pill keeps
//    the same lines; a line that does not fit ends in an ellipsis.

/** A place on the viewport's edge the overlay is pinned to. */
export type OverlayAnchor = "bottom-left" | "top-left" | "bottom-right" | "top-right" | "left" | "right";

/** Where the overlay is, and whether it is the full pill or the narrower one a busy page leaves room for. Both carry the words. */
export type OverlayPlacement = { readonly shape: "pill" | "narrow"; readonly anchor: OverlayAnchor };

/** What lies under one point: a fixed or sticky part of the page, an ordinary control, or nothing in the way. */
export type PointCover = "fixed" | "control" | null;

export type PlacementInput = {
  /** The viewport's client area, scrollbars excluded. */
  readonly viewport: { readonly width: number; readonly height: number };
  /** The pill's box in its current mode. */
  readonly box: { readonly width: number; readonly height: number };
  /** The narrower pill's box in the current mode, for a page with no clear corner. */
  readonly narrow: { readonly width: number; readonly height: number };
  /** The gap between the overlay and the viewport's edge. */
  readonly margin: number;
  readonly probe: (x: number, y: number) => PointCover;
  /** Where the overlay is now, if it is up. */
  readonly current?: OverlayPlacement | undefined;
};

const CORNERS: readonly OverlayAnchor[] = ["bottom-left", "top-left", "bottom-right", "top-right"];
/** Every place a busy page is searched for, the left side first (rule 1). */
const FALLBACK_ANCHORS: readonly OverlayAnchor[] = ["bottom-left", "top-left", "left", "bottom-right", "top-right", "right"];
/** The most pixels between two sampled points along either side of a box. */
const SAMPLE_STEP = 36;
/** Points are sampled this far inside the box's edge, where a neighbour's anti-aliased border cannot count. */
const SAMPLE_INSET = 2;

/** The places on the left side, where the side panel never covers the pill (rule 0). */
const LEFT_CORNERS: readonly OverlayAnchor[] = ["bottom-left", "top-left"];
const LEFT_ANCHORS: readonly OverlayAnchor[] = ["bottom-left", "top-left", "left"];

type Cost = { readonly fixed: number; readonly controls: number; readonly points: number };

/** The placement for `input`: a clear corner, the corner already held, or the least-busy place. Always a pill with its words. */
export function choosePlacement(input: PlacementInput): OverlayPlacement {
  return leftSideFixed(input) ? placeAmong(input, CORNERS, FALLBACK_ANCHORS) : placeAmong(input, LEFT_CORNERS, LEFT_ANCHORS);
}

/** Rules 1 to 3 over `corners` and, when every one of them is busy, `places`. */
function placeAmong(input: PlacementInput, corners: readonly OverlayAnchor[], places: readonly OverlayAnchor[]): OverlayPlacement {
  const { current } = input;
  if (current?.shape === "pill" && corners.includes(current.anchor) && costAt(input, current.anchor, input.box).fixed === 0) return current;
  let best: { anchor: OverlayAnchor; controls: number } | undefined;
  for (const anchor of corners) {
    const cost = costAt(input, anchor, input.box);
    if (cost.fixed > 0) continue;
    if (!best || cost.controls < best.controls) best = { anchor, controls: cost.controls };
  }
  if (best) return { shape: "pill", anchor: best.anchor };
  return leastBusy(input, places);
}

/** Rule 0: every place on the left, full or narrow, lies wholly on fixed parts of the page. Stops at the first that does not. */
function leftSideFixed(input: PlacementInput): boolean {
  for (const shape of ["pill", "narrow"] as const) {
    for (const anchor of LEFT_ANCHORS) {
      const cost = costAt(input, anchor, shape === "pill" ? input.box : input.narrow);
      if (cost.fixed < cost.points) return false;
    }
  }
  return true;
}

/** Rule 3: every corner is busy, so the place and width that cover the least, the words kept. */
function leastBusy(input: PlacementInput, places: readonly OverlayAnchor[]): OverlayPlacement {
  const { current } = input;
  let chosen: { placement: OverlayPlacement; rank: readonly number[] } | undefined;
  for (const anchor of places) {
    for (const shape of ["pill", "narrow"] as const) {
      const cost = costAt(input, anchor, shape === "pill" ? input.box : input.narrow);
      const held = current?.shape === shape && current.anchor === anchor ? 0 : 1;
      const rank = [cost.fixed, shape === "pill" ? 0 : 1, held, cost.controls];
      if (!chosen || before(rank, chosen.rank)) chosen = { placement: { shape, anchor }, rank };
    }
  }
  return chosen?.placement ?? { shape: "pill", anchor: "bottom-left" };
}

/** Whether `left` ranks strictly ahead of `right`, compared term by term. */
function before(left: readonly number[], right: readonly number[]): boolean {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index]! < right[index]!;
  }
  return false;
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
  let points = 0;
  for (const x of samples(rect.left, rect.right)) {
    for (const y of samples(rect.top, rect.bottom)) {
      points += 1;
      const cover = input.probe(x, y);
      if (cover === "fixed") fixed += 1;
      else if (cover === "control") controls += 1;
    }
  }
  return { fixed, controls, points };
}

/** Evenly spaced points from `start` to `end`, both edges included, at most `SAMPLE_STEP` apart. */
function samples(start: number, end: number): number[] {
  const from = start + SAMPLE_INSET;
  const to = end - SAMPLE_INSET;
  if (to <= from) return [Math.round((start + end) / 2)];
  const count = Math.ceil((to - from) / SAMPLE_STEP) + 1;
  return Array.from({ length: count }, (_, index) => Math.round(from + ((to - from) * index) / (count - 1)));
}
