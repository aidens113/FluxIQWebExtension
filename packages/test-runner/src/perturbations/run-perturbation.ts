// The faults a Lab run can be told to suffer, declared up front as data.
//
// The state-aware recovery plan's acceptance matrix needs two faults that no
// scenario variant can make, because the Scenario Lab server holds no handle on
// the browser or the gateway (t390's feasibility notes):
//
// - row 9, `drop-action-result`: the extension acts, the site takes the act,
//   and Core never hears the outcome. A loopback relay between the extension
//   and Core's gateway drops exactly one `client.action_result` and keeps the
//   connection open (`drop-action-result-relay.ts`).
// - row 11, `stop-service-worker`: the extension's background worker is
//   stopped while an act is in flight. When the fixture site receives the
//   request a committing act causes, the worker's CDP target is closed
//   (`stop-service-worker.ts`).
//
// A run without a perturbation is exactly the run it was before: nothing is
// started, armed or recorded.

/** One fault for one run. */
export type RunPerturbation =
  /**
   * Drops the `client.action_result` of the `afterCommittingActs`-th committing
   * act Core sends (counted from 1, across reconnects): once that many
   * committing acts have gone out, the last one's acknowledgement never
   * reaches Core. Every other frame passes untouched.
   */
  | { kind: "drop-action-result"; afterCommittingActs: number }
  /**
   * Stops the extension's service worker the first time a page sends a request
   * whose path matches `onSiteRequest` to one of the run's scenario origins.
   * The pattern is a URL path from its leading `/`, where `*` stands for any
   * run of characters, such as `/api/social-network-feed/confirm-request`.
   */
  | { kind: "stop-service-worker"; onSiteRequest: string };

/**
 * Reads a perturbation from untrusted input (a CLI argument or a JSON file)
 * and refuses anything that is not exactly one of the declared shapes, so a
 * typo can never run a run unperturbed while its bundle says otherwise.
 */
export function parseRunPerturbation(value: unknown): RunPerturbation {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("A run perturbation must be an object with a `kind`");
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort().join(",");
  if (record.kind === "drop-action-result") {
    if (keys !== "afterCommittingActs,kind") throw new Error("A drop-action-result perturbation takes exactly `kind` and `afterCommittingActs`");
    const count = record.afterCommittingActs;
    if (typeof count !== "number" || !Number.isInteger(count) || count < 1) throw new Error("`afterCommittingActs` must be a whole number of at least 1");
    return { kind: "drop-action-result", afterCommittingActs: count };
  }
  if (record.kind === "stop-service-worker") {
    if (keys !== "kind,onSiteRequest") throw new Error("A stop-service-worker perturbation takes exactly `kind` and `onSiteRequest`");
    const pattern = record.onSiteRequest;
    if (typeof pattern !== "string" || !pattern.startsWith("/") || /[?#\s]/u.test(pattern)) throw new Error("`onSiteRequest` must be a URL path starting with `/`, with no query, fragment or spaces");
    return { kind: "stop-service-worker", onSiteRequest: pattern };
  }
  throw new Error("A run perturbation's `kind` must be `drop-action-result` or `stop-service-worker`");
}
