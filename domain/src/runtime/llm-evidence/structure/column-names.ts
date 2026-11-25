// The readable, stable name a read keeps each detected column under (t1038, D13).
//
// A detected column's key is derived from the label the page gives it
// (`extraction/label-key.ts`). Where that label is the page's own words -- a
// header, a test id, an attribute's name, a badge's name -- the key reads as a
// word already (`price`, `rating`). Where it is a class path a build tool
// generated, the key is that path flattened
// (`ul_css-1ysgock_li_1_div_css-1n3n0dq_span_css-0ek4plr_currency_amount`), and
// every read that kept it wrote it into its rows, its record schema and every
// dataset after it; a model that had to retype it got it wrong (the 2026-11-24
// bigbox runs: 11 reads refused `column_not_in_detected_list` for a key copied
// from a detection).
//
// So each column also gets a name: its key where the key is the page's words,
// and otherwise what the column's element is, in the closed words the readable
// label already uses (`./field-sample.ts`: link, button, heading, image, price,
// number, text, lines), with what it reads of that element (`url` for a link's
// address, the attribute's name for an attribute) -- `link`, `url`, `price`,
// `image_src`, `image_alt`. No page value is ever in a name, so a name may be
// stored where a label may (`./stored-label.ts`, t997). Two columns that would
// share a name are told apart by the key function's own ordinal (`text`,
// `text_2`), and no name is ever another column's key, so a key still names
// exactly the column it named.
//
// The name is computed once, when the list is detected, and kept in the
// handle's binding (`./handles.ts`, `names`) and in a saved read's binding
// (`../plan-resolution/extraction/saved-list.ts`), so the same list read again
// keeps the same names. Keys are not changed: a read, a condition or a Flow
// that names a key still names its column.

import type { WebAutomationExtractFieldSpec } from "../../../actions/extraction";
import { webAutomationExtractionFieldKey } from "../../../extraction";
import { webLlmGeneratedLabel } from "./generated-label";
import { webLlmStoredColumnLabel } from "./stored-label";

/** One detected column, as the namer reads it. */
export type WebLlmNamedColumn = {
  key: string;
  /** The page's own label for the column, as the detection proposed it. */
  pageLabel: string;
  /** The label the model is shown (`./field-sample.ts`): the page's words, or what the element is and its sample. */
  shownLabel: string;
  spec: Pick<WebAutomationExtractFieldSpec, "kind" | "attribute" | "mark">;
};

/** What the element is, as the readable label leads with it (`./field-sample.ts`, `whatItIs`). */
const ELEMENT_WORD = /^(link|button|heading|image|price|number|text|lines): '/u;
/** A state mark's note at the end of a label: `(pressed)`, `(checked)`. */
const STATE_NOTE = /\(([a-z ]{1,20})\)$/u;

/**
 * Each column's name, by key (header). Unique within the list, never another
 * column's key, and the same for the same detection.
 */
export function webLlmReadableColumnNames(columns: readonly WebLlmNamedColumn[]): Record<string, string> {
  const taken = new Set(columns.map((column) => column.key));
  const names: Record<string, string> = {};
  for (const column of columns) {
    if (pageWords(column)) {
      names[column.key] = column.key;
      continue;
    }
    const name = webAutomationExtractionFieldKey(described(column), taken);
    taken.add(name);
    names[column.key] = name;
  }
  return names;
}

/** Whether the column's key was derived from the page's own words, and so reads as a name already. */
function pageWords(column: WebLlmNamedColumn): boolean {
  // The page side labels an attribute column by its element's path and the attribute (`img.css-1lxw2mb src`): still a generated path.
  const attribute = column.spec.kind === "attribute" ? column.spec.attribute : undefined;
  if (attribute !== undefined && column.pageLabel.endsWith(` ${attribute}`) && webLlmGeneratedLabel(column.pageLabel.slice(0, -attribute.length - 1).trim())) return false;
  return webLlmStoredColumnLabel(column.key, column.pageLabel) !== column.key || column.pageLabel.trim().toLowerCase() === column.key;
}

/** What the column is, in words a name is made of: the element, then what of it is read, then a state mark's state. */
function described(column: WebLlmNamedColumn): string {
  const sampled = ELEMENT_WORD.exec(column.shownLabel)?.[1];
  // Plain text has no word of its own; its path says more where it is an image or sits inside a link or heading.
  const element = sampled !== undefined && sampled !== "text" ? sampled : pathWord(column.pageLabel) ?? sampled;
  const { kind, attribute, mark } = column.spec;
  const state = mark === "state" ? STATE_NOTE.exec(column.shownLabel)?.[1] : undefined;
  const parts = kind === "link"
    ? [element === undefined || element === "link" ? "url" : `${element} url`]
    : kind === "attribute" && attribute !== undefined
      ? [element ?? "", attribute]
      : kind === "value" ? ["value"]
      : [element ?? (kind === "column" ? "column" : "text")];
  return [...parts, state ?? ""].filter((part) => part !== "").join(" ");
}

/** The tags a class path's segments name, as a person names them; a tag absent here says nothing of what the element is. */
const TAG_WORDS: Readonly<Record<string, string>> = { a: "link", img: "image", picture: "image", svg: "image", button: "button", h1: "heading", h2: "heading", h3: "heading", h4: "heading", h5: "heading", h6: "heading", time: "time" };

/**
 * What a class-path column's element is, read off the tags of its path (`ul.css-1a2b > li:1 > a.css-3e4f > span.css-5g6h`):
 * its own tag where that names something (`img` is an image), else the text of the nearest link or heading it sits in
 * (`link text`). Tags only: never a class, an index or a word of the page.
 */
function pathWord(label: string): string | undefined {
  // The page side ends an address or attribute column's path with what it reads (`... a.css-3e4f url`, `... img.css-1lxw2mb src`).
  const tags = label.replace(/\s*\([^()]*\)$/u, "").replace(/(?<=[^\s>])\s+[\w-]+$/u, "").split(">")
    .map((segment) => /^\s*([a-z][a-z0-9]*)/u.exec(segment.toLowerCase())?.[1] ?? "");
  const own = TAG_WORDS[tags.at(-1) ?? ""];
  if (own !== undefined) return own;
  const within = [...tags.slice(0, -1)].reverse().map((tag) => TAG_WORDS[tag]).find((word) => word === "link" || word === "heading");
  return within === undefined ? undefined : `${within} text`;
}
