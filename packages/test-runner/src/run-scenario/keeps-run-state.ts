/**
 * Whether a run keeps its own `.work/<runId>` directory -- the isolated Core's
 * workspace and database, the browser profile and the process logs -- instead of
 * deleting it once the bundle is finalized.
 *
 * The bundle is screened: it publishes an authored node's parameters only as
 * shapes, and no decision's parameters at all. The full debug of a live run
 * (`docs/working/language-driven-flow-loop-plan.md`, "The Full Debug Protocol")
 * asks for each node's real parameters, and the only place they survive is the
 * Core database this directory holds. So a debugging lane sets
 * `FLUXIQ_LAB_KEEP_RUN_STATE=1` and reads that database afterwards.
 *
 * Nothing kept here is published: the directory lives under the ignored
 * `test-runs/` tree beside the bundle, never inside it, and the redaction
 * attestation has already scanned it before this decision is taken. Keeping it
 * is the exception, so anything but the exact value `1` deletes as before, and a
 * clone target's workspace is removed by its own cleanup whatever this says.
 */
export function keepsRunState(environment: NodeJS.ProcessEnv): boolean {
  return environment.FLUXIQ_LAB_KEEP_RUN_STATE === "1";
}
