import { randomBytes } from "node:crypto";
import { rename, rm, writeFile } from "node:fs/promises";

/** Windows refuses a rename over a file another process has open for a moment; these codes are retried. */
const TRANSIENT_RENAME = new Set(["EPERM", "EBUSY", "EACCES"]);
const RENAME_ATTEMPTS = 10;
const RENAME_RETRY_MS = 25;

/**
 * Writes `text` beside `file` under a unique temporary name and renames it into
 * place, so a reader sees the old file or the new one, never half of either.
 */
export async function writeFileAtomically(file: string, text: string): Promise<void> {
  const temporary = `${file}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(temporary, text, "utf8");
  for (let attempt = 1; ; attempt += 1) {
    try {
      await rename(temporary, file);
      return;
    } catch (error) {
      if (!TRANSIENT_RENAME.has(String((error as NodeJS.ErrnoException).code)) || attempt >= RENAME_ATTEMPTS) {
        await rm(temporary, { force: true });
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, RENAME_RETRY_MS));
    }
  }
}
