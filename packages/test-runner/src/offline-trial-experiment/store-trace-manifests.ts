// Every client gateway trace a copied project store holds, read through Core's
// own store API (`AutomationStudioProjectGatewayTraceStore`), never its tables:
// each manifest, and how many events and artifacts the store holds for it.
//
// Opening a store applies Core's migrations to it, so point this at a copy no
// Core is writing (`test-runs/`), never at a live workspace.

import { AutomationStudioProjectDatabasePool, AutomationStudioProjectGatewayTraceStore } from "fluxiq/automation-studio";
import type { ClientGatewayTraceManifest } from "fluxiq/client-gateway";

export type StoreTraceManifest = Readonly<{ manifest: ClientGatewayTraceManifest; events: number; artifacts: number }>;

export async function readStoreTraceManifests(input: { automationDataDir: string; projectId: string }): Promise<readonly StoreTraceManifest[]> {
  const pool = new AutomationStudioProjectDatabasePool({ rootDir: input.automationDataDir });
  try {
    const store = await AutomationStudioProjectGatewayTraceStore.open({ pool, projectId: input.projectId });
    try {
      const traces: StoreTraceManifest[] = [];
      for (const manifest of await store.listManifests({})) {
        const events = (await store.readEventRange(manifest.traceId, 1, Number.MAX_SAFE_INTEGER)).length;
        const artifacts = (await store.listArtifacts(manifest.traceId)).length;
        traces.push(Object.freeze({ manifest, events, artifacts }));
      }
      return Object.freeze(traces);
    } finally {
      await store.close();
    }
  } finally {
    await pool.closeAll();
  }
}
