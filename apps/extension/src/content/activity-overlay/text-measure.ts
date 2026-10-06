// How the overlay learns how wide its lines are, on a real page.
//
// The width a line may take is its node's own box (`clientWidth`), which the
// pill's fixed shape sets and no text changes; the width a sentence takes is
// measured on an `OffscreenCanvas` in the line's font, which reads nothing
// of the page and adds no node to it. Where either cannot be had -- a page
// not laid out yet, a browser with no `OffscreenCanvas`, a test's fake DOM --
// it answers 0 or undefined, and the line is drawn whole (`fit-line.ts`).

/** What the pill measures its lines with; a test passes its own. */
export type OverlayTextMeasure = {
  /** The width, in CSS pixels, `node`'s box gives its content and padding; 0 when it has none yet. */
  widthOf(node: HTMLElement): number;
  /** The width `text` takes set in `font` (a CSS `font` shorthand); undefined when it cannot be measured here. */
  measure(text: string, font: string): number | undefined;
};

type Context = { font: string; measureText(text: string): { width: number } };

let context: Context | null | undefined;

/** The page's own measure: the node's box and an offscreen canvas. */
export const browserTextMeasure: OverlayTextMeasure = Object.freeze({
  widthOf(node: HTMLElement): number {
    const width = node.clientWidth;
    return typeof width === "number" && Number.isFinite(width) ? width : 0;
  },
  measure(text: string, font: string): number | undefined {
    const drawing = canvasContext();
    if (drawing === null) return undefined;
    if (drawing.font !== font) drawing.font = font;
    return drawing.measureText(text).width;
  }
});

function canvasContext(): Context | null {
  if (context !== undefined) return context;
  const Offscreen = (globalThis as { OffscreenCanvas?: new (width: number, height: number) => { getContext(kind: "2d"): Context | null } }).OffscreenCanvas;
  try {
    context = typeof Offscreen === "function" ? new Offscreen(1, 1).getContext("2d") : null;
  } catch {
    // A page whose policy refuses the canvas keeps the style's ellipsis.
    context = null;
  }
  return context;
}
