// A value the page draws in pieces, such as a price whose whole number,
// decimals and currency are sibling spans: which element states it whole, and
// which elements are its pieces. `infer-fields.ts` offers the whole as one
// column and leaves the pieces out.

export { composesValue, isComposedPiece } from "./composed-value";
