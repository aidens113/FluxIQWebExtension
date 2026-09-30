// How a test run of a generated automation went, from the
// `testGeneratedAutomation` reply, which carries Core's `run-runtime-session`
// payload as `runAutomation` does: `runSummary.status` and
// `interventionCount`. Read defensively; a field that is missing or of the
// wrong type is left out.

import { payloadFields } from "../payload-fields";

/** A test run's outcome as the review words it. */
export type TestOutcome = {
  /** The run's summary said `succeeded`. */
  readonly passed: boolean;
  /** How many times the AI stepped in; 0 when the reply did not say. */
  readonly interventions: number;
};

/** The outcome in a `testGeneratedAutomation` reply, or undefined when it carries no payload. */
export function testOutcome(reply: unknown): TestOutcome | undefined {
  const payload = payloadFields(payloadFields(reply)?.payload);
  if (payload === undefined) return undefined;
  const count = payload.interventionCount;
  return {
    passed: payloadFields(payload.runSummary)?.status === "succeeded",
    interventions: typeof count === "number" && Number.isInteger(count) && count > 0 ? count : 0
  };
}
