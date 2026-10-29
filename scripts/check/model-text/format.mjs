// The report of a model-text check.

/** @param {{ hits: { file: string, line: number, token: string }[], vocabulary: { tokens: string[] }, scanned: number, literals: number }} result @returns {string} */
export function formatModelTextReport(result) {
  const summary = `${result.vocabulary.tokens.length} scenario tokens, ${result.scanned} model-facing Core files, ${result.literals} string literals`;
  if (result.hits.length === 0) return `model-text: ok (${summary})`;
  const lines = result.hits.map((hit) => `  ${hit.file}:${hit.line}  "${hit.token}"`);
  return [
    `model-text: ${result.hits.length} scenario-shaped token(s) in model-facing Core text (${summary}).`,
    "Text the product gives a model never mirrors a realistic scenario's site, products or names (AGENTS.md, \"Model guidance never teaches to the test\"). Rewrite the example on a different kind of site; add to scripts/check/model-text/allow-list.mjs only a token that is generic.",
    ...lines
  ].join("\n");
}
