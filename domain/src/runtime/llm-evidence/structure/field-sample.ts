// What a detected column holds, said so the model can tell its columns apart
// without reading the list to find out (supervisor, 2026-10-06; live run
// `run-mux6nxst-c9bca37c` step 0014).
//
// On a site styled by atomic classes a column's key and label are its class
// path -- key `div_x0531l50_x1r2vv8_x4q0id2_div_x1a4yqcp_xa73opb_xtlve1b`, label
// `div.x0531l50.x1r2vv8.x4q0id2 > div.x1a4yqcp...` -- and the packet carried no
// value (D3), so the model read the list, inspected rows and read it again to
// learn which column was which: lane D read the same list 10 to 16 times per
// build. `at` (`./first-item/`) points at the column's element in the page
// view, but only where the model was shown that page, and a handle still has
// to be looked up line by line.
//
// So each column now carries:
//
// - `sample`: its value in the first item that has it, read from the
//   detection's own capture as the page view reads it -- the element's words
//   for a text or table column, its link's path for a link, the attribute for
//   an attribute column -- screened as every page string the domain publishes,
//   one line, at most `MAX_SAMPLE` characters, cut at a word with "…". Never a
//   form control's value (a `value` column, or any input, select or textarea),
//   never a value the screen withholds; a sensitive control's column is
//   already dropped from the packet (`./packet.ts`).
// - a readable `label` where the page's own label is a generated class path
//   (`generatedLabel`): what the element is -- a link, a button, a heading, an
//   image, a price, a number, text -- with its sample: `link: 'Tom Becker'`,
//   `text: '1 mutual friend'`. A label the page wrote in words (a header, a
//   test id, a badge's name) is kept as it was.
//
// Keys are not changed. A key is what an extraction writes its column under
// (D16) and what a retained handle, a plan's `fields` map and a Flow already
// authored name it by; renaming it would break every one of those for a word
// the label now carries.

import type { WebAutomationExtractionProposalFieldSpec } from "../../../extraction";
import type { WebLlmEvidenceElement } from "../elements";
import { isWithheldText, screenedPageText } from "../withheld";

/** The longest sample a column carries. */
const MAX_SAMPLE = 40;
const FORM_CONTROL = /^(?:input|select|textarea|option)$/u;
/** A class token a build tool generated: letters and digits run together (`x1a4yqcp`, `css-1q2w3e`, `sc-bdVaJa`, `_3xY7z`). */
const GENERATED_TOKEN = /^(?:css-|sc-|jsx-)|^(?=[\w-]*\d)(?=[\w-]*[a-z])[\w-]{5,}$/iu;
/** A label that is a class path: tags and classes joined by dots and child combinators. */
const CLASS_PATH = /^[\w-]+(?:[.:][\w()-]+)+(?:\s*>\s*[\w-]+(?:[.:][\w()-]+)*)*$/u;
const PRICE = /^[$€£¥]\s?\d|^\d[\d.,\s]*\s?(?:[$€£¥]|USD|EUR|GBP)$/u;
const NUMBER = /^[\d.,\s%]+$/u;

/**
 * A column as the model is shown it: its label, readable where the page's is
 * a generated class path, and its sample from the first item that has it.
 */
export function webLlmShownColumn(label: string, element: WebLlmEvidenceElement | undefined, spec: WebAutomationExtractionProposalFieldSpec): { label: string; sample: string | undefined } {
  const sample = sampleOf(element, spec);
  return { label: readableLabel(label, element, sample), sample };
}

/** The column's value in the first item that has it, or `undefined` when none may be shown. */
function sampleOf(element: WebLlmEvidenceElement | undefined, spec: WebAutomationExtractionProposalFieldSpec): string | undefined {
  if (element === undefined || spec.kind === "value" || formControl(element)) return undefined;
  const raw = spec.kind === "link"
    ? linkPath(element.href ?? attribute(element, "href"))
    : spec.kind === "attribute" && spec.attribute !== undefined
      ? spec.attribute.toLowerCase() === "href" ? linkPath(element.href ?? attribute(element, "href")) : attribute(element, spec.attribute)
      : element.readable ?? element.text ?? element.name ?? element.ownText;
  return bounded(raw);
}

/**
 * The label the model is shown: the page's own when it is words, else -- for
 * a generated class path -- what the element is and its sample, or the page's
 * label when neither can be told.
 */
function readableLabel(label: string, element: WebLlmEvidenceElement | undefined, sample: string | undefined): string {
  if (!generatedLabel(label) || element === undefined) return label;
  const what = whatItIs(element, sample);
  return sample === undefined ? what ?? label : `${what ?? "text"}: '${sample.replace(/'/gu, "’")}'`;
}

/** Whether a label is a class path most of whose class names a build tool generated. */
function generatedLabel(label: string): boolean {
  if (!CLASS_PATH.test(label.trim())) return false;
  const tokens = [...label.matchAll(/\.([\w-]+)/gu)].map((match) => match[1] ?? "");
  return tokens.length > 0 && tokens.filter((token) => GENERATED_TOKEN.test(token)).length * 2 >= tokens.length;
}

/** What the element is, in one word a person uses, from its role, tag or the shape of its words. */
function whatItIs(element: WebLlmEvidenceElement, sample: string | undefined): string | undefined {
  const role = (element.role ?? element.implicitRole ?? "").toLowerCase();
  const tag = element.tag.toLowerCase();
  if (role === "link" || tag === "a") return "link";
  if (role === "button" || tag === "button") return "button";
  if (role === "heading" || /^h[1-6]$/u.test(tag)) return "heading";
  if (role === "img" || tag === "img") return "image";
  if (sample !== undefined && PRICE.test(sample)) return "price";
  if (sample !== undefined && NUMBER.test(sample)) return "number";
  return sample === undefined ? undefined : "text";
}

function formControl(element: WebLlmEvidenceElement): boolean {
  return FORM_CONTROL.test(element.tag.toLowerCase()) || element.inputType !== undefined || element.controlType !== undefined;
}

/** A link's path and query on its own site: never its origin, never a fragment. */
function linkPath(href: string | undefined): string | undefined {
  if (href === undefined || !URL.canParse(href, "http://page.invalid/")) return undefined;
  const url = new URL(href, "http://page.invalid/");
  return url.protocol === "http:" || url.protocol === "https:" ? `${url.pathname}${url.search}` : undefined;
}

/** Screened, one line, at most `MAX_SAMPLE` characters cut at a word; `undefined` when nothing may be shown. */
function bounded(text: string | undefined): string | undefined {
  const said = screenedPageText(text);
  if (said === undefined || isWithheldText(said)) return undefined;
  const line = said.replace(/\s+/gu, " ").trim();
  if (line === "") return undefined;
  if (line.length <= MAX_SAMPLE) return line;
  const room = line.slice(0, MAX_SAMPLE - 1);
  const space = room.lastIndexOf(" ");
  return `${(space > MAX_SAMPLE / 2 ? room.slice(0, space) : room).replace(/[\s,;:.]+$/u, "")}…`;
}

function attribute(element: WebLlmEvidenceElement, name: string): string | undefined {
  return element.attributes?.find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
}
