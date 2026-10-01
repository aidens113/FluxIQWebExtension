// Which detected column a name written slightly wrong means, and what the
// resolution assumed to get there.
//
// ## Why a near miss must not refuse here of all places
//
// The standing rule is that an unknown name a model writes -- a node, a
// parameter, a column -- resolves to its closest match using every available
// signal, and is never refused for having been spelled differently. A refusal
// spends a paid provider call telling the model something the evidence says it
// does not act on: run `run-mug776kx-0214b287` was refused the same way
// fourteen times and never corrected itself.
//
// `actions/extraction/field-match.ts` put that rule on the **literal** request
// path on 2026-09-26 and could not put it here, so `./columns.ts` still refused
// `web.handle.unknown_field` on the *detected* path -- which is the path the
// extraction node's own authoring text steers a model towards, and therefore
// the one where the rule pays most. This module is that half.
//
// ## Resolution is Core's, at Core's floor
//
// `automationStudioMatchName` (`fluxiq/automation-studio/nodes`): the id
// verbatim, then equal after folding case, separators and camel-case humps,
// then the nearest name above Core's measured score floor of 0.25. Not a second
// implementation and not a second floor, so a column name and a node id are
// corrected by the same judgement.
//
// A detected key is matched, and so is a table column's **header**, because the
// model is shown both and may write either (`./columns.ts` reads `column:Header`
// and a bare header). Both are aliases of the one column, and a guess that lands
// on either resolves to it.
//
// ## The shape signal, and what a detection honestly knows
//
// The rule says name *and* shape: where two columns are similarly named, the one
// whose values could answer the comparison is the match. On this path the shape
// is **not** read off sample values -- a detection carries none, by design. D3
// keeps every value the page states out of the proposal, the packet and the
// binding, and `extraction/structure-detection.ts` rebuilds a detection field by
// field so a producer that sent one sends nothing. So the shape has to be
// derived from what the column's own spec says it reads:
//
// - a **`link`**, and an `attribute` naming `href`, `src`, `action` or `poster`,
//   read an address. An address is text and never a quantity, so a comparison on
//   the number in a value was not written for one of these -- the same statement
//   `field-match.ts` makes on the literal path, over the same four attributes;
// - an `attribute` the HTML or ARIA specification **defines as a number** --
//   `aria-valuenow` and its neighbours, `colspan`, `size`, `width` -- holds a
//   number whatever page it is on. A star rating drawn as a slider or a `meter`
//   is exactly this: the quantity is in `aria-valuenow` and the text beside it
//   is prose;
// - everything else -- `text`, `value`, `column`, any other attribute -- says
//   nothing either way, and nothing is claimed for it.
//
// Both directions of that statement are used, and both come from Core:
// a candidate whose known shape **is** what the comparison needs wins a tie
// through Core's own `valueShape` tie-break, and a candidate whose known shape
// **contradicts** it stands aside for the guess. Standing aside is not
// excluding: with nothing else left, the contradicting column is still the
// answer, because a guess beats a refusal.
//
// ## A name that means a kind of column, where no name answers
//
// A detection over a page styled with hashed class names labels its columns by
// path -- `div > a.css-0y6s4m2 > span`, `p.css-10muxo3 > span (currency
// amount)` -- and no name a model writes from the instruction ("item",
// "quantity", "price") comes near one, so the everything store's cart read was
// refused `column_not_in_detected_list` (lane A, cause #15, `t174-w34` F2). What
// the detection does say is the shape: the page side completes a path label with
// `(number)` or `(currency amount)` when every value it read has one
// (`content/extraction/infer-fields.ts`), and the key is that label's
// (`extraction/label-key.ts`). An item's own name is the text of its link.
//
// So when nothing clears Core's floor, a name that plainly means a quantity, a
// price or the item's name resolves to the one column of that kind, and to none
// when there are several or none. It is recorded as a guess (`nearest`, score 0:
// no name similarity), never as a name match, and only where the caller allows a
// guess.

import { automationStudioMatchName, type AutomationStudioNameMatch, type AutomationStudioNameValueShape } from "fluxiq/automation-studio/nodes";
import {
  WEB_AUTOMATION_EXTRACT_CONDITION_BOUNDS,
  type WebAutomationExtractConditionSaying,
  type WebAutomationExtractField
} from "../../../../actions/extraction";
import type { WebPlanValuePath } from "../handle-tokens";

