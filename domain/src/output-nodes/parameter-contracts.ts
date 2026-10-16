import { webAutomationOutputNodeId } from "./definitions";
import { webAutomationExtractParameterContract } from "./extract";
import { webAutomationExtractListParameterContract } from "./extract-list";

/**
 * Each web output node's parameter contract, keyed by node id, for the host
 * that builds a node registry to bind with Core's
 * `AutomationStudioNodeRegistry.bindParameterContract`. The two extractions
 * have one: their requests are the structured values a generated plan gets
 * wrong in ways their declared type (an object) cannot show. The single-value
 * read's was added in t675, after a wrong `extract` was found only by a run.
 */
export const webAutomationOutputNodeParameterContracts: Readonly<Record<string, typeof webAutomationExtractListParameterContract>> = {
  [webAutomationOutputNodeId("web.dom.extract")]: webAutomationExtractParameterContract,
  [webAutomationOutputNodeId("web.dom.extract_list")]: webAutomationExtractListParameterContract
};
