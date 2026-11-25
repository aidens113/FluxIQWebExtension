import { readFile } from "node:fs/promises";

/** A JSON file's content; `undefined` only when the file is not there. Anything else that goes wrong (unreadable, not JSON) propagates. */
export async function readJsonFile<T>(file: string): Promise<T | undefined> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  return JSON.parse(text) as T;
}
