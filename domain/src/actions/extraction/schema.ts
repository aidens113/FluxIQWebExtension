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
// dialect admits, for an editor to read.

import type { JsonObject } from "fluxiq/core";
import {
  WEB_AUTOMATION_EXTRACT_FIELD_HANDLINGS,
  WEB_AUTOMATION_EXTRACT_FIELD_KINDS,
  WEB_AUTOMATION_EXTRACT_MAX_ITEMS,
  WEB_AUTOMATION_EXTRACT_MAX_PAGES,
  WEB_AUTOMATION_EXTRACT_PAGINATION_MODES
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
      maxItems: { type: "integer", label: "Maximum items", minimum: 1, maximum: WEB_AUTOMATION_EXTRACT_MAX_ITEMS },
      // Default 1 where absent, so an empty list fails unless the Flow says empty
      // is an answer; above the item bound no page could satisfy it.
      minItems: { type: "integer", label: "Minimum items", minimum: 0, maximum: WEB_AUTOMATION_EXTRACT_MAX_ITEMS }
    }
  };
}
