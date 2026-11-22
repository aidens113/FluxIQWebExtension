import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

/** Current authored implementation, including uncommitted/untracked source; docs and ignored runtime data are excluded. */
export async function offlineSourceFingerprint(root: string): Promise<string> {
  const { stdout } = await promisify(execFile)("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root, maxBuffer: 16 * 1024 * 1024 });
  const files = [...new Set(stdout.split("\0"))].filter((file) => /\.(?:ts|tsx|js|mjs|json)$/u.test(file) && !/^(?:docs|test-runs|\.fluxiq)\//u.test(file)).sort();
  const hash = createHash("sha256");
  for (const file of files) {
    let bytes: Buffer;
    try { bytes = await readFile(path.join(root, file)); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      hash.update(JSON.stringify([file, "deleted"]));
      continue;
    }
    hash.update(JSON.stringify([file, bytes.byteLength]));
    hash.update(bytes);
  }
  return hash.digest("hex");
}
