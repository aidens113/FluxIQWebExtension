import { cp, mkdir, readdir, realpath, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { generatedNextConfig } from "./next-config.js";
import { requireTopologyPaths } from "./required-paths.js";

const EXCLUDED_WEB_ENTRIES = new Set([".next", "node_modules", "playwright-report", "test-results", "next.config.ts"]);

/** Whether an entry of Core's `apps/web`, at any depth, is copied into a staged workspace. */
export function isCopiedWebEntry(name: string): boolean {
  return !EXCLUDED_WEB_ENTRIES.has(name);
}

/**
 * Stages Core's web app at `target`, two levels below a workspace root that
 * receives Core's `tsconfig.base.json` and a link to its `packages`: a copy of
 * `apps/web` without build output or dependencies, `node_modules` mirrored as
 * links into Core's installed dependencies, and the generated Next config.
 * Returns the Next executable of Core's own installation.
 */
export async function prepareWebWorkspace(fluxiqRepositoryRoot: string, target: string): Promise<string> {
  const source = path.join(fluxiqRepositoryRoot, "apps", "web");
  const sourceNodeModules = path.join(source, "node_modules");
  const isolatedCoreRoot = path.resolve(target, "..", "..");
  await requireTopologyPaths([sourceNodeModules, path.join(fluxiqRepositoryRoot, "tsconfig.base.json"), path.join(fluxiqRepositoryRoot, "packages")]);
  await cp(source, target, {
    recursive: true,
    force: false,
    filter: candidate => isCopiedWebEntry(path.basename(candidate)),
  });
  const targetNodeModules = path.join(target, "node_modules");
  await mirrorNodeModules(sourceNodeModules, targetNodeModules);
  const rootNodeTypes = path.join(fluxiqRepositoryRoot, "node_modules", "@types", "node");
  await requireTopologyPaths([rootNodeTypes]);
  await mkdir(path.join(targetNodeModules, "@types"), { recursive: true });
  await symlink(await realpath(rootNodeTypes), path.join(targetNodeModules, "@types", "node"), process.platform === "win32" ? "junction" : "dir");
  await cp(path.join(fluxiqRepositoryRoot, "tsconfig.base.json"), path.join(isolatedCoreRoot, "tsconfig.base.json"));
  await symlink(path.join(fluxiqRepositoryRoot, "packages"), path.join(isolatedCoreRoot, "packages"), process.platform === "win32" ? "junction" : "dir");
  await writeFile(path.join(target, "next.config.mjs"), generatedNextConfig(fluxiqRepositoryRoot), "utf8");
  return path.join(sourceNodeModules, ".bin", process.platform === "win32" ? "next.cmd" : "next");
}

async function mirrorNodeModules(source: string, target: string): Promise<void> {
  await mkdir(target, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.name.startsWith("@") && entry.isDirectory()) {
      const sourceScope = path.join(source, entry.name);
      const targetScope = path.join(target, entry.name);
      await mkdir(targetScope, { recursive: true });
      for (const scoped of await readdir(sourceScope)) {
        await symlink(await realpath(path.join(sourceScope, scoped)), path.join(targetScope, scoped), process.platform === "win32" ? "junction" : "dir");
      }
      continue;
    }
    await symlink(await realpath(path.join(source, entry.name)), path.join(target, entry.name), process.platform === "win32" ? "junction" : "dir");
  }
}
