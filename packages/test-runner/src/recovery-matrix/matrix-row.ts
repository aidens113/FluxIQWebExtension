// One row of the state-aware recovery plan's acceptance matrix, as data.
//
// The plan (`docs/working/state-aware-recovery-plan.md`, "Acceptance matrix")
// names thirteen behaviours a Flow must show on the realistic scenarios. Row 12
// is a paid proof and is not here: every row in this table runs provider-free,
// and a run that would call a model fails its row rather than calling one.
//
// A row is one or more cases. A case is one saved Flow, one switch on the site
// (a scenario variant, a run perturbation, or neither) and one check of the
// run's own records. Row 4, for example, is three cases: the same Flow under
// the promotion that opens before the first action, the one that opens midway,
// and the one that opens on a chosen loop pass.

import type { RunPerturbation } from "../perturbations/index.js";
import type { RealisticScenarioId } from "../realistic-scenarios/index.js";

/**
 * An executor capability a row's proof depends on that may not be on the
 * Core a run uses. The runner never stubs one: a row that needs a capability
 * the run's records do not show is reported `not-proven`, naming it.
 *
 * - `handlers`: lifecycle handlers dispatched at node boundaries (Core C3-C5).
 * - `entries`: a block's other entries chosen at invocation (C2, C6).
 * - `checkpoints`: a handler routing the run back to a checkpoint (C5).
 * - `call-subflow`: a step running a part in its own frame (C1).
 * - `reconciliation`: an in-flight committing act reconciled after its outcome was lost (C8, R5a).
 */
export type RecoveryExecutorFeature = "handlers" | "entries" | "checkpoints" | "call-subflow" | "reconciliation";

/** The checks a case can be judged by, one per required behaviour (`checks/`). */
export type RecoveryCheckId =
  | "cold-start"
  | "eligible-entry"
  | "shortcut-refused"
  | "popup-handled"
  | "popup-honest-end"
  | "handler-precedence"
  | "inactive-handler"
  | "known-alternative"
  | "outcome-reconciled"
  | "checkpoint-route"
  | "worker-restart"
  | "retries-absorbed"
  | "deliberate-stop";

/** What the site's state endpoint must show after the run: counts only, read from `/__control/final-state`. */
export type RecoverySiteExpectation =
  /** Crossborder: the pieces of the listing in the cart, how many times it was added, and whether its store's coupon is held. */
  | Readonly<{ kind: "crossborder-cart"; listingId: string; storeId: string; pieces: number; adds: number; couponHeld: boolean }>
  /** Social network feed: exactly these requests confirmed, and at least `rateLimitedAtLeast` presses the site refused for going too fast. */
  | Readonly<{ kind: "social-confirmed"; requestIds: readonly string[]; rateLimitedAtLeast: number }>
  /** Bigbox: exactly these cart lines, by product and quantity, and the shopper's store when it matters. */
  | Readonly<{ kind: "bigbox-cart"; lines: readonly Readonly<{ productId: string; qty: number }>[]; storeId: string | null }>;

export type RecoveryMatrixCase = Readonly<{
  /** `1`, `4a`, `13b`: the row number and, where a row has several, a letter. */
  caseId: string;
  /** What this case shows, in one sentence. */
  title: string;
  scenarioId: RealisticScenarioId;
  /** The scenario workflow the Flow does; the primary workflow when absent. */
  workflowId?: string;
  /** The scenario variant armed before the run; none when absent. */
  variantId?: string;
  /** The fault the run suffers; none when absent. */
  perturbation?: RunPerturbation;
  /** The candidate script under `flows/`, by its export name. */
  flow: string;
  check: RecoveryCheckId;
  site: RecoverySiteExpectation;
  /** Whether the scenario's playback goal facts must hold on the page after the run. */
  goalFacts: boolean;
  /** The node key prefix of the handler that must be the one to run (`h1-`), for a precedence or alternative check. */
  expectHandler?: string;
  /** A Subflow whose handlers must never run: the inactive part of row 7. */
  quietSubflow?: string;
  /** A step that must never be attempted: the one an eligible entry starts past (row 2). */
  skippedStep?: string;
  /** The failure the run must end with: the variant's declared failure (row 5). */
  declaredFailure?: Readonly<{ category: string; code: string }>;
}>;

export type RecoveryMatrixRow = Readonly<{
  /** The matrix row number, 1-13 (12 is the paid proof and is never in this table). */
  row: number;
  /** The plan's words for the row. */
  scenario: string;
  /** The executor capabilities the proof needs; empty for a row any current Core can run. */
  needs: readonly RecoveryExecutorFeature[];
  /**
   * Where a hand-authored script cannot say what the row needs. A fact about
   * an element can only name it by a handle exploration printed, and a
   * hand-authored Flow has no exploration; the case's script then names the
   * element by a placeholder handle, and the runner refuses to run it rather
   * than run a Flow whose fact can never resolve. Absent when the row's
   * scripts need no such fact.
   */
  authoringGap?: string;
  cases: readonly RecoveryMatrixCase[];
}>;
