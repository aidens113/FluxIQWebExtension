// An item's shape: the structure that decides which field sources it offers
// (`../infer-fields.ts`).
//
// Since t752 every rendered item of a run is walked for sources, not only the
// first dozen, so a control only later rows carry can become a column. Walking
// every item of a long, uniform list would repeat the same work, so past the
// first dozen an item whose shape was already walked is skipped: two items of
// one shape offer the same sources. The shape holds structure and whether an
// element has words, never the words.

export { itemShape } from "./item-shape";
