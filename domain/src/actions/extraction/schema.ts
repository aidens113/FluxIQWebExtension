// The parameter schema of `web.dom.extract_list`'s `extractList`, named and
// shaped as `WebAutomationExtractListRequest` (`./request.ts`).
//
// It is built from the element fingerprint schema rather than importing it:
// that schema belongs to `actions/schemas.ts`, which imports this module, so a
// value import back would be a runtime cycle. The caller passes its own, and
// `itemElement` and each field's `element` describe exactly what every other
// action's `element` does.
//
// Core's parameter-schema dialect has no `oneOf` (Core K1), so a field cannot
// be declared as "a string or a spec". `fields` stays `type: "object"`, the
// lift (`client/gateway-action-parameters.ts`) enforces the union, and the spec
// form is described under `metadata`, the one free-form keyword Core's schema
// dialect admits, for an editor to read. A `where` condition's `read` is the
// same union and is declared the same way.
//
// A `where` bound is a number or a date written as text (t790, run
// `run-mvswewhy-e4e469d4`), so each bound is declared with both types, which
// Core's schema fit reads as a list (`parameter-schema/fit.ts`), and `as` names
// the kind; the condition grammar refuses a date that names no one date.

import type { JsonObject } from "fluxiq/core";
import {
  WEB_AUTOMATION_EXTRACT_CONDITION_PRESENCE,
  WEB_AUTOMATION_EXTRACT_FIELD_HANDLINGS,
  WEB_AUTOMATION_EXTRACT_FIELD_KINDS,
  WEB_AUTOMATION_EXTRACT_FIELD_MARKS,
  WEB_AUTOMATION_EXTRACT_LIST_ANSWER_KEPT,
  WEB_AUTOMATION_EXTRACT_MAX_ITEMS,
  WEB_AUTOMATION_EXTRACT_MAX_PAGES,
  WEB_AUTOMATION_EXTRACT_PAGINATION_MODES,
  WEB_AUTOMATION_EXTRACT_SORT_ORDERS,
  WEB_AUTOMATION_EXTRACT_SORT_TYPES
} from "./request";

