// A label/value list read as one record: a `<dl>` whose children are `dt`/`dd`
// pairs, proposed as a run of one item whose fields are its pairs.
//
// Every other rule in this directory finds records by repetition -- three
// siblings of one template, or a pair of plainly-records (`record-pair.ts`) --
// and a receipt does not repeat. The job board's applicant-tracking
// confirmation is `<dl class="tl-receipt">` holding Role, Company, Reference
// and Submitted, each a `dt` and the `dd` after it. Grouped by template, its
// children are a run of three bare `dd`s (the Reference `dd` carries a test id,
// so it is not even one of them) and a run of four `dt`s, and either way a
// record was one field long; the answer the task asks for is one record with
// `role`, `company` and `reference` (apply audit C3,
// `docs/working/language-driven-flow-loop-plan/reports/t195-w19d-audit-apply-quillmark.md`).
//
// The shape, which is structure alone:
// - the list's element children are pairs, each one `dt` followed by one or
//   more `dd`, either bare or each pair wrapped in a `div` (the two forms HTML
//   allows; a list mixing them, or holding anything else, is not one);
// - at least two pairs, since one label and one value is a caption, not a
//   record.
//
// Each pair is one `text` field read from its first `dd`, by position --
// `:scope > dd:nth-of-type(k)` or `:scope > div:nth-of-type(k) > dd` -- and
// labelled by its `dt`'s words. A `dt` is the page's own name for the value
// beside it, as a table's header cell is for the column below it, so it is
// page structure rather than a value read from the record (decisions D3 and
// D16, `infer-fields.ts`). A `dd` that is, or sits inside, a sensitive control
// is proposed excluded (D12).
//
// Pure: it reads the list's own markup and nothing else. Naming the list on
// the page -- a selector matching it and nothing else -- is the caller's
// (`infer-list.ts`), which is what keeps the document out of this module.

import {
  webAutomationExtractionFieldKey,
  type WebAutomationExtractionProposal,
  type WebAutomationExtractionProposalField
} from "@fluxiq-web-extension/domain/client";
import { isWithinSensitiveControl, textOutsideSensitiveControls } from "../../sensitive-text";
import { proposedFieldSpec } from "../infer-fields";
import type { ItemSelectorCandidate } from "../item-selector";

/** Fewer pairs than this are a caption, not a record. */
const MIN_PAIRS = 2;

/** One pair: the `dt` that names it, the `dd` its value is read from, and where that `dd` sits in the list. */
type Pair = { term: Element; value: Element; selector: string };

/**
 * The record `list` is, read as a run of one, or `undefined` when it is not a
 * list of label/value pairs or `name` cannot name it on the page. `name`
 * answers the list's container's selector and a selector matching exactly the
 * list; the proposal's confidence is that selector's, every field covering
 * the one item.
 */
export function keyValueRecord(
  list: Element,
  name: (list: Element) => { container: string; item: ItemSelectorCandidate } | undefined
): WebAutomationExtractionProposal | undefined {
  if (list.tagName.toUpperCase() !== "DL") return undefined;
  const pairs = wrappedPairs(list) ?? barePairs(list);
  if (!pairs || pairs.length < MIN_PAIRS) return undefined;
  const naming = name(list);
  if (!naming) return undefined;
  const taken = new Set<string>();
  const fields = pairs.map(({ term, value, selector }): WebAutomationExtractionProposalField => {
    const label = collapsed(textOutsideSensitiveControls(term)) || selector;
    const key = webAutomationExtractionFieldKey(label, taken);
    taken.add(key);
    const spec = proposedFieldSpec({ kind: "text", label, selector, sensitive: isWithinSensitiveControl(value) }, 1);
    return { key, label, spec, coverage: 1 };
  });
  return { container: naming.container, item: naming.item.selector, itemCount: 1, fields, confidence: Math.round(naming.item.confidence * 100) / 100 };
}

/** The pairs of a list whose children are all bare `dt`s and `dd`s, starting with a `dt`, or `undefined` when it is not one. */
function barePairs(list: Element): Pair[] | undefined {
  const pairs: Pair[] = [];
  let term: Element | undefined;
  let valueAfterTerm = false;
  let valueIndex = 0;
  for (const child of list.children) {
    const tag = child.tagName.toUpperCase();
    if (tag === "DT") {
      // A `dt` with no `dd` after it names nothing.
      if (term !== undefined && !valueAfterTerm) return undefined;
      term = child;
      valueAfterTerm = false;
    } else if (tag === "DD") {
      valueIndex += 1;
      if (term === undefined) return undefined;
      if (!valueAfterTerm) pairs.push({ term, value: child, selector: `:scope > dd:nth-of-type(${valueIndex})` });
      valueAfterTerm = true;
    } else {
      return undefined;
    }
  }
  return term !== undefined && valueAfterTerm ? pairs : undefined;
}

/** The pairs of a list whose children are all `div`s, each one `dt` then one or more `dd`s, or `undefined` when it is not one. */
function wrappedPairs(list: Element): Pair[] | undefined {
  const groups = Array.from(list.children);
  if (groups.length === 0 || !groups.every((group) => group.tagName.toUpperCase() === "DIV")) return undefined;
  const pairs: Pair[] = [];
  for (const [index, group] of groups.entries()) {
    const [term, value, ...more] = Array.from(group.children);
    if (term?.tagName.toUpperCase() !== "DT" || value?.tagName.toUpperCase() !== "DD") return undefined;
    if (!more.every((extra) => extra.tagName.toUpperCase() === "DD")) return undefined;
    pairs.push({ term, value, selector: `:scope > div:nth-of-type(${index + 1}) > dd` });
  }
  return pairs;
}

function collapsed(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}
