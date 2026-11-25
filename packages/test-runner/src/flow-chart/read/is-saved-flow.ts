import { readFile } from "node:fs/promises";
import path from "node:path";

/** Whether the run saved a Flow: its `attempt.json` names a saved Flow id. The draft is what is charted otherwise. */
export async function isSavedFlow(runDirectory: string): Promise<boolean> {
  let text: string;
  try {
    text = await readFile(path.join(runDirectory, "attempt.json"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
  return /"saved"\s*:\s*\{[^{}]*"flowId"\s*:\s*"[^"]+"/u.test(text);
}
