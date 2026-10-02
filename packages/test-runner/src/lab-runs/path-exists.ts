import { stat } from "node:fs/promises";

/** Whether anything is at `location`; any failure other than its absence is a failure. */
export async function pathExists(location: string): Promise<boolean> {
  try {
    await stat(location);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}