/**
 * A name that found its column by something other than the key verbatim: what
 * was written, what it was read as, how, and with what score.
 *
 * It is the resolver's half of
 * `WebAutomationExtractListFieldAssumption` (`actions/extraction/read-request.ts`),
 * in the same form, so the two paths' assumptions read as one thing. `index` is
 * a `where` position there; here a name can be written in several places, so the
 * position is the resolver's own value path.
 *
 * `normalized` is the same name in another casing or with other separators,
 * which is a spelling variant; `nearest` is a scored guess and is the one worth
 * a person's attention. `score` is name similarity in 0..1 before any shape
 * tie-break, exactly as Core's matcher reports it. `among` says which
 * vocabulary answered: the columns the detection showed, or the ones this plan
 * keeps under its own keys.
 */
export type WebExtractionColumnAssumption = {
  path: WebPlanValuePath;
  written: string;
  field: string;
  how: "normalized" | "nearest";
  score: number;
  among: "detected" | "kept";
};

/** The column a written name resolved to, and how much of that was a guess. */
export type WebExtractionColumnMatch = {
  key: string;
  how: "exact" | "normalized" | "nearest";
  score: number;
};

/**
 * The detected column `written` names, matched against every detected key and
 * every table header, or `undefined` when nothing plausible answers to it.
 *
 * `headerOnly` is for a name written as `column:<header>`, which says the name is
 * a header rather than a key, so only headers are candidates. `wanted` is the
 * shape the comparison this name was written for needs, where the caller knows
 * it; it settles a tie and never outvotes a clearly better name.
 */
export function webExtractionMatchedColumn(
  written: string,
  detected: Record<string, WebAutomationExtractField>,
  look: { headerOnly: boolean; wanted: AutomationStudioNameValueShape | undefined }
): WebExtractionColumnMatch | undefined {
  const aliases = columnAliases(detected, look.headerOnly);
  if (aliases.length === 0) return undefined;
  const wanted = look.wanted;
  const options = wanted === undefined ? undefined : { valueShape: wanted };
  const named = automationStudioMatchName(written, aliases, options);
  if (named === undefined) return look.headerOnly ? undefined : columnByMeaning(written, detected);
  // Only a guess stands a column aside. An exact or normalized hit is the name,
  // and Core's own `preferShape` already prefers the right shape among several.
  if (named.how !== "nearest" || wanted === undefined) return matchedAlias(named, aliases);
  const apart = aliases.filter((alias) => alias.accepts === undefined || alias.accepts === wanted);
  if (apart.length === 0 || apart.length === aliases.length) return matchedAlias(named, aliases);
  const best = automationStudioMatchName(written, apart, options);
  return best === undefined ? matchedAlias(named, aliases) : matchedAlias(best, apart);
}

/**
 * The shape a condition's comparison needs, where saying it needs one is honest.
 *
 * A bound or a numeric `equals` reads the **number** in the value, and a column
 * that holds an address has none. Every text comparison runs on every kind of
 * column, so it distinguishes nothing and claims nothing: `undefined` is the
 * answer, not `"text"`.
 */
export function webExtractionComparedShape(says: WebAutomationExtractConditionSaying | undefined): AutomationStudioNameValueShape | undefined {
  if (says === undefined) return undefined;
  if (WEB_AUTOMATION_EXTRACT_CONDITION_BOUNDS.some((key) => says[key] !== undefined)) return "number";
  const equals = says.equals;
  if (typeof equals === "number") return "number";
  return Array.isArray(equals) && equals.some((entry) => typeof entry === "number") ? "number" : undefined;
}

/** One name a column answers to: its detected key, or its table header. `accepts` is the shape the column is known to hold, where it is known. */
type ColumnAlias = { id: string; accepts: AutomationStudioNameValueShape | undefined; key: string };

/** Every name the detected columns answer to. A name written as a header matches headers only. */
function columnAliases(detected: Record<string, WebAutomationExtractField>, headerOnly: boolean): ColumnAlias[] {
  const aliases: ColumnAlias[] = [];
  for (const [key, field] of Object.entries(detected)) {
    const accepts = columnShape(field);
    if (!headerOnly) aliases.push({ id: key, accepts, key });
    const header = typeof field === "string" || field.kind !== "column" ? undefined : field.header;
    if (header !== undefined && header.trim() !== "") aliases.push({ id: header, accepts, key });
  }
  return aliases;
}

/**
 * The column an alias Core picked belongs to.
 *
 * Two columns can answer to one name -- the same table header twice -- and Core
 * keeps the first candidate on a tie, so the first is the answer here too. That
 * is a guess recorded as one, which is what the rule asks for; `./columns.ts`
 * still refuses `web.handle.ambiguous` where a name matches two columns
 * *exactly*, because that is two answers rather than a spelling.
 */
