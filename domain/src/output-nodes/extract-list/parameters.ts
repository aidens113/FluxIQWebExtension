import type { AutomationNodeParameter } from "fluxiq/automation-studio/nodes";
import { WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS } from "../../actions/extraction";
import { WEB_AUTOMATION_EXTRACT_LIST_EXAMPLE, WEB_AUTOMATION_EXTRACT_LIST_GRAMMAR } from "./catalog-text";

/**
 * The list extraction node's own parameters, before `expectedState`.
 *
 * `extractList` is the request, shaped as `actions/extraction/schema.ts`
 * declares it. `timeoutMs` bounds the whole read (D14): the request carries no
 * timeout of its own, and a paginated read outlasts Core's 5,000 ms default, so
 * the node states one, which the dispatch scales by the pages the request may
 * read when the author left it (`./dispatch.ts`).
 *
 * `recordOutput` is declared as Core's `builtin.policy.action` declares it,
 * and is the one web parameter a state binding may not fill: a binding could
 * replace the schema, and with it the excluded fields, at run time. Left empty,
 * the node saves every field under a derived dataset
 * (`./derived-record-output.ts`), which is what a model-built Flow relies on.
 */
export function webAutomationExtractListParameters(): AutomationNodeParameter[] {
  return [
    {
      id: "extractList",
      label: "List",
      description: WEB_AUTOMATION_EXTRACT_LIST_GRAMMAR,
      valueType: "object",
      example: structuredClone(WEB_AUTOMATION_EXTRACT_LIST_EXAMPLE),
      ui: { control: "value" }
    },
    {
      id: "timeoutMs",
      label: "Timeout",
      description: "Milliseconds for the whole read. Left at the default, it grows with the pages the list may read.",
      valueType: "number",
      defaultValue: WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS
    },
    {
      id: "recordOutput",
      label: "Save extracted records",
      description: "The dataset the rows are saved into. Leave empty to save every field of the list under a dataset named after its fields.",
      valueType: "json",
      defaultValue: null,
      allowStateBinding: false,
      ui: { control: "record-output" }
    }
  ];
}
