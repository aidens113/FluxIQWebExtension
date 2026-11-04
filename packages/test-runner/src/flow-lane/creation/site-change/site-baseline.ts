import { RunnerFailure } from "../../../failure.js";
import { isRealisticScenario, type RealisticScenarioId } from "../../../realistic-scenarios/index.js";
import type { LastingView, SiteState } from "./lasting-view.js";
import { SITE_LASTING_VIEWS } from "./views/index.js";

export type SiteStateFetch = (url: string, init: { method: "GET"; headers: Record<string, string>; signal: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/**
 * A site as an attempt found it, read just before the attempt's first act: the
 * "before" every change is judged against (user, 2026-10-27). `resetGeneration` says
 * which seeding of the fixture it was read from, so a second attempt's baseline can
 * be told from its first's.
 */
export type SiteBaseline = Readonly<{ scenarioId: string; view: LastingView; resetGeneration: number; mutationSequence: number }>;

/** A realistic site's reading of its own state; a scenario with none is refused, since only the ten may run. */
export function lastingViewOf(scenarioId: string): (state: SiteState) => LastingView {
  if (!isRealisticScenario(scenarioId)) throw new RunnerFailure("fixture.invalid", `Scenario ${scenarioId} is not one of the ten realistic scenarios, so the Lab holds no lasting view of it`);
  return SITE_LASTING_VIEWS[scenarioId as RealisticScenarioId];
}

async function readSnapshot(origin: string, runToken: string, scenarioId: string, fetchLab: SiteStateFetch): Promise<{ state: SiteState; provenance: { resetGeneration: number; mutationSequence: number } }> {
  const base = new URL(origin).origin;
  const response = await fetchLab(`${base}/__control/final-state?scenario=${encodeURIComponent(scenarioId)}`, { method: "GET", headers: { authorization: `Bearer ${runToken}` }, signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new RunnerFailure("fixture.invalid", `Scenario Lab did not answer the state of ${scenarioId} (${response.status})`);
  const snapshot = await response.json() as { state?: unknown; provenance?: { resetGeneration?: unknown; mutationSequence?: unknown } };
  const { state, provenance } = snapshot;
  if (typeof state !== "object" || state === null || !Number.isSafeInteger(provenance?.resetGeneration) || !Number.isSafeInteger(provenance?.mutationSequence)) throw new RunnerFailure("fixture.invalid", `Scenario Lab answered no readable state of ${scenarioId}`);
  return { state: state as SiteState, provenance: { resetGeneration: provenance!.resetGeneration as number, mutationSequence: provenance!.mutationSequence as number } };
}

/** The site's state as it stands now, read through the fixture's authenticated control and never through the page. */
export async function readSiteState(origin: string, runToken: string, scenarioId: string, fetchLab: SiteStateFetch = fetch as unknown as SiteStateFetch): Promise<SiteState> {
  return (await readSnapshot(origin, runToken, scenarioId, fetchLab)).state;
}

/** The baseline of an attempt: the site's lasting view and which seeding it came from. */
export async function readSiteBaseline(origin: string, runToken: string, scenarioId: string, fetchLab: SiteStateFetch = fetch as unknown as SiteStateFetch): Promise<SiteBaseline> {
  const { state, provenance } = await readSnapshot(origin, runToken, scenarioId, fetchLab);
  return Object.freeze({ scenarioId, view: Object.freeze({ ...lastingViewOf(scenarioId)(state) }), ...provenance });
}
