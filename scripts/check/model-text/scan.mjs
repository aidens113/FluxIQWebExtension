// Scan the text Core gives a model for vocabulary tokens. Only the contents of
// string and template literals are model text; comments, identifiers and regex
// literals are not, so the file is parsed with the TypeScript compiler and the
// literal nodes are read, never the raw lines.

import { createRequire } from "node:module";

const ts = createRequire(import.meta.url)("typescript");

function escapeForRegExp(token) {
  return token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const LITERAL_KINDS = new Set([
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail
]);

/** @param {string} text @returns {{ start: number, content: string }[]} every string literal and every static part of a template literal, with its offset in the file */
export function stringLiterals(text) {
  const source = ts.createSourceFile("model-text.ts", text, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  const found = [];
  (function visit(node) {
    if (LITERAL_KINDS.has(node.kind)) {
      const start = node.getStart(source);
      found.push({ start, content: text.slice(start, node.getEnd()) });
    }
    ts.forEachChild(node, visit);
  })(source);
  return found;
}

/**
 * @param {{ file: string, text: string, tokens: string[] }} input
 * @returns {{ file: string, line: number, token: string }[]} each token found on each line of each string or template literal (comments are not model text)
 */
export function findTokens({ file, text, tokens }) {
  const patterns = tokens.map((token) => ({ token, pattern: new RegExp(`(?<![A-Za-z])${escapeForRegExp(token)}(?![A-Za-z])`, "i") }));
  const hits = [];
  const seen = new Set();
  for (const { start, content } of stringLiterals(text)) {
    const firstLine = text.slice(0, start).split("\n").length;
    content.split("\n").forEach((piece, index) => {
      for (const { token, pattern } of patterns) {
        const key = `${firstLine + index}\0${token}`;
        if (pattern.test(piece) && !seen.has(key)) {
          seen.add(key);
          hits.push({ file, line: firstLine + index, token });
        }
      }
    });
  }
  return hits.sort((a, b) => a.line - b.line);
}
