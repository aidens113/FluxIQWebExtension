// Which Core files hold text given to a model, and which hold ordinary English.

import path from "node:path";
import { typescriptFiles } from "./files.mjs";

const SOURCE = path.join("packages", "fluxiq", "src");
const WORDS_MODULE = /(instruction|words|description|prompt|catalog)/i;

/** @param {string} coreRoot @returns {Promise<string[]>} the model-facing files: runtime llm and flow-authoring/bootstrap/plan, plus instruction, words, description, prompt and catalog modules anywhere in the runtime */
export async function modelFacingFiles(coreRoot) {
  const source = path.join(coreRoot, SOURCE);
  const runtime = path.join(source, "runtime");
  const named = [
    await typescriptFiles(path.join(runtime, "llm")),
    await typescriptFiles(path.join(runtime, "flow-authoring", "bootstrap", "plan"))
  ];
  // A walk of a missing directory finds nothing, so a moved directory would otherwise pass this check by reading no text.
  if (named.some((files) => files.length === 0)) throw new Error("model-text: Core's model-facing directories were not found; update scripts/check/model-text/targets.mjs");
  const chosen = new Set(named.flat());
  for (const root of [runtime, path.join(source, "framework", "automation-service")]) {
    for (const file of await typescriptFiles(root)) {
      if (WORDS_MODULE.test(path.basename(file))) chosen.add(file);
    }
  }
  return [...chosen].sort();
}

/** @param {string} coreRoot @returns {Promise<string[]>} every non-test Core source file, the corpus of ordinary English */
export function coreSourceFiles(coreRoot) {
  return typescriptFiles(path.join(coreRoot, "packages", "fluxiq", "src"));
}
