// The overlay's lines fitted to the card: one line cut where a word ends
// (`line.ts`), a sentence wrapped onto the card's lines and shortened only
// when it fills them (`lines.ts`), both keeping a margin free at the end so a
// page that draws text a little wider than measured still fits it
// (`margin.ts`).

export { fitLine } from "./line";
export { fitLines } from "./lines";
export { fitMargin } from "./margin";
