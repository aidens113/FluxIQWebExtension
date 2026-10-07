import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The summary of the first failure a run's bundle recorded, or `null` when it
 * recorded none. An attempt that died before finalizing has no summary; its
 * printed result still describes it.
 *
 * @param {string} runPath
 * @returns {string | null}
 */
export function readFirstFailure(runPath) {
  let text;
  try {
    text = readFileSync(path.join(runPath, "summary.json"), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  const summary = JSON.parse(text)?.firstFailure?.summary;
  return typeof summary === "string" && summary.trim() !== "" ? summary.trim() : null;
}
