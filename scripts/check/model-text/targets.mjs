// Which Core files hold text given to a model, and which hold ordinary English.

import path from "node:path";
import { typescriptFiles } from "./files.mjs";

const RUNTIME = path.join("packages", "fluxiq", "src", "programs", "automation-studio", "runtime");
const WORDS_MODULE = /(instruction|words|description|prompt|catalog)/i;

/** @param {string} coreRoot @returns {Promise<string[]>} the model-facing files: runtime llm and flow-bootstrap/plan, plus instruction, words, description, prompt and catalog modules anywhere in the runtime */
export async function modelFacingFiles(coreRoot) {
  const runtime = path.join(coreRoot, RUNTIME);
  const chosen = new Set([
    ...await typescriptFiles(path.join(runtime, "llm")),
    ...await typescriptFiles(path.join(runtime, "flow-bootstrap", "plan"))
  ]);
  for (const file of await typescriptFiles(runtime)) {
    if (WORDS_MODULE.test(path.basename(file))) chosen.add(file);
  }
  return [...chosen].sort();
}

/** @param {string} coreRoot @returns {Promise<string[]>} every non-test Core source file, the corpus of ordinary English */
export function coreSourceFiles(coreRoot) {
  return typescriptFiles(path.join(coreRoot, "packages", "fluxiq", "src"));
}
