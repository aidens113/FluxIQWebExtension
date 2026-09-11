// The persisted identity of the recorded demo workspace: its schema, where it
// is stored, how a legacy document is migrated, and the lock every lane takes
// before touching it.
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { hardenWindowsPrivatePath } from "../windows-acl.js";
import { acquireWorkspaceOperationLock } from "../workspace-lock.js";
import type { DemoWorkspaceConfiguration } from "./configuration.js";

export const SCHEMA_VERSION = "0.3" as const;

export type DemoWorkspaceState = {
  schemaVersion: typeof SCHEMA_VERSION;
  origin: string;
  username: string;
  projectId: string;
  flowId: string;
  subflowId: string;
  graphFlowId: string;
  routerId: string;
  projectName: string;
  flowName: string;
  latestRecordingId?: string;
  latestRuntimeRunId?: string;
  updatedAt: string;
};

export type LegacyDemoWorkspaceState = Omit<DemoWorkspaceState, "schemaVersion" | "subflowId" | "graphFlowId" | "routerId"> & { schemaVersion: "0.2" };

export function statePath(config: DemoWorkspaceConfiguration): string {
  return path.join(config.workspaceDirectory, "workspace.json");
}

export async function loadWorkspaceState(config: DemoWorkspaceConfiguration): Promise<DemoWorkspaceState | LegacyDemoWorkspaceState | undefined> {
  try {
    const value = JSON.parse(await readFile(statePath(config), "utf8")) as Partial<DemoWorkspaceState> & { schemaVersion?: string };
    if (value.schemaVersion !== SCHEMA_VERSION && value.schemaVersion !== "0.2") return undefined;
    if (
      value.origin !== config.origin
      || value.username !== config.username
      || !value.projectId
      || !value.flowId
    ) throw new Error("Demo workspace state does not match this FluxIQ origin and user");
    if (value.schemaVersion === SCHEMA_VERSION && (!value.subflowId || !value.graphFlowId || !value.routerId)) throw new Error("Demo workspace hierarchy state is incomplete");
    if (config.projectId && value.projectId !== config.projectId) throw new Error("FLUXIQ_DEMO_PROJECT_ID conflicts with saved state");
    return value as DemoWorkspaceState | LegacyDemoWorkspaceState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function saveWorkspaceState(config: DemoWorkspaceConfiguration, state: DemoWorkspaceState): Promise<void> {
  const target = statePath(config);
  const temporary = target + "." + randomBytes(6).toString("hex") + ".tmp";
  await writeFile(temporary, JSON.stringify(state, null, 2) + "\n", { encoding: "utf8", flag: "wx", mode: 0o600 });
  await rename(temporary, target);
  if (process.platform === "win32") await hardenWindowsPrivatePath(target, "file");
}

export async function withWorkspaceLock<T>(config: DemoWorkspaceConfiguration, operation: () => Promise<T>): Promise<T> {
  await mkdir(config.workspaceDirectory, { recursive: true, mode: 0o700 });
  await mkdir(path.join(config.workspaceDirectory, "logs"), { recursive: true, mode: 0o700 });
  await mkdir(path.join(config.workspaceDirectory, "browser-profile-isolated"), { recursive: true, mode: 0o700 });
  await mkdir(path.join(config.workspaceDirectory, "panel-browser-profile-isolated-v2"), { recursive: true, mode: 0o700 });
  if (process.platform === "win32") await hardenWindowsPrivatePath(config.workspaceDirectory, "directory");
  const lock = await acquireWorkspaceOperationLock(config.workspaceDirectory);
  try {
    return await operation();
  } finally {
    await lock.release();
  }
}
