// The parameter schema of `web.dom.next_page`'s `nextPage`, named and shaped as
// `WebAutomationNextPageRequest` (`./request.ts`).
//
// Built from the caller's element fingerprint schema rather than importing it,
// for the reason `../extraction/schema.ts` gives: that schema belongs to
// `actions/schemas.ts`, which imports this directory. No member of the way is
// required of every mode, so nothing is required there; the reader refuses a
// mode missing its own control or carrying another's (`./request-value.ts`).
// There is no bound to declare: one step moves one page.

import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_NEXT_PAGE_WORDS } from "./words";

export function webAutomationNextPageSchema(elementFingerprintSchema: JsonObject): JsonObject {
  return {
    type: "object",
    label: "Next page",
    required: ["item"],
    properties: {
      item: { type: "string", label: "Item selector" },
      itemElement: elementFingerprintSchema,
      pagination: {
        type: "object",
        label: "Way to the next page",
        properties: {
          mode: { type: "string", label: "Mode", enum: [...WEB_AUTOMATION_NEXT_PAGE_WORDS.modes] },
          next: { type: "string", label: "Next control" },
          control: { type: "string", label: "Load-more control" },
          pages: { type: "string", label: "Page controls" }
        }
      }
    }
  };
}
