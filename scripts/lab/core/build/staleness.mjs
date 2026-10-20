// The newest shipped file under a directory, by modification time.
//
// This repository's own builds are held to it (`../../domain-build-staleness.mjs`):
// a source newer than its output means the output is stale. It is coarse and
// deliberately so: it cannot tell a meaningful edit from a touched file, and the
// cost of a false alarm is one rebuild. FluxIQ Core's build is no longer judged
// this way; Core's own build cache answers that exactly (`currency.mjs`).

import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const SKIPPED = new Set(["node_modules", "dist", ".next", ".git", ".turbo", "tests"]);

/**
 * A test file is not compiled into `dist`, so its mtime says nothing about
 * whether the build matches what the Lab will run. Counting it would block
 * every campaign the moment anyone touched a Core test -- which is exactly what
 * happens while a worker is fixing assertions beside a running campaign.
 */
function shippedSource(name) {
  return !name.endsWith(".test.ts") && !name.endsWith(".test.mts") && !name.endsWith(".test.js");
}

/**
 * The newest shipped file under one directory, by modification time.
 *
 * Test files and the build's own directories are skipped: they say nothing
 * about whether the output matches what will run.
 *
 * @param {string} root
 * @returns {Promise<{ newestMs: number, newestPath: string | null }>}
 */
export async function scanNewest(root) {
  const found = { newestMs: 0, newestPath: null };
  await walk(root, found);
  return found;
}

async function walk(directory, found) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "EACCES" || error?.code === "EPERM") return;
    throw error;
  }
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED.has(entry.name)) await walk(target, found);
      continue;
    }
    if (!entry.isFile() || !shippedSource(entry.name)) continue;
    let stats;
    try {
      stats = await stat(target);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    if (stats.mtimeMs > found.newestMs) {
      found.newestMs = stats.mtimeMs;
      found.newestPath = target;
    }
  }
}
