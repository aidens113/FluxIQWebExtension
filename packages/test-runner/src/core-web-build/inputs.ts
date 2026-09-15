import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { RunnerFailure } from "../failure.js";
import { hashDirectoryContents } from "./content-hash.js";
import { generatedNextConfig } from "./next-config.js";
import { requireTopologyPaths } from "./required-paths.js";
import type { CoreWebBuildInputs } from "./types.js";
import { isCopiedWebEntry } from "./workspace.js";

/** The built Core packages the web panel consumes, by directory below `packages/`. */
const BUILT_PACKAGES = ["client-gateway-websocket", "contracts", "fluxiq"] as const;
const GIT_OBJECT_NAME = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const execFileAsync = promisify(execFile);

export type CollectedCoreWebBuildInputs = { inputs: CoreWebBuildInputs; nextExecutable: string };

/** Reads and hashes everything a Core web build depends on, from the Core checkout at `fluxiqRepositoryRoot`. */
export async function collectCoreWebBuildInputs(fluxiqRepositoryRoot: string, readHead: (root: string) => Promise<string> = readGitHead): Promise<CollectedCoreWebBuildInputs> {
  const root = path.resolve(fluxiqRepositoryRoot);
  const web = path.join(root, "apps", "web");
  const tsconfigBase = path.join(root, "tsconfig.base.json");
  const nextPackage = path.join(web, "node_modules", "next", "package.json");
  const distDirectories = BUILT_PACKAGES.map(name => ({ name, directory: path.join(root, "packages", name, "dist") }));
  await requireTopologyPaths([web, tsconfigBase, nextPackage, ...distDirectories.map(item => item.directory)]);
  const [coreHead, webFilesHash, tsconfigBytes, nextVersion, distHashes] = await Promise.all([
    readHead(root),
    hashDirectoryContents(web, isCopiedWebEntry),
    readFile(tsconfigBase),
    readNextVersion(nextPackage),
    Promise.all(distDirectories.map(async item => [item.name, await hashDirectoryContents(item.directory)] as const)),
  ]);
  const webSourceHash = createHash("sha256").update(webFilesHash).update("\0").update(tsconfigBytes).digest("hex");
  return {
    inputs: { coreHead, webSourceHash, packageDistHashes: Object.fromEntries(distHashes), nextConfig: generatedNextConfig(root), nextVersion },
    nextExecutable: path.join(web, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next"),
  };
}

async function readNextVersion(packageJson: string): Promise<string> {
  let version: unknown;
  try { version = (JSON.parse(await readFile(packageJson, "utf8")) as { version?: unknown }).version; }
  catch (cause) { throw new RunnerFailure("environment.missing", "Core's installed next package manifest could not be read", { cause, details: { path: packageJson } }); }
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+/u.test(version)) throw new RunnerFailure("environment.missing", "Core's installed next package has no usable version", { details: { path: packageJson } });
  return version;
}

async function readGitHead(root: string): Promise<string> {
  let head = "";
  try { head = (await execFileAsync("git", ["rev-parse", "--verify", "HEAD"], { cwd: root, windowsHide: true, encoding: "utf8" })).stdout.trim(); }
  catch { throw new RunnerFailure("environment.missing", "Core checkout HEAD could not be read", { details: { path: root } }); }
  if (!GIT_OBJECT_NAME.test(head)) throw new RunnerFailure("environment.missing", "Core checkout HEAD is not a commit id", { details: { path: root } });
  return head;
}
