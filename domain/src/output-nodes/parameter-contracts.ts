import type { AutomationStudioNodeParameterContract } from "fluxiq/automation-studio/nodes";
import { WEB_AUTOMATION_JAVASCRIPT_INPUT_MAX_BYTES, WEB_AUTOMATION_JAVASCRIPT_SOURCE_MAX_BYTES } from "../actions/types";
import { webAutomationOutputNodeId } from "./definitions";
import { webAutomationExtractListParameterContract } from "./extract-list";

/**
 * Each web output node's parameter contract, keyed by node id, for the host
 * that builds a node registry to bind with Core's
 * `AutomationStudioNodeRegistry.bindParameterContract`. These supplement the
 * declarative parameter types where generated values need tighter structural
 * or byte-bound validation before a plan can be accepted.
 */
export const webAutomationOutputNodeParameterContracts: Readonly<Record<string, AutomationStudioNodeParameterContract>> = {
  [webAutomationOutputNodeId("web.dom.extract_list")]: webAutomationExtractListParameterContract,
  [webAutomationOutputNodeId("web.dom.run_javascript")]: ({ parameterId, value }) => {
    if (parameterId === "source") return typeof value === "string" && value.trim().length > 0 && utf8Bytes(value) <= WEB_AUTOMATION_JAVASCRIPT_SOURCE_MAX_BYTES
      ? []
      : ["web.javascript.source_invalid"];
    if (parameterId === "inputs") {
      if (!isJsonObject(value)) return ["web.javascript.inputs_invalid"];
      return utf8Bytes(value) <= WEB_AUTOMATION_JAVASCRIPT_INPUT_MAX_BYTES ? [] : ["web.javascript.inputs_too_large"];
    }
    return [];
  }
};

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function utf8Bytes(value: unknown): number {
  try {
    return new TextEncoder().encode(typeof value === "string" ? value : JSON.stringify(value)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}
