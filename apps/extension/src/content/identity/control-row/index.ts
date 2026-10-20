// The row a control's own kind marks out, on a page that draws its rows as
// plain markup (t463).
//
// `control-row.ts` is the rule: the largest ancestor holding the control and no
// other control alike to it, and the twin that marked its edge.
// `sole-ancestors.ts` is the climb it is read from, which `../record.ts` also
// asks directly. `captured-alike.ts` is what one capture knows about a
// control's alike controls -- one index per root, each element named once --
// so the climb inside a capture scope costs a lookup, not a walk of the page
// (t733). `control-kind.ts` says what kind of control an element is, and
// `row-bounds.ts` holds the depth and scan bounds every climb keeps to.

export { controlRow } from "./control-row";
export { soleAncestors } from "./sole-ancestors";

export type { ControlRow } from "./control-row";
export type { SoleAncestors } from "./sole-ancestors";
