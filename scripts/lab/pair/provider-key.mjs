// Whether a live run started from the pair would find its provider key, told
// by source and never by value. This follows the runner's own order
// (packages/test-runner/src/live-llm/provider-credential.ts): the process
// environment wins, then `.env`, then `.env.local` in the checkout the run
// starts from -- here the pair's extension worktree, which has neither unless
// someone put one there. Only whether the name is assigned is read; the value
// never leaves this function. `FLUXIQ_PROVIDER_KEY_FILES=none` keeps the
// runner out of both files, so it keeps this out of them too.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { LIVE_LLM_CREDENTIAL_NAMES, LIVE_LLM_DEFAULT_PROVIDER } from "../provider/index.mjs";

const FILES = [".env", ".env.local"];

/**
 * @param {{ env: NodeJS.ProcessEnv, extRoot: string, provider?: keyof typeof LIVE_LLM_CREDENTIAL_NAMES }} input
 * @returns {Promise<{ name: string, found: true, source: string } | { name: string, found: false, searched: string[] }>}
 */
export async function providerKeySource({ env, extRoot, provider = LIVE_LLM_DEFAULT_PROVIDER }) {
  const names = LIVE_LLM_CREDENTIAL_NAMES[provider];
  if (!names) throw new Error(`Unsupported live provider: ${provider}`);
  const name = names[0];
  for (const candidate of names) {
    if ((env[candidate] ?? "").trim() !== "") return { name: candidate, found: true, source: "the process environment" };
  }
  if (env.FLUXIQ_PROVIDER_KEY_FILES === "none") return { name, found: false, searched: ["the process environment"] };
  for (const file of FILES) {
    const contents = await readIfPresent(path.join(extRoot, file));
    if (contents === null) continue;
    for (const candidate of names) {
      const assigned = new RegExp(`^\\s*(?:export\\s+)?${candidate}\\s*=\\s*["']?[^\\s"'#]`, "mu");
      if (assigned.test(contents)) return { name: candidate, found: true, source: path.join(extRoot, file) };
    }
  }
  return { name, found: false, searched: ["the process environment", ...FILES.map((file) => path.join(extRoot, file))] };
}

async function readIfPresent(file) {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
