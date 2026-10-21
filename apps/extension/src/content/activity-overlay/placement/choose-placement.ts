// Where the overlay goes: a place in a top or bottom band of the viewport's
// edge where it covers the least the person may need -- first anything that
// stays put over the content (a cookie banner, a chat widget, a sticky header,
// a dialog), then the page's own content and controls (a header, a logo, the
// navigation, buttons, fields, text, images) -- and, among places that cover
// equally little, the full pill nearest its corner (U3 of the t174 live lane's
// UI review, the supervisor's review #7: the bottom-left pill sat over
// company-website's cookie banner).
//
// It never shrinks to a text-less dot. Until 2026-10-02 it did, whenever every
// corner held a fixed part, and on a busy page that was the common case: lane
// D's run-murdouox-c5294247 showed a 30-pixel dot, no status readable, at
// three of nine moments. The user's rule is that the status is readable on
// the page whenever FluxIQ works.
//
// Covering a part of the page is a matter of what the person watching can
// see, never of what the automation can do: the overlay takes no pointer, so
// a hit test and a click pass through it, and the cover checks skip it by its
// marker (`../status-pill.ts`, `../tests/cover-detection.test.ts`). So when no
// place is clear, the least of the page is covered and the words stay.
//
// Pure: the page is reached only through `probe`, which says what lies under
// one point, so the choice is tested against synthetic rectangles in Node.
// How long a better place must stay better before the overlay moves is
// `placement-keeper.ts`'s.
//
// The rules:
//
// 0. **The left side first, whatever it covers.** The side panel opens on the
//    right, and in the Lab's emulated viewport it covers the right 400 pixels
//    of the page without narrowing it (t191 round 1), so a pill on the right
//    can sit wholly under it (screenshot 00004 of the run-murwd8le-79e735a8 UI
//    review). The right corners are searched only when every left corner,
//    full pill or narrow, lies wholly on fixed parts of the page (a left rail
//    from top to bottom).
// 1. **Only the top and bottom bands of the edge.** A place is a corner,
//    moved in from its top or bottom edge by `offset` at most so far that the
//    pill's far side stays within `EDGE_REACH` of the viewport's height from
//    that edge. The vertical middle of the edge is never a place: round 5 of
//    the breadth reruns saw the pill jump between the top (y 16), the left
//    midpoint (y 318) and the bottom (y 620), and a pill in the middle sits on
//    whatever the page is about. A corner is tried at its edge, **docked** one
//    margin past each fixed band it overlaps (above a fixed Add to cart bar,
//    below a sticky header: D5 of the run-musp4h2f-72e8ed99 UI review), and,
//    when none of those is clear, **slid** in from its edge in `SLIDE_STEP`s
//    past the page's own header or footer.
// 2. **What it covers ranks ahead of where it is.** Places are ranked by the
//    share of their sampled points that lie on fixed parts, then the share on
//    controls and content (a scrolling header, a logo, the navigation, text:
//    round 5 saw the pill over the site's logo and header at the top-left,
//    chosen only because that corner held nothing fixed), then the full pill
//    before the narrow one, then nearest the edge, then the left corners
//    before the right and the bottom before the top. Shares, not counts: the
//    narrow pill has fewer points, and on a page of text from edge to edge it
//    covers no less of it than the full pill does.
// 3. **A place held is kept unless another is clearly better**: one with a
//    smaller share on fixed parts; one with at most half the share on
//    controls and content the place held has; or one that covers as much and is the full pill where a
//    narrow one is held, or the same corner nearer its edge. A point or two of
//    text more or less is no reason to move, so places that cover about as
//    much never trade the pill between them.

/** A corner of the viewport the overlay is pinned to. */
export type OverlayAnchor = "bottom-left" | "top-left" | "bottom-right" | "top-right";

/**
 * Where the overlay is, and whether it is the full pill or the narrower one a
 * busy page leaves room for. Both carry the words. `offset`, set only when it
 * is not 0, is how many pixels further in from its top or bottom edge it sits.
 */
export type OverlayPlacement = { readonly shape: "pill" | "narrow"; readonly anchor: OverlayAnchor; readonly offset?: number };

/** What lies under one point: a fixed or sticky part of the page, an ordinary control, content a person reads (text, an image), or nothing. */
export type PointCover = "fixed" | "control" | "content" | null;

export type PlacementInput = {
  /** The viewport's client area, scrollbars excluded. */
  readonly viewport: { readonly width: number; readonly height: number };
  /** The pill's box in its current mode. */
  readonly box: { readonly width: number; readonly height: number };
  /** The narrower pill's box in the current mode, for a page with no clear place for the full one. */
  readonly narrow: { readonly width: number; readonly height: number };
  /** The gap between the overlay and the viewport's edge. */
  readonly margin: number;
  readonly probe: (x: number, y: number) => PointCover;
  /** Where the overlay is now, if it is up. */
  readonly current?: OverlayPlacement | undefined;
};

