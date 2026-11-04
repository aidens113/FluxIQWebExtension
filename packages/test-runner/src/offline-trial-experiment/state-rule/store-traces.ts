// One saved project store's traces, read through Core's own store API from a copy: the
// project's folder (its database, write-ahead log and artifact objects) is copied under
// `--work`, since opening one applies Core's migrations, and the original is never
// opened. Each trace comes back with its commands and answers, and whether Core's
// offline runner would admit it.

import { copyFile, cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { AUTOMATION_STUDIO_OFFLINE_TRIAL_READER_CONTRACTS, AutomationStudioProjectDatabasePool, AutomationStudioProjectGatewayTraceStore } from "fluxiq/automation";
import { admitClientGatewayTraceForMatching, clientGatewayTraceStateRecordedCalls, type ClientGatewayTraceManifest } from "fluxiq/client-gateway";
import type { StoreTrace } from "./types.js";

const DATABASE_FILES: readonly string[] = ["project.sqlite", "project.sqlite-wal", "project.sqlite-shm"];
const OBJECTS = "objects";

/** Reads a store through a throwaway copy. `pick` says which manifests to read, since events are the cost. The copy is removed afterwards. */
export async function readStoreTraces(input: { storeFile: string; work: string; pick: (manifest: ClientGatewayTraceManifest) => boolean }): Promise<readonly StoreTrace[]> {
  const projectId = path.basename(path.dirname(input.storeFile));
  const rootDir = path.join(input.work, `store-${process.pid}-${Date.now().toString(36)}`);
  const projectDir = path.join(rootDir, "projects", projectId);
  await mkdir(projectDir, { recursive: true });
  try {
    for (const file of DATABASE_FILES) {
      if (await exists(path.join(path.dirname(input.storeFile), file))) await copyFile(path.join(path.dirname(input.storeFile), file), path.join(projectDir, file));
    }
    const pool = new AutomationStudioProjectDatabasePool({ rootDir });
    try {
      const store = await AutomationStudioProjectGatewayTraceStore.open({ pool, projectId });
      try {
        const manifests = (await store.listManifests({})).filter(input.pick);
        // Most stores on a machine hold no trace of a run asked about: their artifacts are copied only when one does.
        if (manifests.length > 0 && (await exists(path.join(path.dirname(input.storeFile), OBJECTS)))) await cp(path.join(path.dirname(input.storeFile), OBJECTS), path.join(projectDir, OBJECTS), { recursive: true });
        const traces: StoreTrace[] = [];
        for (const manifest of manifests) {
          const events = await store.readEventRange(manifest.traceId, 1, Number.MAX_SAFE_INTEGER);
          const { calls, firstChild } = clientGatewayTraceStateRecordedCalls(events);
          const admission = await admitClientGatewayTraceForMatching({ store, traceId: manifest.traceId, contractVersions: AUTOMATION_STUDIO_OFFLINE_TRIAL_READER_CONTRACTS });
          traces.push(Object.freeze({ manifest, calls, firstChild, refusal: admission.refusal?.reason ?? null }));
        }
        return Object.freeze(traces);
      } finally {
        await store.close();
      }
    } finally {
      await pool.closeAll();
    }
  } finally {
    await rm(rootDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}