function matchedAlias(named: AutomationStudioNameMatch, aliases: readonly ColumnAlias[]): WebExtractionColumnMatch {
  return { key: aliases.find((alias) => alias.id === named.id)!.key, how: named.how, score: named.score };
}

/** A detected key whose label the page side completed with a shape (`infer-fields.ts`), less any `_2` a repeated label was given. */
const NUMBER_KEY = /(?:^|_)number(?:_\d+)?$/u;
const CURRENCY_KEY = /(?:^|_)currency_amount(?:_\d+)?$/u;

/** A selector whose path steps through a link element: the text a list item's link shows is the item's own name. */
const THROUGH_LINK = /(?:^|[\s>+~])a(?=[.#\[:\s>+~]|$)/u;

/** What a column must be for each meaning a written name can carry. */
type Meaning = { words: ReadonlySet<string>; holds: (key: string, field: WebAutomationExtractField) => boolean };

const MEANINGS: readonly Meaning[] = [
  {
    words: new Set(["quantity", "qty", "count", "units", "how many", "number of items"]),
    holds: (key) => NUMBER_KEY.test(key)
  },
  {
    words: new Set(["price", "cost", "unit price", "price each", "total", "line total", "subtotal", "amount"]),
    holds: (key) => CURRENCY_KEY.test(key)
  },
  {
    words: new Set(["item", "name", "title", "product", "item name", "product name", "item title", "product title"]),
    holds: (_key, field) => typeof field !== "string" && field.kind === "text" && field.selector !== undefined && THROUGH_LINK.test(field.selector)
  }
];

/**
 * The one detected column a written name means by kind (see the file comment),
 * or `undefined` when the name carries no such meaning or no single column has
 * that kind.
 */
function columnByMeaning(written: string, detected: Record<string, WebAutomationExtractField>): WebExtractionColumnMatch | undefined {
  const folded = written.trim().toLowerCase().replace(/[\s_-]+/gu, " ");
  const meaning = MEANINGS.find((candidate) => candidate.words.has(folded));
  if (meaning === undefined) return undefined;
  const keys = Object.entries(detected).filter(([key, field]) => meaning.holds(key, field)).map(([key]) => key);
  return keys.length === 1 ? { key: keys[0]!, how: "nearest", score: 0 } : undefined;
}

/** The attributes a page writes an address into, as `actions/extraction/field-match.ts` names them, which is what makes a value a URL rather than a quantity. */
const ADDRESS_ATTRIBUTES: ReadonlySet<string> = new Set(["href", "src", "action", "poster"]);

/**
 * The attributes HTML and ARIA define as numbers, so a column reading one holds
 * a number on every page rather than on this one. The ARIA value and position
 * attributes come first because they are the ones a quantity a person filters on
 * is actually written in -- a rating slider's `aria-valuenow`, a heading's
 * `aria-level` -- and the HTML ones after, which are counts and lengths.
 */
const NUMERIC_ATTRIBUTES: ReadonlySet<string> = new Set([
  "aria-valuenow",
  "aria-valuemin",
  "aria-valuemax",
  "aria-level",
  "aria-posinset",
  "aria-setsize",
  "aria-rowcount",
  "aria-colcount",
  "aria-rowindex",
  "aria-colindex",
  "aria-rowspan",
  "aria-colspan",
  "colspan",
  "rowspan",
  "span",
  "size",
  "rows",
  "cols",
  "start",
  "width",
  "height",
  "maxlength",
  "minlength",
  "tabindex"
]);

/**
 * What a detected column is known to hold, from its spec alone.
 *
 * A detection carries no sample value (D3), so this is everything that can be
 * said honestly. A string-grammar field says nothing either: the page owns that
 * grammar (`content/extraction/field-spec.ts`) and a second parser of it here
 * would disagree with the first about which selectors carry an attribute. A
 * binding's fields are always specs (`structure/packet.ts` builds them), so that
 * branch is the type's breadth rather than a case that occurs.
 */
function columnShape(field: WebAutomationExtractField): AutomationStudioNameValueShape | undefined {
  if (typeof field === "string") return undefined;
  if (field.kind === "link") return "text";
  if (field.kind !== "attribute" || field.attribute === undefined) return undefined;
  const attribute = field.attribute.toLowerCase();
  if (ADDRESS_ATTRIBUTES.has(attribute)) return "text";
  return NUMERIC_ATTRIBUTES.has(attribute) ? "number" : undefined;
}
