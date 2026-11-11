import type { DecisionKinds } from "./decision-kinds.js";
import type { StepRecord } from "./step-record.js";

const DESCRIBES = /^tool_call (core\.describe_nodes|web\.describe_element)\b/u;
const READ_ONLY_RESULTS: ReadonlySet<string> = new Set(["web.inspect.succeeded", "core.recall.restored", "web.structure.detected"]);

/** The steps that answered one decision: everything after it up to the next decision. */
function followersOf(records: readonly StepRecord[], index: number): StepRecord[] {
  const next = records.findIndex((record, at) => at > index && record.kind === "decide");
  return records.slice(index + 1, next === -1 ? records.length : next);
}

function kindOf(records: readonly StepRecord[], index: number): keyof DecisionKinds {
  const { summary } = records[index]!;
  if (summary.startsWith("error ")) return "providerFormatError";
  if (DESCRIBES.test(summary)) return "describe";
  const followers = followersOf(records, index);
  if (followers.some((record) => (record.kind === "answer" && /\brefused\b/u.test(record.summary)) || record.resultCode === "answer_first.no_reset")) return "refused";
  const tools = followers.filter((record) => record.kind === "tool");
  const readOnly = tools.length > 0 && tools.every((record) => record.resultCode !== null && READ_ONLY_RESULTS.has(record.resultCode));
  if (readOnly && !/ add\b/u.test(summary)) return "look";
  return "step";
}

/** An attempt's decisions by kind, each counted once. */
export function countDecisions(records: readonly StepRecord[]): DecisionKinds {
  const counts: Record<keyof DecisionKinds, number> = { describe: 0, providerFormatError: 0, refused: 0, look: 0, step: 0 };
  records.forEach((record, index) => {
    if (record.kind === "decide") counts[kindOf(records, index)] += 1;
  });
  return counts;
}
