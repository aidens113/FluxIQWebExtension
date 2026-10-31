import type { JsonObject } from "fluxiq/core";
import { webAutomationOutputNodeDefinitions } from "../../output-nodes";
import { isJsonRecord } from "../llm-evidence";
import { webReacquireElement } from "../target-reacquire";
import { webTargetCandidates, type WebTargetObservation } from "../target-reacquire/identity";

/** Return captured subject identity, never an address or a model-provided identity alone. */
export function webRuntimeRepeatTarget(node: { definitionId: string; parameterValues?: JsonObject }, observation: WebTargetObservation): { kind: "none" } | { kind: "identified"; identity: string } | undefined {
  const wrapper = node.definitionId === "builtin.policy.action";
  const definition = webAutomationOutputNodeDefinitions.find((candidate) => wrapper ? candidate.outputAction?.fixedOutputId === node.parameterValues?.outputId : candidate.id === node.definitionId);
  const output = definition?.outputAction?.fixedOutputId;
  const parameters = wrapper ? node.parameterValues?.parameters : node.parameterValues;
  if (typeof output !== "string" || !isJsonRecord(parameters) || parameters.visualTarget !== undefined) return undefined;
  const scope = observation.scope;
  if ((parameters.browserTabId !== undefined && parameters.browserTabId !== scope.browserTabId)
    || (parameters.tabId !== undefined && parameters.tabId !== scope.browserTabId)
    || (parameters.browserFrameId !== undefined && parameters.browserFrameId !== 0)
    || (parameters.frameId !== undefined && parameters.frameId !== 0)
    || parameters.browserFrameUrlPath !== undefined) return undefined;
  // Reads of the whole shown page are explicitly targetless. Other operations
  // need their own observable-effect contract, rather than guessed coverage.
  if (output === "web.dom.capture_snapshot" && parameters.selector === undefined && parameters.element === undefined && parameters.target === undefined) return { kind: "none" };
  if (!["web.dom.click", "web.dom.type", "web.dom.clear", "web.dom.select", "web.dom.extract"].includes(output)
    || !isJsonRecord(parameters.element) || parameters.target !== undefined || typeof parameters.selector !== "string") return undefined;
  const candidates = webTargetCandidates(observation);
  const answer = webReacquireElement({ stale: parameters.element, candidates: candidates.map((candidate) => candidate.element as unknown as JsonObject) });
  if (answer.outcome !== "found") return undefined;
  const candidate = candidates.find((item) => item.element === answer.value);
  if (candidate === undefined || candidate.hidden || candidate.selector !== parameters.selector) return undefined;
  // The matcher enforces the shared signal floor and record/dialog/root gates.
  // Remove addressing and positional context before privately interning identity.
  const { selector: _selector, xpath: _xpath, context, ...identity } = candidate.element;
  const stable = { ...identity, ...(context === undefined ? {} : { context: { record: context.record, dialog: context.dialog, shadowHosts: context.shadowHosts, formId: context.formId, landmark: context.landmark } }) };
  const text = JSON.stringify(stable);
  return text.length > 65_536 ? undefined : { kind: "identified", identity: text };
}
