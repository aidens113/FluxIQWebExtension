// A drawing, as a capture sends it: what a control with no words draws, as one
// versioned digest (`apps/extension/src/content/identity/drawing.ts`).
//
// The extension computes it from the page's own shapes and image sources, so
// it holds no page text and passes no secret screen: it is a token of the
// extension's, `d<version>.` and a base-36 hash. Anything else in its place is
// not a drawing and is dropped, so a capture can never put page text into a
// saved identity under this name.

/** A versioned digest: the version, a dot, and a short base-36 hash. */
const DRAWING_TOKEN = /^d\d{1,3}\.[0-9a-z]{1,16}$/u;

/** The drawing a capture sent, or `undefined` when it sent none or sent something that is not one. */
export function webElementDrawing(value: unknown): string | undefined {
  return typeof value === "string" && DRAWING_TOKEN.test(value) ? value : undefined;
}
