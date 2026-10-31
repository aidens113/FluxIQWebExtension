import type { AutomationStudioUnboundTargetReacquireAnswer, AutomationStudioUnboundTargetReacquireRequest } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";
import { webAutomationOutputNodeDefinitions, webAutomationUrlPath } from "../../output-nodes";
import type { WebAutomationHostRuntimeGateway } from "../host-runtime";
import { webCapturedTargetObservation, webRefreshTargetIdentity, type createWebTargetPlaces, type WebTargetScope } from "./identity";

/** Refresh only the two trusted target slots, in the prior attempt's actual browser document. */
export async function webAutomationReacquireUnboundTarget(
  request: AutomationStudioUnboundTargetReacquireRequest,
  places: ReturnType<typeof createWebTargetPlaces>,
  dispatch: WebAutomationHostRuntimeGateway["dispatch"]
): Promise<AutomationStudioUnboundTargetReacquireAnswer> {
  if (request.signal?.aborted) return unavailable("observation_unavailable");
  const parameters = targetParameters(request);
  if (parameters === undefined) return unavailable("unsupported_target");
  const requested = targetScope(parameters);
  if (requested === undefined) return unavailable("unsupported_target");
  const previous = places.of(request.previousAttempt, requested);
  if (previous?.scope.sessionId === undefined || previous.scope.browserTabId === undefined || previous.scope.browserFrameId === undefined || previous.scope.location === undefined || previous.scope.timeOrigin === undefined || previous.scope.resetResource === undefined) return unavailable("place_unproved");
  // A merged top capture has no knowledge of a child's document. Only an actual
  // whole scoped capture made for this attempt can establish that prior place.
  if ((previous.scope.browserFrameId !== 0 || requested.browserFrameUrlPath !== undefined) && (previous.scope.kind !== "single-frame" || previous.coverage !== "complete" || !previous.includesHidden)) return unavailable("observation_incomplete");
  const pinned: WebTargetScope = { ...previous.scope, kind: "single-frame" };
  const payload: JsonObject = {
    includeHidden: true,
    browserTabId: pinned.browserTabId!,
    browserFrameId: pinned.browserFrameId!,
    ...(requested.browserFrameUrlPath === undefined ? {} : { browserFrameUrlPath: requested.browserFrameUrlPath })
  };
  try {
    if (request.signal?.aborted) return unavailable("observation_unavailable");
    const result = await dispatch({
      outputId: "web.dom.capture_snapshot", payload, timeoutMs: 5_000,
      ...(request.signal === undefined ? {} : { signal: request.signal }),
      metadata: { sessionId: pinned.sessionId!, source: "web-automation-target-identity", domainId: WEB_AUTOMATION_DOMAIN_ID, nodeId: request.node.id, attemptId: request.previousAttempt.attemptId }
    });
    if (request.signal?.aborted || !result.ok || (result.status !== undefined && result.status !== "succeeded")) return unavailable("observation_unavailable");
    const action = record(result.payload?.result);
    const snapshot = action?.snapshot;
    if (snapshot === undefined) return unavailable("observation_unavailable");
    const observed = webCapturedTargetObservation({ snapshot, sessionId: result.metadata?.sessionId, sourceId: action?.sourceId, requested: pinned, previous });
    if (observed.kind === "rejected") return unavailable("place_unproved");
    const refreshed = webRefreshTargetIdentity({ parameters, observation: observed.observation });
    if (request.signal?.aborted) return unavailable("observation_unavailable");
    if (refreshed.outcome !== "found") return refreshed;
    return {
      outcome: "found",
      patches: [
        { operation: "set", parameterId: "selector", value: refreshed.target.selector },
        { operation: "set", parameterId: "element", value: refreshed.target.element as unknown as JsonObject }
      ]
    };
  } catch {
    // A refused, interrupted or unreadable observation is never proof of absence.
    return unavailable("observation_unavailable");
  }
}

function targetParameters(request: AutomationStudioUnboundTargetReacquireRequest): JsonObject | undefined {
  const wrapper = request.node.definitionId === "builtin.policy.action";
  const definition = webAutomationOutputNodeDefinitions.find((candidate) => wrapper ? candidate.outputAction?.fixedOutputId === request.parameters.outputId : candidate.id === request.node.definitionId);
  if (definition === undefined || !["selector", "element"].every((id) => definition.parameters.some((parameter) => parameter.id === id && parameter.targetRefresh === true))) return undefined;
  if (request.refresh.container !== (wrapper ? "output" : "node") || request.refresh.definitionId !== definition.id || !request.refresh.parameterIds.includes("selector") || !request.refresh.parameterIds.includes("element")) return undefined;
  const parameters = wrapper ? record(request.parameters.parameters) : request.parameters;
  const element = record(parameters?.element);
  const context = record(element?.context);
  if (parameters === undefined || element === undefined || Object.keys(element).length === 0 || record(parameters.target) !== undefined || record(context?.record)?.values !== undefined) return undefined;
  return parameters as JsonObject;
}

function targetScope(parameters: JsonObject): WebTargetScope | undefined {
  const tab = parameters.browserTabId ?? parameters.tabId;
  const frame = parameters.browserFrameId ?? parameters.frameId;
  const rawPath = parameters.browserFrameUrlPath;
  const path = webAutomationUrlPath(rawPath);
  if ((tab !== undefined && (typeof tab !== "number" || !Number.isSafeInteger(tab) || tab < 0)) || (frame !== undefined && (typeof frame !== "number" || !Number.isSafeInteger(frame) || frame < 0)) || (rawPath !== undefined && path === undefined)) return undefined;
  return { kind: "single-frame", ...(tab === undefined ? {} : { browserTabId: tab }), ...(frame === undefined ? path === undefined ? { browserFrameId: 0 } : {} : { browserFrameId: frame }), ...(path === undefined ? {} : { browserFrameUrlPath: path }) };
}

function unavailable(reason: Extract<AutomationStudioUnboundTargetReacquireAnswer, { outcome: "unavailable" }>["reason"]): AutomationStudioUnboundTargetReacquireAnswer {
  return { outcome: "unavailable", reason };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
