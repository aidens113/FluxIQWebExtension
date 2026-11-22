import { parseAutomationStudioRecordSchema } from "fluxiq/components/automation";
import type { JsonObject } from "fluxiq/core";
import { webAutomationExtractListDispatch } from "../../../../output-nodes";
import type { WebLlmEvidenceToolExecution } from "../../capture";

/** Metadata from the actual validated dispatch, never a parsed column sample or a fabricated node output port. */
export function webListReadRecordSchema(nodeId: string, parameters: JsonObject, execution: WebLlmEvidenceToolExecution): WebLlmEvidenceToolExecution {
  if (nodeId !== "web.output.dom-extract_list" && nodeId !== "web.dom.extract_list") return execution;
  const dispatch = webAutomationExtractListDispatch(parameters);
  if (!dispatch.ok) return execution;
  const output = dispatch.payload.recordOutput;
  if (typeof output !== "object" || output === null || Array.isArray(output)) return execution;
  const parsed = parseAutomationStudioRecordSchema(output.schema);
  execution.recordSchema = parsed.ok ? parsed.schema : null;
  return execution;
}