/** Every corner, in the order a tie is broken: the left side first (rule 0), the bottom before the top. */
const CORNERS: readonly OverlayAnchor[] = ["bottom-left", "top-left", "bottom-right", "top-right"];
/** The corners on the left side, where the side panel never covers the pill (rule 0). */
const LEFT_CORNERS: readonly OverlayAnchor[] = ["bottom-left", "top-left"];
const SHAPES: readonly OverlayPlacement["shape"][] = ["pill", "narrow"];
/** Horizontal spacing; readable text is normally wider than this. */
const SAMPLE_STEP = 36;
/** Confirm a clear-looking box densely enough to catch thin readable lines. */
const VERTICAL_SAMPLE_STEP = 12;
/** Points are sampled this far inside the box's edge, where a neighbour's anti-aliased border cannot count. */
const SAMPLE_INSET = 2;
/** A place's far side stays within this share of the viewport's height from its own edge (rule 1). */
const EDGE_REACH = 0.4;
/** The step, in pixels, of a corner slid in from its edge (rule 1). */
const SLIDE_STEP = 28;
/** How many fixed bands, one past another, a docked corner steps past. */
const DOCK_STEPS = 3;
/** The step, in pixels, of the scan for a fixed band's inner edge. */
const EDGE_STEP = 2;

/** Of a place's sampled points, how many lie on fixed parts and on controls or content, and the shares they make of all of them. */
type Cost = { readonly fixed: number; readonly covered: number; readonly points: number; readonly fixedShare: number; readonly coveredShare: number };
type Size = PlacementInput["box"];
type Candidate = { readonly placement: OverlayPlacement; readonly cost: Cost; readonly rank: readonly number[] };

/** The placement for `input`: the place held while no other is clearly better, else the best place (rules 0 to 3). Always a pill with its words. */
export function choosePlacement(input: PlacementInput): OverlayPlacement {
  const page: PlacementInput = { ...input, probe: memoised(input.probe) };
  const corners = leftSideFixed(page) ? CORNERS : LEFT_CORNERS;
  const best = bestPlace(page, corners);
  const { current } = input;
  if (!current || !corners.includes(current.anchor) || !withinReach(page, sizeOf(page, current.shape), current.offset ?? 0)) return best.placement;
  const held = candidate(page, corners, current.anchor, current.shape, current.offset ?? 0);
  return clearlyBetter(best, held) ? best.placement : held.placement;
}

/** Rules 1 and 2: the best-ranked place among `corners`, at their edge, docked, and, when none of those is clear, slid. */
function bestPlace(input: PlacementInput, corners: readonly OverlayAnchor[]): Candidate {
  const tried: Candidate[] = [];
  for (const anchor of corners) {
    for (const shape of SHAPES) {
      tried.push(candidate(input, corners, anchor, shape, 0));
      const docked = dockOffset(input, anchor, sizeOf(input, shape));
      if (docked !== undefined) tried.push(candidate(input, corners, anchor, shape, docked));
    }
  }
  if (!tried.some((next) => isClear(next.cost))) {
    for (const anchor of corners) {
      for (const shape of SHAPES) {
        const size = sizeOf(input, shape);
        for (let offset = SLIDE_STEP; withinReach(input, size, offset); offset += SLIDE_STEP) tried.push(candidate(input, corners, anchor, shape, offset));
      }
    }
  }
  return tried.reduce((best, next) => (before(next.rank, best.rank) ? next : best));
}

function candidate(input: PlacementInput, corners: readonly OverlayAnchor[], anchor: OverlayAnchor, shape: OverlayPlacement["shape"], offset: number): Candidate {
  const cost = costAt(input, anchor, sizeOf(input, shape), offset);
  const placement: OverlayPlacement = offset > 0 ? { shape, anchor, offset } : { shape, anchor };
  return { placement, cost, rank: [cost.fixedShare, cost.coveredShare, shape === "pill" ? 0 : 1, offset, corners.indexOf(anchor)] };
}

/** Rule 3: whether `best` is worth leaving the place held for. */
function clearlyBetter(best: Candidate, held: Candidate): boolean {
  if (best.cost.fixedShare !== held.cost.fixedShare) return best.cost.fixedShare < held.cost.fixedShare;
  if (best.cost.coveredShare < held.cost.coveredShare) return best.cost.coveredShare * 2 <= held.cost.coveredShare;
  if (best.cost.coveredShare > held.cost.coveredShare) return false;
  const wider = best.placement.shape === "pill" && held.placement.shape === "narrow";
  const nearerItsEdge = best.placement.anchor === held.placement.anchor && best.placement.shape === held.placement.shape && (best.placement.offset ?? 0) < (held.placement.offset ?? 0);
  return wider || nearerItsEdge;
}

/** Rule 0: every left corner, full or narrow, lies wholly on fixed parts of the page. Stops at the first that does not. */
function leftSideFixed(input: PlacementInput): boolean {
  for (const shape of SHAPES) {
    for (const anchor of LEFT_CORNERS) {
      const cost = costAt(input, anchor, sizeOf(input, shape));
      if (cost.fixed < cost.points) return false;
    }
  }
  return true;
}

function isClear(cost: Cost): boolean {
  return cost.fixed === 0 && cost.covered === 0;
}

