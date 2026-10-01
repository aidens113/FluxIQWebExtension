// A budget breach that ends a run the product had already failed.
//
// The budget check runs before the lane judges what the product did, and its
// `performance.budget` failure is thrown in the lane's place. That order is
// right for the category, which must stay `performance.budget`, but it threw
// the product's failure away: `run-mup2u8o3-6697c4be`'s build ended without a
// Flow (`flow_bootstrap.evidence_budget_exhausted`) after spending $0.2969 of a
// $0.25 ceiling, the breach replaced the lane's `runtime.behavior`, and the
// runner, finding no product failure, stamped the run
// `facilityFailure: scenario.execute / unclassified`.
//
// So the breach keeps the product's failure as its `cause`, which
// `run-scenario/product-failure.ts` reads to label the run the product's.

import { RunnerFailure } from "../failure.js";

/**
 * `breach` with `productFailure` as its cause, when `breach` is a budget
 * failure and `productFailure` a `runtime.behavior` one; otherwise `breach`
 * unchanged. Category, message and details are the breach's own.
 */
export function budgetOverProductFailure(breach: unknown, productFailure: unknown): unknown {
  if (!(breach instanceof RunnerFailure) || breach.category !== "performance.budget") return breach;
  if (!(productFailure instanceof RunnerFailure) || productFailure.category !== "runtime.behavior" || breach.cause !== undefined) return breach;
  const kept = new RunnerFailure(breach.category, breach.message, { cause: productFailure, ...(breach.details ? { details: breach.details } : {}) });
  if (breach.stack) kept.stack = breach.stack;
  return kept;
}
