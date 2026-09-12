import { RunnerFailure } from "../failure.js";

export type LabResetFetch = (url: string, init: { method: "POST"; headers: Record<string, string>; signal: AbortSignal }) => Promise<{ ok: boolean; status: number }>;

/**
 * Resets every fixture's server-side state through the Lab's authenticated
 * `/__control/reset`. The Flow lane resets between the recording and the run
 * so the Flow is judged against state it produced itself: without this a run
 * could pass on the effects the recording lane already left behind (a
 * submitted form, a signed-in session), which proves nothing about replay.
 * It runs before the variant is armed, since a reset would discard the arm.
 */
export async function resetScenarioLab(origin: string, runToken: string, fetchLab: LabResetFetch = fetch as unknown as LabResetFetch): Promise<void> {
  const response = await fetchLab(`${new URL(origin).origin}/__control/reset`, {
    method: "POST",
    headers: { authorization: `Bearer ${runToken}` },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new RunnerFailure("fixture.invalid", "Scenario Lab did not reset its fixture state before the Flow run", { details: { status: response.status } });
}
