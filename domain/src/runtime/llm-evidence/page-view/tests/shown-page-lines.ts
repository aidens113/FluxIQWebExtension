// Test support: the element lines of a page as the model read it (t223).
//
// Every page leaves the domain as the compact view (`web-llm-page.v3`), whose
// `page` is header lines, a blank line, then one line per element that has
// visible words or is a control: `<handle> [<heading>] [<kind>] ["<words>"] ...`.
// A test that once read `elements` off a returned packet reads these instead:
// the handle the model would copy, the kind word, and the words it saw.

import { present } from "../../present";

const KINDS = /^(?:link|button|field(?::[\w-]+)?|select|checkbox|radio|switch|toggle|tab|menuitem|option|slider|treeitem|img|clickable|dialog|layer|h[1-6])$/u;

export type ShownPageLine = {
  /** The handle the line starts with, `tN`. */
  target: string;
  /** The heading tag written before the kind, for a line under a heading that has no line of its own. */
  heading?: string;
  /** The kind word, `field:email` included; absent for plain text. */
  kind?: string;
  /** The words, unquoted; absent for a line without any. */
  words?: string;
  /** The whole line, as printed. */
  line: string;
};

/** The `page` text of a result: the published page itself, or the `page` a refusal carries. */
export function shownPageText(result: unknown): string {
  const record = result as { page?: unknown } | undefined;
  if (typeof record?.page === "string") return record.page;
  const inner = (record?.page as { page?: unknown } | undefined)?.page;
  if (typeof inner === "string") return inner;
  throw new Error("the result carries no published page");
}

/** Every element line of a result's page, in page order; markers and header lines are left out. */
export function shownPageLines(result: unknown): ShownPageLine[] {
  const text = shownPageText(result);
  const blank = text.indexOf("\n\n");
  const body = blank < 0 ? "" : text.slice(blank + 2);
  return body.split("\n").flatMap((line) => {
    const match = /^(t[1-9][0-9]*)(?: (.*))?$/u.exec(line);
    return match ? [parsed(match[1]!, match[2] ?? "", line)] : [];
  });
}

/** The handle of the first line whose words are `words`, or a thrown error naming what was shown. */
export function shownHandle(result: unknown, words: string): string {
  const lines = shownPageLines(result);
  const found = lines.find((line) => line.words === words);
  if (!found) throw new Error(`no line reads "${words}"; shown: ${lines.map((line) => line.line).join(" | ")}`);
  return found.target;
}

function parsed(target: string, rest: string, line: string): ShownPageLine {
  const tokens = rest.split(" ");
  let index = 0;
  let heading: string | undefined;
  let kind: string | undefined;
  if (/^h[1-6]$/u.test(tokens[0] ?? "") && KINDS.test(tokens[1] ?? "") && !/^h[1-6]$/u.test(tokens[1] ?? "")) {
    heading = tokens[0];
    kind = tokens[1];
    index = 2;
  } else if (KINDS.test(tokens[0] ?? "")) {
    kind = tokens[0];
    index = 1;
  }
  const after = tokens.slice(index).join(" ");
  const quoted = /^"((?:[^"\\]|\\.)*)"/u.exec(after);
  const words = quoted ? quoted[1]!.replace(/\\"/gu, "\"") : undefined;
  return present<ShownPageLine>({ target, heading, kind, words, line });
}
