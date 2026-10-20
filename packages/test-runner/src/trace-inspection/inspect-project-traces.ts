// Reads the client gateway traces a project store holds through Core's own
// store API (`AutomationStudioProjectGatewayTraceStore`, lane T P2 D10), never
// by opening its tables: manifests, events and the artifacts the content store
// actually holds. Each trace is summarized as counts (`summarize-trace.ts`),
// the artifacts are deduplicated across traces, and every stored event and
// artifact is searched in process for the secrets the caller holds.
//
// Run it only against a store no Core is writing: the Lab calls it after the
// replay's Core has stopped. Opening the store applies its migrations, so a
// project that never traced gains the empty trace tables and reads as none.

import { AUTOMATION_STUDIO_OBJECT_THRESHOLD_BYTES, AutomationStudioProjectDatabasePool, AutomationStudioProjectGatewayTraceStore } from "fluxiq/automation-studio";
import type { ClientGatewayTraceArtifactPresence, ClientGatewayTraceManifest } from "fluxiq/client-gateway";
import { traceArtifactDedupe } from "./artifact-dedupe.js";
import { holdsAnySecret } from "./holds-any-secret.js";
import { summarizeTrace } from "./summarize-trace.js";
import type { ProjectTraceInspection, TraceSummary } from "./types.js";

export type ProjectTraceInspectionInput = {
  /** Automation Studio's storage root: the directory holding `projects/<projectId>/project.sqlite`. */
  automationDataDir: string;
  projectId: string;
  /** Which traces to read; all of them when absent. The rest are counted as skipped. */
  include?: (manifest: ClientGatewayTraceManifest) => boolean;
  /** Values that must appear in no stored event or artifact. Searched in process; never returned. */
  secrets?: readonly string[];
};

export async function inspectProjectTraces(input: ProjectTraceInspectionInput): Promise<ProjectTraceInspection> {
  const pool = new AutomationStudioProjectDatabasePool({ rootDir: input.automationDataDir });
  try {
    const store = await AutomationStudioProjectGatewayTraceStore.open({ pool, projectId: input.projectId });
    try {
      return await inspect(store, input);
    } finally {
      await store.close();
    }
  } finally {
    await pool.closeAll();
  }
}

async function inspect(store: AutomationStudioProjectGatewayTraceStore, input: ProjectTraceInspectionInput): Promise<ProjectTraceInspection> {
  const secrets = (input.secrets ?? []).filter(secret => secret.length > 0);
  const manifests = await store.listManifests({});
  const selected = manifests.filter(manifest => input.include?.(manifest) ?? true);
  const traces: TraceSummary[] = [];
  const held: (readonly ClientGatewayTraceArtifactPresence[])[] = [];
  const scan = { secretsChecked: secrets.length, eventsScanned: 0, artifactsScanned: 0, eventHits: 0, artifactHits: 0 };
  for (const manifest of selected) {
    const events = await store.readEventRange(manifest.traceId, 1, Number.MAX_SAFE_INTEGER);
    const heldArtifacts = await store.listArtifacts(manifest.traceId);
    traces.push(summarizeTrace({ manifest, events, heldArtifacts, objectThresholdBytes: AUTOMATION_STUDIO_OBJECT_THRESHOLD_BYTES }));
    held.push(heldArtifacts);
    if (secrets.length === 0) continue;
    if (holdsAnySecret(JSON.stringify(manifest), secrets)) scan.eventHits += 1;
    for (const event of events) {
      scan.eventsScanned += 1;
      if (holdsAnySecret(JSON.stringify(event), secrets)) scan.eventHits += 1;
    }
    for (const artifact of heldArtifacts) {
      const bytes = await store.readArtifact(manifest.traceId, artifact.id);
      if (bytes === undefined) continue;
      scan.artifactsScanned += 1;
      if (holdsAnySecret(bytes, secrets)) scan.artifactHits += 1;
    }
  }
  return Object.freeze({
    projectId: input.projectId, traces: Object.freeze(traces), tracesSkipped: manifests.length - selected.length,
    dedupe: traceArtifactDedupe(held), secretScan: Object.freeze(scan),
  });
}
