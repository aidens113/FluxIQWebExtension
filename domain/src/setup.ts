import path from "node:path";
import { createWebAutomationFluxIQ } from "./host";

type WebAutomationFluxIQ = ReturnType<typeof createWebAutomationFluxIQ>;

export type WebAutomationSetupResult = Awaited<ReturnType<WebAutomationFluxIQ["setup"]>> & {
  domains: ReturnType<WebAutomationFluxIQ["domains"]["summaries"]>;
  recordingDomains: ReturnType<WebAutomationFluxIQ["programs"]["automationStudio"]["listRecordingDomains"]>;
  /** Present when this setup upgraded an older data layout first. */
  migration?: Awaited<ReturnType<WebAutomationFluxIQ["migrateStorage"]>>;
};

/**
 * Sets FluxIQ up for this repository, upgrading an older data layout first.
 *
 * Core never migrates storage implicitly: the host that starts FluxIQ decides
 * (Core `docs/operations/data-and-state.md`, "Storage Migration"). This is the
 * person's own start of FluxIQ, so a layout Core reports as needing migration
 * (v1, or a migration that was interrupted, which `migrateStorage()` resumes)
 * is upgraded here, and the instance is created again so its paths switch to
 * the new layout, as Core's web runtime does after a migration. Before this, a
 * person whose data predated the layout change could not start the panel at
 * all ("FluxIQ storage layout v1 requires migrateStorage() before v2 setup.",
 * 2026-11-17). Migration archives the old files under `.fluxiq/legacy/` and can
 * be rolled back with `rollbackStorageMigration()`.
 */
export async function setupWebAutomationFluxIQ(rootDir = process.cwd()): Promise<WebAutomationSetupResult> {
  const root = path.resolve(rootDir);
  let fluxiq = createWebAutomationFluxIQ({ rootDir: root, loadEnv: true });
  let migration: WebAutomationSetupResult["migration"];
  if (fluxiq.inspectStorage().migrationRequired) {
    // A failed migration leaves the root resumable by the next setup, or restorable with `rollbackStorageMigration()`; the instance is closed either way.
    try {
      migration = await fluxiq.migrateStorage();
    } finally {
      await fluxiq.close();
    }
    fluxiq = createWebAutomationFluxIQ({ rootDir: root, loadEnv: true });
  }
  // Setup is one-shot: the instances it creates are closed before it returns,
  // so no database stays open behind it (Windows refuses to remove a root whose
  // SQLite files an open instance still holds). `close()` releases only this
  // instance's own connections and in-memory key custody.
  try {
    const result = await fluxiq.setup();
    return {
      ...result,
      ...(migration ? { migration } : {}),
      domains: fluxiq.domains.summaries(),
      recordingDomains: fluxiq.programs.automationStudio.listRecordingDomains()
    };
  } finally {
    await fluxiq.close();
  }
}
