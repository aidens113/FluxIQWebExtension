import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { RunnerFailure } from "../failure.js";
import { hashDirectoryContents } from "./content-hash.js";
import { generatedNextConfig } from "./next-config.js";
import { requireTopologyPaths } from "./required-paths.js";
import { hashServerAdapterSources } from "./gateway-sources.js";
import type { CoreWebBuildInputs } from "./types.js";
import { isCopiedWebEntry } from "./workspace.js";

/** The built Core packages the web panel consumes, by directory below `packages/`. */
const BUILT_PACKAGES = ["client-gateway-websocket", "contracts", "fluxiq"] as const;
/** The directories Core's gateway server inventory walks; absent ones fail as a missing topology, not as a raw read error. */
const SERVER_ADAPTER_SOURCE_DIRECTORIES = ["apps/web/src/server", "apps/web/scripts", "scripts/build-cache"] as const;
/**
 * The gateway server's generated artifact and receipt. Staging copies them,
 * but the key covers their sources instead (`gateway-sources.ts`): a
 * run generates them just before keying and a dry run never does.
 */
const GENERATED_SERVER_ADAPTER = ".server-runtime";

export type CollectedCoreWebBuildInputs = { inputs: CoreWebBuildInputs; nextExecutable: string };

/**
 * Reads and hashes everything a Core web build depends on, from the Core
 * checkout at `fluxiqRepositoryRoot`. It reads no git state: the key follows
 * the files `next build` reads, so a Core commit that changes only docs,
 * tests or other packages' sources reuses the published build.
 */
export async function collectCoreWebBuildInputs(fluxiqRepositoryRoot: string): Promise<CollectedCoreWebBuildInputs> {
  const root = path.resolve(fluxiqRepositoryRoot);
  const web = path.join(root, "apps", "web");
  const tsconfigBase = path.join(root, "tsconfig.base.json");
  const lockfile = path.join(root, "pnpm-lock.yaml");
  const nextPackage = path.join(web, "node_modules", "next", "package.json");
  const packages = BUILT_PACKAGES.map(name => ({ name, dist: path.join(root, "packages", name, "dist"), manifest: path.join(root, "packages", name, "package.json") }));
  await requireTopologyPaths([web, tsconfigBase, lockfile, path.join(root, "package.json"), nextPackage, ...packages.flatMap(item => [item.dist, item.manifest]), ...SERVER_ADAPTER_SOURCE_DIRECTORIES.map(directory => path.join(root, ...directory.split("/")))]);
  const [webFilesHash, tsconfigBytes, lockfileBytes, nextVersion, packageHashes, serverAdapterSourcesHash] = await Promise.all([
    hashDirectoryContents(web, name => isCopiedWebEntry(name) && name !== GENERATED_SERVER_ADAPTER),
    readFile(tsconfigBase),
    readFile(lockfile),
    readNextVersion(nextPackage),
    Promise.all(packages.map(async item => [item.name, await hashBuiltPackage(item.dist, item.manifest)] as const)),
    hashServerAdapterSources(root),
  ]);
  const webSourceHash = createHash("sha256").update(webFilesHash).update("\0").update(tsconfigBytes).digest("hex");
  return {
    inputs: {
      lockfileHash: createHash("sha256").update(lockfileBytes).digest("hex"),
      webSourceHash,
      serverAdapterSourcesHash,
      packageHashes: Object.fromEntries(packageHashes),
      nextConfig: generatedNextConfig(root),
      nextVersion,
    },
    nextExecutable: path.join(web, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next"),
  };
}

/** A built package as the panel's bundler resolves it: its `dist` tree, and the manifest whose `exports` map points into it. */
async function hashBuiltPackage(dist: string, manifest: string): Promise<string> {
  const [distHash, manifestBytes] = await Promise.all([hashDirectoryContents(dist), readFile(manifest)]);
  return createHash("sha256").update(distHash).update("\0").update(manifestBytes).digest("hex");
}

async function readNextVersion(packageJson: string): Promise<string> {
  let version: unknown;
  try { version = (JSON.parse(await readFile(packageJson, "utf8")) as { version?: unknown }).version; }
  catch (cause) { throw new RunnerFailure("environment.missing", "Core's installed next package manifest could not be read", { cause, details: { path: packageJson } }); }
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+/u.test(version)) throw new RunnerFailure("environment.missing", "Core's installed next package has no usable version", { details: { path: packageJson } });
  return version;
}
