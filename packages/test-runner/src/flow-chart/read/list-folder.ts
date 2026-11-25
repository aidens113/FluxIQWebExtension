import { readdir } from "node:fs/promises";

/** A folder's entry names; empty only when the folder is not there. Anything else that goes wrong propagates. */
export async function listFolder(folder: string): Promise<string[]> {
  try {
    return await readdir(folder);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
