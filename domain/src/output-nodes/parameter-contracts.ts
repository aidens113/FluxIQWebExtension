import { webAutomationOutputNodeId } from "./definitions";
import { webAutomationExtractListParameterContract } from "./extract-list";

/**
 * Each web output node's parameter contract, keyed by node id, for the host
 * that builds a node registry to bind with Core's
 * `AutomationStudioNodeRegistry.bindParameterContract`. Only the list
 * extraction has one: its request is the one structured value a generated plan
 * gets wrong in ways its declared type cannot show.
 */
export const webAutomationOutputNodeParameterContracts: Readonly<Record<string, typeof webAutomationExtractListParameterContract>> = {
  [webAutomationOutputNodeId("web.dom.extract_list")]: webAutomationExtractListParameterContract
};