function sizeOf(input: PlacementInput, shape: OverlayPlacement["shape"]): Size {
  return shape === "pill" ? input.box : input.narrow;
}

/** Rule 1: a box `size` high, `offset` in from its edge, keeps its far side within the reach. */
function withinReach(input: PlacementInput, size: Size, offset: number): boolean {
  return Number.isFinite(offset) && offset >= 0 && input.margin + offset + size.height <= input.viewport.height * EDGE_REACH;
}

/**
 * Rule 1: how far in from its edge the corner's box must move to sit one
 * margin past every fixed band it overlaps, or `undefined` when the corner is
 * clear of fixed parts already, or clearing it takes the box past the reach.
 */
function dockOffset(input: PlacementInput, anchor: OverlayAnchor, size: Size): number | undefined {
  const fromBottom = anchor.startsWith("bottom");
  const { viewport } = input;
  let offset = 0;
  for (let step = 0; step <= DOCK_STEPS; step += 1) {
    const rect = rectAt(input, anchor, size, offset);
    let edge: number | undefined;
    for (const y of samples(rect.top, rect.bottom)) {
      for (const x of samples(rect.left, rect.right)) {
        if (input.probe(x, y) !== "fixed") continue;
        const inner = bandEdge(input, x, y, fromBottom ? -EDGE_STEP : EDGE_STEP);
        edge = edge === undefined ? inner : fromBottom ? Math.min(edge, inner) : Math.max(edge, inner);
      }
    }
    if (edge === undefined) return offset === 0 ? undefined : offset;
    if (step === DOCK_STEPS) return undefined;
    // Bottom: the box's bottom one margin above the band; top: its top one margin below it.
    offset = Math.ceil(fromBottom ? viewport.height - edge : edge);
    if (!withinReach(input, size, offset)) return undefined;
  }
  return undefined;
}

/** From a fixed point, the first `y` stepping by `dy` that is not fixed: the band's inner edge. */
function bandEdge(input: PlacementInput, x: number, y: number, dy: number): number {
  let at = y;
  while (at > 0 && at < input.viewport.height && input.probe(x, at) === "fixed") at += dy;
  return at;
}

/** Whether `left` ranks strictly ahead of `right`, compared term by term. */
function before(left: readonly number[], right: readonly number[]): boolean {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index]! < right[index]!;
  }
  return false;
}

/** The box `size` pinned at `anchor`, `offset` further in from its top or bottom edge, in viewport coordinates, clipped to the viewport. */
function rectAt(input: PlacementInput, anchor: OverlayAnchor, size: Size, offset = 0): { left: number; top: number; right: number; bottom: number } {
  const { viewport, margin } = input;
  const width = Math.min(size.width, Math.max(0, viewport.width - 2 * margin));
  const height = Math.min(size.height, Math.max(0, viewport.height - 2 * margin));
  const left = anchor.endsWith("right") ? viewport.width - margin - width : margin;
  const top = anchor.startsWith("top") ? margin + offset : viewport.height - margin - offset - height;
  return { left, top, right: left + width, bottom: top + height };
}

function costAt(input: PlacementInput, anchor: OverlayAnchor, size: Size, offset = 0): Cost {
  const rect = rectAt(input, anchor, size, offset);
  const coarse = sampledCost(input, rect, SAMPLE_STEP);
  return isClear(coarse) ? sampledCost(input, rect, VERTICAL_SAMPLE_STEP) : coarse;
}

/** Occupied places need no fine pass; confirm only places that could otherwise hide a thin line. */
function sampledCost(input: PlacementInput, rect: ReturnType<typeof rectAt>, verticalStep: number): Cost {
  let fixed = 0;
  let covered = 0;
  let points = 0;
  for (const x of samples(rect.left, rect.right)) {
    for (const y of samples(rect.top, rect.bottom, verticalStep)) {
      points += 1;
      const cover = input.probe(x, y);
      if (cover === "fixed") fixed += 1;
      else if (cover !== null) covered += 1;
    }
  }
  return { fixed, covered, points, fixedShare: fixed / points, coveredShare: covered / points };
}

/** Evenly spaced points from `start` to `end`, both edges included, at most `step` apart. */
function samples(start: number, end: number, step = SAMPLE_STEP): number[] {
  const from = start + SAMPLE_INSET;
  const to = end - SAMPLE_INSET;
  if (to <= from) return [Math.round((start + end) / 2)];
  const count = Math.ceil((to - from) / step) + 1;
  return Array.from({ length: count }, (_, index) => Math.round(from + ((to - from) * index) / (count - 1)));
}

/** `probe`, asked once per point: the places tried overlap, and one check asks many of the same points. */
function memoised(probe: PlacementInput["probe"]): PlacementInput["probe"] {
  const known = new Map<number, PointCover>();
  return (x, y) => {
    // Points are whole pixels inside a viewport far narrower than 100,000 pixels.
    const key = y * 100_000 + x;
    if (known.has(key)) return known.get(key) ?? null;
    const cover = probe(x, y);
    known.set(key, cover);
    return cover;
  };
}
