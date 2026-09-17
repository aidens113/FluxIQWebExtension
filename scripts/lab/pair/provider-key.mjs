// Whether a live run started from the pair would find its provider key, told
// by source and never by value. This follows the runner's own order
// (packages/test-runner/src/live-llm/provider-credential.ts): the process
// environment wins, then `.env`, then `.env.local` in the checkout the run
// starts from -- here the pair's extension worktree, which has neither unless
// someone put one there. Only whether the name is assigned is read; the value
// never leaves this function.

import { readFile } from "node:fs/promises";
import path from "node:path";

const NAME = "DEEPSEEK_API_KEY";
const FILES = [".env", ".env.local"];
const ASSIGNED = new RegExp(`^\\s*(?:export\\s+)?${NAME}\\s*=\\s*["']?[^\\s"'#]`, "mu");

/**
 * @param {{ env: NodeJS.ProcessEnv, extRoot: string }} input
 * @returns {Promise<{ name: string, found: true, source: string } | { name: string, found: false, searched: string[] }>}
 */
export async function providerKeySource({ env, extRoot }) {
  if ((env[NAME] ?? "").trim() !== "") return { name: NAME, found: true, source: "the process environment" };
  for (const file of FILES) {
    const contents = await readIfPresent(path.join(extRoot, file));
    if (contents !== null && ASSIGNED.test(contents)) return { name: NAME, found: true, source: path.join(extRoot, file) };
  }
  return { name: NAME, found: false, searched: ["the process environment", ...FILES.map((file) => path.join(extRoot, file))] };
}

async function readIfPresent(file) {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
