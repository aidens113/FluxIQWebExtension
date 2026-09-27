import { stat } from "node:fs/promises";
import path from "node:path";
import { RunnerFailure } from "../../failure.js";

/**
 * Refuses a run before anything is started when the built E2E extension is not
 * where the Lab expects it.
 *
 * The check is the presence of `manifest.json`, because that is the file
 * Chromium is pointed at by `--load-extension`: a directory that exists but
 * holds no manifest fails the browser launch several steps later, with a
 * Playwright message that names neither the Lab's build nor the path it looked
 * in. Raised as `environment.missing`, which is the category the bench skips a
 * cell for rather than recording a product failure against it.
 */
export async function requireExtension(extensionPath: string): Promise<void> {
  try {
    await stat(path.join(extensionPath, "manifest.json"));
  } catch (cause) {
    throw new RunnerFailure("environment.missing", `Built E2E extension is missing: ${extensionPath}`, { cause });
  }
}
