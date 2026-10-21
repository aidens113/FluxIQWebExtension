// Which of a run's measured field sources a proposal keeps (`../infer-fields.ts`).
//
// The proposal holds a bounded number of fields, and coverage alone would spend
// the bound on the columns every item has. Two kinds of partial column are
// what a read narrowing the run has to name, so each has places of its own
// before coverage spends the rest: marks only some items carry (a sponsored
// label), and, since t752, controls only some rows carry -- the per-row button
// that says a row is outside the person's set (a join, borrow or follow
// button). A control is often on few rows, so among partial columns ranked by
// coverage it came last and was cut on a feed whose first rows already offered
// more partial columns than the bound holds.

export { keptSources } from "./kept-sources";
