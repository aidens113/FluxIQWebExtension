import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { ConsumerEvidence, SourceDocument } from "./audit.js";

const ignoredDirectories = new Set([".git", ".fluxiq", "node_modules", "dist", "build", ".test-build", "test-runs"]);
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);

export async function readCandidateSources(candidateRoot: string): Promise<SourceDocument[]> {
  const sourceRoot = path.join(candidateRoot, "src");
  const files = await walk(sourceRoot, file => sourceExtensions.has(path.extname(file)));
  return Promise.all(files.map(async file => ({ path: slash(path.relative(candidateRoot, file)), content: await readFile(file, "utf8") })));
}

export async function findPackageConsumers(repositoryRoot: string, repositoryName: string, packageName: string, candidateRoot?: string): Promise<ConsumerEvidence[]> {
  const manifests = await walk(repositoryRoot, file => path.basename(file) === "package.json");
  const consumers: ConsumerEvidence[] = [];
  for (const manifestPath of manifests) {
    const packageRoot = path.dirname(manifestPath);
    if (candidateRoot && samePath(packageRoot, candidateRoot)) continue;
    let manifest: unknown;
    try { manifest = JSON.parse(await readFile(manifestPath, "utf8")) as unknown; } catch { continue; }
    if (!isRecord(manifest)) continue;
    const id = typeof manifest.name === "string" ? manifest.name : slash(path.relative(repositoryRoot, packageRoot));
    const declaresDependency = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]
      .some(field => isRecord(manifest[field]) && packageName in manifest[field]);
    const sources = await walk(path.join(packageRoot, "src"), file => sourceExtensions.has(path.extname(file)));
    const importEvidence: string[] = [];
    const escapedPackageName = packageName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const importPattern = new RegExp(`(?:from\\s*|import\\s*\\(|require\\s*\\()\\s*[\"']${escapedPackageName}(?:[\"'/])`, "u");
    for (const source of sources) {
      if (importPattern.test(await readFile(source, "utf8"))) importEvidence.push(slash(path.relative(repositoryRoot, source)));
    }
    if (declaresDependency || importEvidence.length > 0) {
      consumers.push({
        id,
        repository: repositoryName,
        evidencePaths: [...(declaresDependency ? [slash(path.relative(repositoryRoot, manifestPath))] : []), ...importEvidence],
      });
    }
  }
  return consumers;
}

async function walk(root: string, accept: (file: string) => boolean): Promise<string[]> {
  const output: string[] = [];
  async function visit(directory: string): Promise<void> {
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) await visit(fullPath);
      } else if (entry.isFile() && accept(fullPath)) output.push(fullPath);
    }
  }
  await visit(root);
  return output.sort();
}

const samePath = (left: string, right: string) => path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
const slash = (value: string) => value.replaceAll("\\", "/");
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