export function webAutomationExtractListSchema(elementFingerprintSchema: JsonObject): JsonObject {
  const pageBound = { type: "integer", minimum: 1, maximum: WEB_AUTOMATION_EXTRACT_MAX_PAGES };
  const fieldSpecSchema = {
    type: "object",
    label: "Field",
    required: ["kind"],
    properties: {
      kind: { type: "string", label: "Reads", enum: [...WEB_AUTOMATION_EXTRACT_FIELD_KINDS] },
      selector: { type: "string", label: "Selector inside the item" },
      attribute: { type: "string", label: "Attribute" },
      header: { type: "string", label: "Column header" },
      required: { type: "boolean", label: "Required" },
      // `encrypt` is reserved (D13) and refused at dispatch until it is built.
      handling: { type: "string", label: "Column", enum: [...WEB_AUTOMATION_EXTRACT_FIELD_HANDLINGS] },
      // A `text` field only: each child line read on its own and joined (`./request.ts`).
      lines: { type: "boolean", label: "Every line" },
      identity: { type: "string", label: "Link identity", enum: ["tracking-free"] },
      // A field that reads a mark: a value only where the row carries it (`./request.ts`).
      mark: { type: "string", label: "Mark", enum: [...WEB_AUTOMATION_EXTRACT_FIELD_MARKS] },
      element: elementFingerprintSchema
    }
  } satisfies JsonObject;
  return {
    type: "object",
    label: "List extraction",
    required: ["item", "fields"],
    properties: {
      item: { type: "string", label: "Item selector" },
      itemElement: elementFingerprintSchema,
      fields: {
        type: "object",
        label: "Field map",
        description: "Each field key maps to a selector string (`selector`, `selector@attribute`, `column:<header>`) or a field spec.",
        metadata: { fieldSpec: fieldSpecSchema }
      },
      // No member is required of every mode, so nothing is required here: the
      // lift refuses a mode missing its own bound or naming another mode's key.
      paginate: {
        type: "object",
        label: "Pagination",
        properties: {
          mode: { type: "string", label: "Mode", enum: [...WEB_AUTOMATION_EXTRACT_PAGINATION_MODES] },
          next: { type: "string", label: "Next control" },
          control: { type: "string", label: "Load-more control" },
          pages: { type: "string", label: "Page controls" },
          maxPages: { ...pageBound, label: "Maximum pages" },
          maxScrolls: { ...pageBound, label: "Maximum scrolls" }
        }
      },
      // Which items are records (C5). A condition names its value by a field
      // key or by a field of its own, so `read` carries the same shape a
      // `fields` entry does, described under `metadata` for the same reason:
      // Core's dialect has no `oneOf`, and the lift enforces the union.
      //
      // The comparisons over text, and `equals`, take one value or a list of
      // them and are declared as the list, since that is the shape the reader
      // keeps (`./condition-grammar.ts`). `equals` compares a number against
      // the number in the value and a string against its text, so its items
      // carry no declared type. A lone value is as valid as a list of one, so
      // each is declared with both types; a number in a text comparison is read
      // as its digits (`./condition-grammar.ts`).
      where: {
        type: "array",
        label: "Only items where",
        description: "Each condition names a value by `field` (a key of `fields`) or `read` (a field of its own), and compares it: `is: \"present\" | \"absent\"`, a bound or `equals` on the number in it, a bound written as a date with its year and `as: \"date\"` on the date it states, `matches` / `contains` / `startsWith` / `endsWith` on its text, and `not` to keep what the rest rejects. Every condition must hold or the item is not read; an item whose value states no date a date bound can read is never kept.",
        items: {
          type: "object",
          label: "Condition",
          properties: {
            field: { type: "string", label: "Field key" },
            is: { type: "string", label: "Value", enum: [...WEB_AUTOMATION_EXTRACT_CONDITION_PRESENCE] },
            atLeast: { type: ["number", "string"], label: "At least" },
            atMost: { type: ["number", "string"], label: "At most" },
            lessThan: { type: ["number", "string"], label: "Less than" },
            greaterThan: { type: ["number", "string"], label: "Greater than" },
            within: { type: "string", label: "Within the last" },
            as: { type: "string", label: "Bounds compare", enum: ["number", "date"] },
            equals: { type: ["array", "string", "number"], label: "Equals any of" },
            matches: { type: ["array", "string"], label: "Matches any of", items: { type: "string" } },
            contains: { type: ["array", "string", "number"], label: "Contains any of", items: { type: ["string", "number"] } },
            startsWith: { type: ["array", "string", "number"], label: "Starts with any of", items: { type: ["string", "number"] } },
            endsWith: { type: ["array", "string", "number"], label: "Ends with any of", items: { type: ["string", "number"] } },
            not: { type: "boolean", label: "Keep the items this rejects" }
          },
          metadata: { read: fieldSpecSchema }
        }
      },
      // Which rows are one row, and the order they are answered in. Each is read
      // forgivingly (`./order-request.ts`), so neither is declared tighter than
      // its canonical shape: a lone column name, `true`, or `"posted desc"` are
      // all read, as every other forgiving spelling is.
      dedupe: {
        type: "object",
        label: "Keep each row once",
        description: "`by`: the field keys whose values together identify a row. The first occurrence is kept, over every row the read collects in the run.",
        properties: { by: { type: "array", label: "Same row when these match", items: { type: "string" } } }
      },
      sort: {
        type: "array",
        label: "Sort rows",
        description: "Keys in priority order, each `{field, order: asc|desc, as?: auto|number|date|text}`. A row whose value cannot be read as the key's type goes last.",
        items: {
          type: "object",
          label: "Sort key",
          required: ["field", "order"],
          properties: {
            field: { type: "string", label: "Field key" },
            order: { type: "string", label: "Order", enum: [...WEB_AUTOMATION_EXTRACT_SORT_ORDERS] },
            as: { type: "string", label: "Compare as", enum: [...WEB_AUTOMATION_EXTRACT_SORT_TYPES] }
          }
        }
      },
      maxItems: { type: "integer", label: "Maximum items", minimum: 1, maximum: WEB_AUTOMATION_EXTRACT_MAX_ITEMS },
      // Default 1 where absent, so an empty list fails unless the Flow says empty
      // is an answer; above the item bound no page could satisfy it.
      minItems: { type: "integer", label: "Minimum items", minimum: 0, maximum: WEB_AUTOMATION_EXTRACT_MAX_ITEMS },
      // Set by the domain on a Flow's dispatch and replay, never by an author
      // (`./request.ts`); declared so the dispatched request is one this schema
      // describes.
      answer: { type: "string", label: "Answer", enum: [WEB_AUTOMATION_EXTRACT_LIST_ANSWER_KEPT] },
      // Press each kept row's own "Read more" before reading its text, the
      // default; `false` stops it (`./request.ts`).
      discloseText: { type: "boolean", label: "Open each kept row's collapsed text" },
      // The run's instant for relative dates, set by the domain's dispatch,
      // never by an author (`./request.ts`).
      now: { type: "integer", label: "Relative dates judged at", minimum: 0 }
    }
  };
}
