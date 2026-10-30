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
// - for a `lines` column -- a container whose lines are read each on its own
//   and joined -- the sample is its lines joined the way the page joins them,
//   and the readable label says it holds lines: `lines: 'Pickup today ·
//   Delivery today'`. The container's own words run its lines together, so they
//   are never the sample.
// - for a text or table column whose element has no words of its own -- a
//   price drawn as pieces "9" ",87" " €" in child spans -- the sample is its
//   described descendants' words joined as the page reads them
//   (`./container-words.ts`; live run `run-mvd0pbn9-bad36023`, step 0015), so
//   the column reads `price: '9,87 €'` and not only its class path. A class
//   path the page side closed with a note -- `(currency amount)`, `(number)`
//   -- is still a class path, and is labelled the same way.
//
// Keys are not changed. A key is what an extraction writes its column under
// (D16) and what a retained handle, a plan's `fields` map and a Flow already
// authored name it by; renaming it would break every one of those for a word
// the label now carries.

import { WEB_AUTOMATION_EXTRACT_LINE_SEPARATOR } from "../../../actions/extraction";
import type { WebAutomationExtractionProposalFieldSpec } from "../../../extraction";
import type { WebLlmEvidenceElement } from "../elements";
import { webLlmContainerWords } from "./container-words";
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

/** A label's closing parenthetical, which the page side adds to say what a path column holds: `(currency amount)`, `(all lines)`. */
const LABEL_NOTE = /\s*\([^()]*\)$/u;

/**
 * A column as the model is shown it: its label, readable where the page's is
 * a generated class path, and its sample from the first item that has it.
 * `lines` is a `lines` column's container's children in that item
 * (`./first-item/`); `page` is the detection's capture, whose elements an
 * element with no words of its own composes its sample from.
 */
export function webLlmShownColumn(
  label: string,
  element: WebLlmEvidenceElement | undefined,
  spec: WebAutomationExtractionProposalFieldSpec,
  lines?: readonly WebLlmEvidenceElement[],
  page?: readonly WebLlmEvidenceElement[]
): { label: string; sample: string | undefined } {
  if (spec.lines === true) return linesColumn(label, element, lines);
  const sample = sampleOf(element, spec) ?? composedSample(element, spec, page);
  const readable = readableLabel(label, element, sample);
  // A state mark's note is the state (`(pressed)`), which a readable label must keep: the same control's words are another column.
  return { label: spec.mark === "state" && readable !== label ? `${readable}${LABEL_NOTE.exec(label)?.[0] ?? ""}` : readable, sample };
}

/**
 * A `lines` column: its sample is each line's words joined as the page joins
 * them, leaving out a line with none, and its label, where the page's is a
 * class path, is `lines:` and that sample. No sample when its lines cannot be
 * told or one of them is a form control, whose value is never shown.
 */
function linesColumn(label: string, element: WebLlmEvidenceElement | undefined, lines: readonly WebLlmEvidenceElement[] | undefined): { label: string; sample: string | undefined } {
  if (element === undefined || lines === undefined || formControl(element) || lines.some(formControl)) return { label, sample: undefined };
  const said = lines
    .map((line) => screenedPageText(line.readable ?? line.text ?? line.name ?? line.ownText))
    .flatMap((line) => line === undefined || isWithheldText(line) || line.trim() === "" ? [] : [line.replace(/\s+/gu, " ").trim()]);
  const sample = bounded(said.join(WEB_AUTOMATION_EXTRACT_LINE_SEPARATOR));
  const path = label.replace(LABEL_NOTE, "");
  return { label: sample !== undefined && generatedLabel(path) ? `lines: '${sample.replace(/'/gu, "’")}'` : label, sample };
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
 * A text or table column's sample from its element's described descendants,
 * where the element has no words of its own; never for a form control, and
 * never where the element has words, whose sample `sampleOf` already gave or
 * withheld.
 */
function composedSample(element: WebLlmEvidenceElement | undefined, spec: WebAutomationExtractionProposalFieldSpec, page: readonly WebLlmEvidenceElement[] | undefined): string | undefined {
  if (element === undefined || page === undefined || (spec.kind !== "text" && spec.kind !== "column") || formControl(element)) return undefined;
  const own = element.readable ?? element.text ?? element.name ?? element.ownText;
  if (own !== undefined && own.trim() !== "") return undefined;
  return bounded(webLlmContainerWords(element, page));
}

/**
 * The label the model is shown: the page's own when it is words, else -- for
 * a generated class path -- what the element is and its sample, or the page's
 * label when neither can be told.
 */
function readableLabel(label: string, element: WebLlmEvidenceElement | undefined, sample: string | undefined): string {
  if (!generatedLabel(label.replace(LABEL_NOTE, "")) || element === undefined) return label;
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
  return `${(space > MAX_SAMPLE / 2 ? room.slice(0, space) : room).replace(/[\s,;:.·]+$/u, "")}…`;
}

function attribute(element: WebLlmEvidenceElement, name: string): string | undefined {
  return element.attributes?.find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
}
