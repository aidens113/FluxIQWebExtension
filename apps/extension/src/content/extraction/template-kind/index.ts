// A column means one kind of element in every item, whatever template the
// item is drawn from.
//
// **Until 2026-10-17 a positional column meant whatever sat at its position.**
// Field inference names an element the item gives no name of its own by its
// path, and a path step by its position among its siblings when nothing else
// tells them apart (`../infer-fields.ts`, `pathStep`). In a list whose items
// use two templates the same position holds different things: one template's
// byline is `time · audience`, the other's `author · time · audience`, so the
// key taken from the first item, `span:1 > a`, read the time in one template
// and the author's name in every item of the other, and the author's own column
// existed only in the first template (live run `run-mvczv4jn-1b61183c`, step
// 0021). A condition on the dates was tested against names and rejected every
// row.
//
// Now a positional column whose element differs in kind across items -- its
// tag, role, classes, a value-stating attribute it carries (`aria-label`,
// `datetime`), the folder its link points into (`element-kind.ts`) -- is read
// by a selector that names one kind in every item, and each other kind it met
// gets a column of its own (`kind-columns.ts`). A column whose element is the
// same kind in every item is left exactly as it was, so the keys saved Flows
// name stay theirs.

export { separateKinds, type KindSource, type PathLabel } from "./kind-columns";
