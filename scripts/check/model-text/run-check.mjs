// Run the model-text check against a Core checkout.

import path from "node:path";
import { readText } from "./files.mjs";
import { findTokens, stringLiterals } from "./scan.mjs";
import { coreSourceFiles, modelFacingFiles } from "./targets.mjs";
import { buildVocabulary, lowerCaseWords } from "./vocabulary.mjs";

/**
 * @param {{ extRoot: string, coreRoot: string }} input
 * @returns {Promise<{ hits: { file: string, line: number, token: string }[], vocabulary: { tokens: string[], sources: Record<string, number> }, scanned: number, literals: number }>}
 */
export async function runModelTextCheck({ extRoot, coreRoot }) {
  const scanned = await modelFacingFiles(coreRoot);
  const scannedSet = new Set(scanned);
  const ordinaryWords = new Set();
  for (const file of await coreSourceFiles(coreRoot)) {
    if (scannedSet.has(file)) continue;
    for (const word of lowerCaseWords(await readText(file))) ordinaryWords.add(word);
  }
  const vocabulary = await buildVocabulary({ scenariosRoot: path.join(extRoot, "apps", "scenario-lab", "src", "scenarios"), ordinaryWords });
  const hits = [];
  let literals = 0;
  for (const file of scanned) {
    const text = await readText(file);
    literals += stringLiterals(text).length;
    hits.push(...findTokens({ file: path.relative(coreRoot, file).split(path.sep).join("/"), text, tokens: vocabulary.tokens }));
  }
  return { hits, vocabulary, scanned: scanned.length, literals };
}
