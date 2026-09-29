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

import type { JsonObject } from "fluxiq/core";
import {
  WEB_AUTOMATION_EXTRACT_CONDITION_PRESENCE,
  WEB_AUTOMATION_EXTRACT_FIELD_HANDLINGS,
  WEB_AUTOMATION_EXTRACT_FIELD_KINDS,
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
      // carry no declared type. An editor writing a lone value rather than a
      // list is read, as every other forgiving spelling is.
      where: {
        type: "array",
        label: "Only items where",
        description: "Each condition names a value by `field` (a key of `fields`) or `read` (a field of its own), and compares it: `is: \"present\" | \"absent\"`, a bound or `equals` on the number in it, `matches` / `contains` / `startsWith` / `endsWith` on its text, and `not` to keep what the rest rejects. Every condition must hold or the item is not read.",
        items: {
          type: "object",
          label: "Condition",
          properties: {
            field: { type: "string", label: "Field key" },
            is: { type: "string", label: "Value", enum: [...WEB_AUTOMATION_EXTRACT_CONDITION_PRESENCE] },
            atLeast: { type: "number", label: "At least" },
            atMost: { type: "number", label: "At most" },
            lessThan: { type: "number", label: "Less than" },
            greaterThan: { type: "number", label: "Greater than" },
            equals: { type: "array", label: "Equals any of" },
            matches: { type: "array", label: "Matches any of", items: { type: "string" } },
            contains: { type: "array", label: "Contains any of", items: { type: "string" } },
            startsWith: { type: "array", label: "Starts with any of", items: { type: "string" } },
            endsWith: { type: "array", label: "Ends with any of", items: { type: "string" } },
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
        description: "`by`: the field keys whose values together identify a row. The first occurrence in page order is kept, across every page read.",
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
      minItems: { type: "integer", label: "Minimum items", minimum: 0, maximum: WEB_AUTOMATION_EXTRACT_MAX_ITEMS }
    }
  };
}
