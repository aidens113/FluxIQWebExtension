import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { RunnerFailure } from "../failure.js";

/**
 * The literal Core's source holds in place of its runtime build identity
 * (`packages/fluxiq/src/runtime/build-identity/read.ts`). Only Core's `dist`
 * build replaces it, so a panel whose server output still contains it was
 * compiled from source and can only ever answer "identity unavailable".
 */
const RUNTIME_IDENTITY_PLACEHOLDER = "fluxiqRuntimeIdentityPlaceholder";
const BUILD_PROCESS_NAME = "core-web-build";

/**
 * Refuses a finished panel build that cannot attest Core's build identity:
 * one that left no server output to inspect, or whose server JavaScript
 * embeds the unstamped placeholder. Called before the build is marked
 * complete, so the refusal is a build failure naming the file rather than a
 * 400 from Core's identity endpoint in every run that serves it (t342).
 */
export async function assertStampedRuntimeIdentity(webDirectory: string): Promise<void> {
  const serverDirectory = path.join(webDirectory, ".next", "server");
  const files = await serverJavaScript(serverDirectory);
  if (files.length === 0) {
    throw new RunnerFailure("process.startup", "Core web panel production build left no server output to check for Core's runtime build identity", { details: { process: BUILD_PROCESS_NAME, path: serverDirectory } });
  }
  for (const file of files) {
    if (!(await readFile(file, "utf8")).includes(RUNTIME_IDENTITY_PLACEHOLDER)) continue;
    throw new RunnerFailure("process.startup", "Core web panel production build embeds Core's unstamped runtime build identity: it compiled Core from source instead of its built dist, so it was not published", {
      details: { process: BUILD_PROCESS_NAME, placeholder: RUNTIME_IDENTITY_PLACEHOLDER, file: path.relative(webDirectory, file) },
    });
  }
}

async function serverJavaScript(directory: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
  const nested = await Promise.all(entries.map(async entry => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return serverJavaScript(target);
    return entry.isFile() && entry.name.endsWith(".js") ? [target] : [];
  }));
  return nested.flat().sort();
}
