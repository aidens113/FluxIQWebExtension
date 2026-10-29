// The distinctive vocabulary of the ten realistic scenarios: capitalised words
// and phrases in the string literals of each scenario's own fixture data (site,
// brand, store, product, person, group and account names), kept when they
// belong to one scenario only and are not ordinary English. A word is ordinary
// English when Core writes it in lower case somewhere outside the model-facing
// files under scan, which is what keeps "cart", "checkout" or "offer" out
// without a list of them. Words that survive and are still generic go in
// `allow-list.mjs`, reviewed by hand.

import path from "node:path";
import { ALLOWED_TOKENS, RETIRED_EXAMPLES } from "./allow-list.mjs";
import { readText, typescriptFiles } from "./files.mjs";

export const REALISTIC_SCENARIOS = [
  "everything-store", "crossborder-marketplace", "bigbox-retail", "job-board", "local-classifieds",
  "auction-marketplace", "photo-social", "social-network-feed", "company-website", "professional-network"
];

const STRING_LITERAL = /"((?:[^"\\n]|\.)*)"/g;
const NAME_OR_PHRASE = /\b[A-Z][a-z]{3,}(?:[ -][A-Z][a-z]{2,})*\b/g;
const MIN_LENGTH = 5;

/** @param {string} text @returns {Set<string>} the capitalised words and phrases in its double-quoted strings */
export function namesInStrings(text) {
  const names = new Set();
  for (const literal of text.matchAll(STRING_LITERAL)) {
    for (const name of literal[1].matchAll(NAME_OR_PHRASE)) names.add(name[0]);
  }
  return names;
}

/** @param {string} text @returns {Set<string>} every lower-case word in the text */
export function lowerCaseWords(text) {
  return new Set(text.match(/\b[a-z]{4,}\b/g) ?? []);
}

/**
 * @param {{ scenariosRoot: string, ordinaryWords: Set<string>, scenarios?: string[] }} input
 * @returns {Promise<{ tokens: string[], sources: Record<string, number> }>}
 */
export async function buildVocabulary({ scenariosRoot, ordinaryWords, scenarios = REALISTIC_SCENARIOS }) {
  const owners = new Map();
  const sources = {};
  for (const scenario of scenarios) {
    const files = await typescriptFiles(path.join(scenariosRoot, scenario));
    sources[scenario] = files.length;
    for (const file of files) {
      for (const name of namesInStrings(await readText(file))) {
        if (!owners.has(name)) owners.set(name, new Set());
        owners.get(name).add(scenario);
      }
    }
  }
  const allowed = new Set(ALLOWED_TOKENS.map((token) => token.toLowerCase()));
  const tokens = [];
  for (const [name, scenariosWith] of owners) {
    if (scenariosWith.size !== 1 || name.length < MIN_LENGTH) continue;
    const words = name.toLowerCase().split(/[ -]/);
    if (allowed.has(name.toLowerCase())) continue;
    if (words.every((word) => ordinaryWords.has(word))) continue;
    tokens.push(name);
  }
  for (const example of RETIRED_EXAMPLES) if (!tokens.includes(example)) tokens.push(example);
  return { tokens: tokens.sort(), sources };
}
