import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

/** Fingerprint a closed synthetic starting-store copy before opening/migrating it. No contents leave this function. */
export async function recordedStoreDigest(directory: string, excludedTopLevel: readonly string[] = []): Promise<string> {
  const hash = createHash("sha256");
  const walk = async (relative: string): Promise<void> => {
    const entries = await readdir(path.join(directory, relative), { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const child = path.join(relative, entry.name);
      if (excludedTopLevel.includes(child.split(path.sep)[0]!)) continue;
      if (entry.isSymbolicLink()) throw new Error("recorded_store_symlink_refused");
      if (entry.isDirectory()) await walk(child);
      else if (entry.isFile()) {
        const bytes = await readFile(path.join(directory, child));
        hash.update(JSON.stringify([child.replaceAll("\\", "/"), bytes.byteLength]));
        hash.update(bytes);
      } else throw new Error("recorded_store_nonfile_refused");
    }
  };
  await walk("");
  return hash.digest("hex");
}
