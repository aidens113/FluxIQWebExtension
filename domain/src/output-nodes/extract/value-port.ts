import type { AutomationNodePort } from "fluxiq/automation-studio/nodes";

/**
 * Where in `web.dom.extract`'s dispatched answer the value it read lies: the
 * client answers it on `extracted` (`apps/extension/src/content/actions/extract.ts`,
 * forwarded by `client/gateway-mapping.ts`), and the dispatch wraps the client's
 * answer under `result` (`io/gateway-output-dispatcher.ts`), so two segments, as
 * the list extraction's records path has (`../extract-list/records-path.ts`).
 *
 * A value read off a sensitive control never reaches that path: the page refuses
 * the read, and the gateway mapping and the runtime adapter drop `extracted`
 * beside a sensitive element, so the port is left empty rather than filled.
 */
export const WEB_AUTOMATION_EXTRACT_VALUE_PATH = "result.extracted";

/**
 * The output the single-value read hands its value on through (t646), so a
 * later step, or a part handing a value back, reads it as `$step.<label>.value`.
 *
 * Core copies the value at `resultPath` in the dispatched answer to
 * `outputs.value` after a successful dispatch (Core
 * `runtime/executor/node-execution/result-path-outputs.ts`), which is where the
 * run keeps it for `$node.<key>.value`. Before t646 the read declared only its
 * success and failure ports, so one value read off the page could not be handed
 * on at all: Core refused every binding to it (t594, t639).
 */
export const WEB_AUTOMATION_EXTRACT_VALUE_PORT: AutomationNodePort = {
  id: "value",
  label: "Value",
  valueType: "any",
  role: "data",
  resultPath: WEB_AUTOMATION_EXTRACT_VALUE_PATH
};
