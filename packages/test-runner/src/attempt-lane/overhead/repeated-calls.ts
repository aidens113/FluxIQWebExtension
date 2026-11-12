import { isBrowserCall } from "./is-browser-call.js";
import type { StepRecord } from "./step-record.js";

/** What a call carries only because it was replayed: the replay mode, where it ran from, and the binding the replay adds. */
const REPLAY_WORDS: ReadonlySet<string> = new Set(["replay", "from", "extractionBinding"]);

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value).filter(([, each]) => each !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, each]) => `${JSON.stringify(key)}:${canonical(each)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

const objectOf = (value: unknown): Record<string, unknown> => (value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

/**
 * A browser call's identity: its node, its parameters (which carry the target) without the replay words, and its place.
 * The place is where a replay says it ran (`from.location`) or, for a call made by hand, the address the page stood at before
 * it; a navigation's place is its address. A call inside a repeat adds which pass it was (`.pass.N` ends its call id), since a
 * replay records the same location on every pass. `null` for a step with no call.
 */
function callIdentity(record: StepRecord, before: string): string | null {
  if (record.callInput === undefined) return null;
  const input = objectOf(record.callInput);
  const node = typeof input.node === "string" ? input.node : record.toolId;
  const parameters = Object.fromEntries(Object.entries(objectOf(input.parameters)).filter(([key]) => !REPLAY_WORDS.has(key)));
  const where = objectOf(input.from).location;
  const pass = /\.pass\.(\d+)$/u.exec(record.callId ?? "")?.[1] ?? "";
  const at = typeof where === "string" ? where : typeof parameters.url === "string" ? parameters.url : before;
  const place = `${at}${pass === "" ? "" : ` pass ${pass}`}`;
  const rest = Object.fromEntries(Object.entries(input).filter(([key]) => key !== "parameters" && key !== "node" && !REPLAY_WORDS.has(key)));
  return canonical({ node, parameters, place, rest });
}

/** How many browser calls had the node, parameters and place of one that already ran in the attempt. */
export function repeatedCallCount(records: readonly StepRecord[]): number {
  const seen = new Set<string>();
  let repeated = 0;
  // Where the page stood before the call, for one made by hand: the address its last by-hand predecessor left.
  let before = "";
  for (const record of records) {
    if (!isBrowserCall(record)) continue;
    const identity = callIdentity(record, before);
    if (record.locationAfter !== null) before = record.locationAfter;
    if (identity === null) continue;
    if (seen.has(identity)) repeated += 1;
    else seen.add(identity);
  }
  return repeated;
}
