// What an attempt says about a step the run skipped rather than ran.
//
// A sometimes-present step -- a popup, a banner, a consent prompt -- whose
// target Core observed absent is skipped, not failed (Core
// `executor/step-skip/absent-step.ts`). Its attempt reads `succeeded` with no
// failure, so this mark, carried by the run detail (Core
// `service/summaries/conversions.ts`), is the only thing that tells a skip from
// a press. The playback step log matches each skip to the host attempt that
// observed the absence by its epoch-ms span (`lab-runs/write-playback-steps.ts`).
//
// A step that could not run because the page was already elsewhere is passed
// over the same way, and the run continues at the node matching the page (Core
// t243, `executor/state-routing/routed-attempt.ts`): its mark is
// `state_routed`, with the node the run went to and whether that is ahead of or
// behind the step. It is how a debug sees the runtime consulted the page.
//
// A `target_absent` skip of a step whose own words name a lasting act carries
// `notDone: true` (Core t444, `executor/step-skip/act-not-done.ts`): the step
// was not shown and its effect was not on the page, so the act was not done.
// The run still reads `succeeded`; this mark is how a reader that has to know
// whether every act happened (a repair replay, `repair/replay-repair.ts`) tells
// a not-done act from a popup that simply was not there.

import { attemptNodeId } from "./persisted-attempt.js";

/** A skipped attempt: why, what observed it, and its span in epoch ms on Core's clock. A state-routed one also says where the run went, and which way. */
export type PersistedFlowActionSkip =
  | { reason: "target_absent"; code: string; notDone?: true; startedAt: number; finishedAt: number }
  | { reason: "state_routed"; code: string; toNodeId: string; direction: "forward" | "backward"; startedAt: number; finishedAt: number };

/** The shape of a Core code (`web.target.not_found`, `executor.ready_state.not_shown`): dotted lowercase words. */
const CORE_CODE = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/u;

/** Each reason's keys, exactly: a mark with any other key is not Core's shape. A `target_absent` mark may also carry `notDone`, and then only as `true`. */
const MARK_KEYS = { target_absent: ["code", "reason"], state_routed: ["code", "direction", "reason", "toNodeId"] } as const;

/**
 * Core's `skipped` mark, in one of its two closed shapes, or nothing. The code
 * is kept only in the shape of a Core code, at most 120 characters, and the
 * destination only in the shape of a node id (`attemptNodeId`), so a value that
 * could carry page text never reaches the bundle. A skip that dispatched
 * nothing may have no finish; it finished when it started.
 */
export function skippedAttemptOf(attempt: Record<string, unknown>, startedAt: number, finishedAt: number | undefined): PersistedFlowActionSkip | undefined {
  const mark = attempt.skipped;
  if (typeof mark !== "object" || mark === null || Array.isArray(mark)) return undefined;
  const fields = mark as Record<string, unknown>;
  const { reason, code } = fields;
  if (reason !== "target_absent" && reason !== "state_routed") return undefined;
  const notDone = reason === "target_absent" && Object.hasOwn(fields, "notDone");
  if (notDone && fields.notDone !== true) return undefined;
  const keys = Object.keys(fields).filter((key) => !(notDone && key === "notDone")).sort().join();
  if (keys !== MARK_KEYS[reason].join()) return undefined;
  if (typeof code !== "string" || code.length > 120 || !CORE_CODE.test(code)) return undefined;
  const span = { startedAt, finishedAt: finishedAt ?? startedAt };
  if (reason === "target_absent") return { reason, code, ...(notDone ? { notDone: true as const } : {}), ...span };
  const { toNodeId, direction } = fields;
  if (typeof toNodeId !== "string" || attemptNodeId(toNodeId) === null) return undefined;
  if (direction !== "forward" && direction !== "backward") return undefined;
  return { reason, code, toNodeId, direction, ...span };
}

/**
 * True when Core passed the attempt over down a skip route (`skipped`, or t243's
 * `state_routed`) and wrote `succeeded`. It holds whether or not the mark is
 * Core's closed shape, so a rejected mark loses its detail, never the skip.
 */
export function onSkipRoute(attempt: Record<string, unknown>): boolean {
  return attempt.status === "succeeded" && (attempt.route === "skipped" || attempt.route === "state_routed");
}

/**
 * How many steps a run passed over because the page was elsewhere (Core t243,
 * `skipped.reason: "state_routed"`), by which way it went. A run outcome
 * carries it only when the run routed, so its presence says the runtime
 * consulted the page and moved on.
 */
export type PersistedStateRouted = { forward: number; backward: number };

/** The run's state-routed steps counted by direction, as an outcome field: empty when no step was state-routed. */
export function stateRoutedOf(actions: readonly { skipped?: PersistedFlowActionSkip }[]): { stateRouted?: PersistedStateRouted } {
  const directions = actions.flatMap(({ skipped }) => (skipped?.reason === "state_routed" ? [skipped.direction] : []));
  if (directions.length === 0) return {};
  return { stateRouted: { forward: directions.filter((direction) => direction === "forward").length, backward: directions.filter((direction) => direction === "backward").length } };
}
