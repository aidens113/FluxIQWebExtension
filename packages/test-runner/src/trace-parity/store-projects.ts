// The projects an Automation Studio storage root holds: each directory under
// `projects/` with a `project.sqlite`, in name order. Only the directory
// listing is read; every trace is then read through Core's store API. A root
// without a `projects/` directory holds none; any other failure is thrown.

import { readdir, stat } from "node:fs/promises";
import path from "node:path";

export async function listStoreProjects(automationDataDir: string): Promise<string[]> {
  const projectsDir = path.join(automationDataDir, "projects");
  let names: string[];
  try {
    names = (await readdir(projectsDir, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return [];
  }
  const held: string[] = [];
  for (const name of names.sort()) {
    if (await isFile(path.join(projectsDir, name, "project.sqlite"))) held.push(name);
  }
  return held;
}

async function isFile(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return false;
  }
}
