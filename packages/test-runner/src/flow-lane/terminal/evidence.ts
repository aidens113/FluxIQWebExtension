// Terminal run diagnostics narrowed before an isolated workspace is cleaned up.
// Core's terminalFailureReason is free text (often trace.message), not a code.
// Match only generic Core-owned reasons/templates; unknown text is explicitly
// withheld. No message, selector, route value, page data or interpolated reason
// is copied. Status and verdict remain the run's existing fields.
import { attemptNodeId } from "../persisted-attempt.js";

const GENERIC_REASONS = {
  "No start node is available in this flow.": "graph.no_start_node",
  "Run cancelled.": "run.cancelled",
  "Run failed before recovery lookup produced a candidate.": "recovery.no_candidate",
  "Run failed after recovery was selected.": "recovery.selected",
  "Recovery ladder stopped at LLM diagnosis fallback because no deterministic recovery resolved the failure.": "recovery.diagnosis_only",
  "Recovery ladder exhausted all known recovery candidates.": "recovery.exhausted"
} as const;
type TerminalReason = typeof GENERIC_REASONS[keyof typeof GENERIC_REASONS] | "graph.unvisited_nodes" | "graph.no_matching_route" | "graph.missing_target_node" | "graph.maximum_steps_exceeded" | "withheld_unrecognized";
type TerminalEvidence = { terminalFailureReason: TerminalReason | null; currentNodeId: string | null; messagePresent: boolean };
// Same opaque identifier shape as persisted-attempt.ts; dynamic values are
// matched only to identify a generic template, never emitted from its text.
const ID = "[A-Za-z0-9][A-Za-z0-9._:-]{0,127}";
const UNVISITED = new RegExp(`^Node ${ID} completed without an outgoing edge before the Flow visited every node\\. Add an edge to continue or an End node to finish explicitly\\.$`, "u");
const UNMATCHED = new RegExp(`^Node ${ID} completed on route ${ID}, but no matching outgoing edge exists\\. Available routes: ${ID}(?:, ${ID})*\\.$`, "u");
const MISSING_TARGET = new RegExp(`^Edge ${ID} points to missing node ${ID}\\.$`, "u");

/** Only optional terminal metadata: missing metadata never becomes a guessed terminal cause. */
export function terminalRunEvidenceOf(detail: unknown): TerminalEvidence | undefined {
  const metadata = record(record(detail)?.metadata);
  if (!metadata || !["terminalFailureReason", "currentNodeId", "message"].some((key) => Object.hasOwn(metadata, key))) return undefined;
  const reason = metadata.terminalFailureReason;
  return {
    terminalFailureReason: reason === undefined || reason === null ? null : reasonOf(reason),
    currentNodeId: typeof metadata.currentNodeId === "string" ? attemptNodeId(metadata.currentNodeId) : null,
    messagePresent: typeof metadata.message === "string" && metadata.message.length > 0
  };
}

/** Categories for exact converter fallback sentences and known graph-run/navigation templates. */
function reasonOf(reason: unknown): TerminalReason {
  if (typeof reason !== "string") return "withheld_unrecognized";
  if (Object.hasOwn(GENERIC_REASONS, reason)) return GENERIC_REASONS[reason as keyof typeof GENERIC_REASONS];
  if (UNVISITED.test(reason)) return "graph.unvisited_nodes";
  if (UNMATCHED.test(reason)) return "graph.no_matching_route";
  if (MISSING_TARGET.test(reason)) return "graph.missing_target_node";
  if (/^Maximum step count exceeded: [0-9]+\.$/u.test(reason)) return "graph.maximum_steps_exceeded";
  return "withheld_unrecognized";
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
