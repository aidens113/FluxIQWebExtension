// What kind of value a detected column holds, and its sample read as that kind
// (contract CC1: `type` and `parsed` beside each sample).
//
// A column's kind (`text`, `attribute`, `link`...) says how the page reads it,
// never what the value is, so a price, a count and a date were all `text` and
// Core had to guess from the words which comparison a condition on it meant.
// The type is said from what the domain already holds, most certain first:
//
// - what the field reads: a mark is a `flag`; a link, or an attribute that
//   holds an address, is a `url`; an attribute named as an id is an `id`;
// - what the page measured over the run's items: a path column whose every
//   value is a currency amount or a number carries that note in its label
//   (`apps/extension/src/content/extraction/value-shape.ts`), and a path column
//   without one had values of mixed shape, so its one sample is never read as a
//   number here;
// - otherwise the shape of the column's one sample: a currency amount, a plain
//   number, a date (Core's own reader, `readAutomationStudioRecordDate`), a
//   whole number with a word or two after it (a `count`, "12 reviews"), or text.
//
// `parsed` is the sample as that type reads it, by Core's readers: the number
// of a `number`, `currency` or `count`, and the day (`2026-09-21`) or instant
// of a `date` or `datetime` that states its year. A date that depends on when it
// is read ("3 days ago", "Sep 12") has no `parsed`: the packet would say a
// different day on another day. Nothing is said of a column with no sample and
// nothing structural to go on, and no type is a refusal of anything: Core reads
// an absent type as unknown.

import { readAutomationStudioRecordDate, readAutomationStudioRecordNumber } from "fluxiq/automation-studio/nodes";
import type { WebAutomationExtractionProposalFieldSpec } from "../../../extraction";

/** The types a column may be said to hold (CC1), Core's domain-neutral words. */
export type WebLlmColumnType = "text" | "number" | "currency" | "count" | "date" | "datetime" | "url" | "id" | "flag";

/** Attributes whose value is an address. */
const ADDRESS_ATTRIBUTES: ReadonlySet<string> = new Set(["href", "src", "data-href", "data-url", "data-src"]);
/** An attribute named as the item's id: `data-id`, `data-item-id`, `data-sku`, `data-key`, `data-slug`. */
const ID_ATTRIBUTE = /(?:^|[-_:])(?:id|sku|key|slug)$/iu;
/** The page's note on a path column's label, from `value-shape.ts`. */
const CURRENCY_NOTE = /\(currency amount\)$/u;
const NUMBER_NOTE = /\(number\)$/u;
/** A label that is a path through the item, which the page measured a text column's shape for: steps joined by `>`, or a step with classes or a position. */
const PATH_LABEL = /^[\w-]+(?:[.:][\w()-]+)*(?:\s*>\s*[\w-]+(?:[.:][\w()-]+)*)*(?:\s*\([^()]*\))?$/u;
const PATH_MARKER = /[>.:]/u;
/** The shapes `value-shape.ts` reads, for a sample the page did not measure. */
const NUMBER = String.raw`(?:\d{1,3}(?:[,. ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)`;
const CURRENCY_AMOUNT = new RegExp(String.raw`^[-+]?(?:\p{Sc} ?[-+]?${NUMBER}|${NUMBER} ?\p{Sc})$`, "u");
const PLAIN_NUMBER = new RegExp(String.raw`^[-+]?${NUMBER}$`, "u");
/** A whole number with one or two words after it: "12 reviews", "1 mutual friend". */
const COUNT = /^\d{1,3}(?:,\d{3})*\+?\s+\p{L}+(?:\s+\p{L}+)?$/u;
/** A time of day written with a date. */
const TIME = /\b\d{1,2}:\d{2}\b|\b\d{1,2}\s*[ap]\.?m\b/iu;
/** The most words a sample may have for its date to be what the column holds rather than a date mentioned in prose. */
const DATE_WORDS = 6;
/** Two moments far apart: a date read the same against both does not depend on when it is read. */
const EARLY = Date.UTC(2020, 0, 15);
const LATE = Date.UTC(2031, 6, 15);

/** The column's type and its sample as that type, either absent where it cannot be said (header). `label` is the page's own label, note included. */
export function webLlmColumnType(label: string, spec: WebAutomationExtractionProposalFieldSpec, sample: string | undefined): { type?: WebLlmColumnType; parsed?: number | string } {
  if (spec.mark !== undefined) return { type: "flag" };
  const attribute = spec.kind === "attribute" ? spec.attribute?.toLowerCase() : undefined;
  if (spec.kind === "link" || (attribute !== undefined && ADDRESS_ATTRIBUTES.has(attribute))) return { type: "url" };
  if (attribute !== undefined && ID_ATTRIBUTE.test(attribute)) return { type: "id" };
  if (sample === undefined) return {};
  if (CURRENCY_NOTE.test(label)) return numbered("currency", sample);
  if (NUMBER_NOTE.test(label)) return numbered("number", sample);
  const measured = spec.kind === "text" && PATH_LABEL.test(label) && PATH_MARKER.test(label);
  if (!measured && CURRENCY_AMOUNT.test(sample)) return numbered("currency", sample);
  if (!measured && PLAIN_NUMBER.test(sample)) return numbered("number", sample);
  const date = dated(sample);
  if (date !== undefined) return date;
  if (!measured && COUNT.test(sample)) return numbered("count", sample);
  return { type: "text" };
}

function numbered(type: "currency" | "number" | "count", sample: string): { type: WebLlmColumnType; parsed?: number } {
  const parsed = readAutomationStudioRecordNumber(sample);
  return parsed === undefined ? { type } : { type, parsed };
}

/** A sample that is a date, with the day or instant it states when that does not depend on when it is read. */
function dated(sample: string): { type: WebLlmColumnType; parsed?: string } | undefined {
  if (sample.split(/\s+/u).length > DATE_WORDS) return undefined;
  const early = readAutomationStudioRecordDate(sample, EARLY);
  if (early === undefined) return undefined;
  const type = TIME.test(sample) ? "datetime" : "date";
  if (early !== readAutomationStudioRecordDate(sample, LATE)) return { type };
  const instant = new Date(early).toISOString();
  return { type, parsed: type === "date" ? instant.slice(0, 10) : instant };
}
