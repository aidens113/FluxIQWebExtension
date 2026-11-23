import type { AttemptCostProgress } from "./reader.js";

function dollars(value: number): string {
  if (value > 0 && value < 0.000001) return "<$0.000001";
  return `$${value.toFixed(6)}`;
}

/** Safe fixed labels and numbers only; unknown values remain separate from known settled estimates. */
export function formatAttemptCostProgress(snapshot: Awaited<ReturnType<AttemptCostProgress["read"]>>): string[] {
  if (snapshot.source === "unavailable") return ["[cost] step accounting unavailable; current cost unknown"];
  return snapshot.attempts.map((attempt) => {
    const stages = Object.entries(attempt.stages).filter(([, amount]) => amount.calls > 0).map(([name, amount]) => `${name} ${dollars(amount.knownUsd)}${amount.unknownCosts ? ` + ${amount.unknownCosts} unknown` : ""}`).join(", ");
    const missing = attempt.settled.unknownCosts + attempt.pendingCalls + attempt.unreadableRecords;
    return `[cost] attempt ${attempt.ordinal}: recorded settled estimate ${dollars(attempt.settled.knownUsd)} (${attempt.settled.calls} calls${stages ? `; ${stages}` : ""}); ${attempt.pendingCalls} pending, ${attempt.settled.unknownCosts} unpriced, ${attempt.unreadableRecords} unreadable${missing ? "; total incomplete" : ""}`;
  });
}
