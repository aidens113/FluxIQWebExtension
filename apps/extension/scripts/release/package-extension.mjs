// Packages the built Chrome/Edge and Firefox targets as store-ready ZIPs and
// verifies each archive by reading it back.
//
//   pnpm --filter @fluxiq-web-extension/extension build
//   node apps/extension/scripts/release/package-extension.mjs [--release] [--out DIR]
//
// Refuses a target whose build stamp no longer matches the source tree, so a
// package is always the current source. Excludes sourcemaps and the build stamp
// (they name local paths and are not needed at runtime). `--release` also
// refuses owner placeholders, such as the example Firefox add-on id. Writes
// fluxiq-web-extension-<target>-<version>.zip, SHA256SUMS and
// package-report.json to dist/store/ (ignored, like all of dist/).

import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compareBuildInfo } from "./build-info.mjs";
import { readTargetFiles } from "./target-files.mjs";
import { verifyExtensionTarget } from "./verify-extension-target.mjs";
import { readZip, writeZip } from "./zip-archive.mjs";

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = path.resolve(extensionRoot, "..", "..");
const STORE_TARGETS = /** @type {const} */ (["chrome", "firefox"]);
const EXCLUDED = [/\.map$/, /^build-info\.json$/];

/**
 * @param {{ release?: boolean, outDir?: string, distDir?: string, log?: (line: string) => void }} [options]
 * @returns {Promise<{ ok: boolean, packages: { target: string, file: string, bytes: number, sha256: string, entries: number, warnings: string[], errors: string[] }[] }>}
 */
export async function packageExtension(options = {}) {
  const log = options.log ?? ((line) => console.log(line));
  const distDir = options.distDir ?? path.join(extensionRoot, "dist");
  const outDir = options.outDir ?? path.join(distDir, "store");
  const version = JSON.parse(await readFile(path.join(extensionRoot, "package.json"), "utf8")).version;
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const packages = [];
  for (const target of STORE_TARGETS) {
    const targetDir = path.join(distDir, target);
    const result = { target, file: "", bytes: 0, sha256: "", entries: 0, warnings: [], errors: [] };
    packages.push(result);
    try {
      await stat(path.join(targetDir, "manifest.json"));
    } catch {
      result.errors.push(`${targetDir} has no build; run "pnpm --filter @fluxiq-web-extension/extension build" first`);
      continue;
    }
    const freshness = await compareBuildInfo(targetDir, repoRoot);
    if (freshness.state === "unstamped") result.errors.push(`${target}: ${freshness.reason}; rebuild before packaging`);
    else if (freshness.state === "stale") {
      result.errors.push(`${target}: the build is older than the source (${[...freshness.changed, ...freshness.removed].slice(0, 5).join(", ")}); rebuild before packaging`);
    }
    if (result.errors.length > 0) continue;

    const files = await readTargetFiles(targetDir);
    const archive = writeZip([...files].filter(([name]) => !EXCLUDED.some((pattern) => pattern.test(name))).map(([name, data]) => ({ name, data })));
    const file = path.join(outDir, `fluxiq-web-extension-${target}-${version}.zip`);
    await writeFile(file, archive);

    const readBack = new Map(readZip(await readFile(file)).map((entry) => [entry.name, entry.data]));
    const verdict = await verifyExtensionTarget({ target, files: readBack, expectedVersion: version, store: true, release: options.release === true });
    Object.assign(result, {
      file: path.relative(repoRoot, file).split(path.sep).join("/"),
      bytes: archive.length,
      sha256: createHash("sha256").update(archive).digest("hex"),
      entries: readBack.size,
      warnings: verdict.warnings,
      errors: verdict.errors
    });
  }

  const ok = packages.every((entry) => entry.errors.length === 0);
  await writeFile(path.join(outDir, "SHA256SUMS"), packages.filter((entry) => entry.sha256).map((entry) => `${entry.sha256}  ${path.basename(entry.file)}\n`).join(""), "utf8");
  await writeFile(path.join(outDir, "package-report.json"), `${JSON.stringify({ version, release: options.release === true, ok, packages }, null, 2)}\n`, "utf8");
  for (const entry of packages) {
    log(`${entry.errors.length === 0 ? "ok  " : "FAIL"} ${entry.target}: ${entry.file || "(not written)"} ${entry.bytes ? `${entry.bytes} bytes, ${entry.entries} files, sha256 ${entry.sha256}` : ""}`.trimEnd());
    for (const warning of entry.warnings) log(`  warn  ${warning}`);
    for (const error of entry.errors) log(`  error ${error}`);
  }
  return { ok, packages };
}

function isEntryPoint() {
  if (!process.argv[1]) return false;
  const canonical = (file) => {
    const resolved = path.resolve(file);
    return process.platform === "win32" ? resolved.toLowerCase() : resolved;
  };
  return canonical(fileURLToPath(import.meta.url)) === canonical(process.argv[1]);
}

if (isEntryPoint()) {
  const args = process.argv.slice(2);
  let release = false;
  let outDir;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--release") release = true;
    else if (args[index] === "--out" && args[index + 1]) outDir = path.resolve(args[++index]);
    else {
      console.error("Usage: package-extension.mjs [--release] [--out DIR]");
      process.exit(2);
    }
  }
  const { ok } = await packageExtension({ release, ...(outDir ? { outDir } : {}) });
  process.exit(ok ? 0 : 1);
}
