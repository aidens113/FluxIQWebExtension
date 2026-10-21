// The pixels a fitted line keeps free at its end (`line.ts`,
// `lines.ts`).
//
// A line is measured on a canvas and drawn by the page, and the two can
// disagree by a few pixels over a line: page zoom and font hinting set text a
// little wider than the canvas measures it. A sentence fitted with no room to
// spare then overflows its last line, and the style's clamp -- the backstop --
// cuts it wherever the width runs out, inside a word: round 5 of the breadth
// reruns read "address is t…". A fixed two pixels covered a short line and not
// a long one, so the margin grows with the line: 2% of it, never under two
// pixels.

/** The least margin, in pixels. */
const MIN_MARGIN_PX = 2;
/** The margin's share of the line's width. */
const MARGIN_SHARE = 0.02;

/** The pixels kept free at the end of a line `room` pixels wide. */
export function fitMargin(room: number): number {
  return Math.max(MIN_MARGIN_PX, room * MARGIN_SHARE);
}
