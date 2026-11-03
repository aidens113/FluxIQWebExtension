import type { AutomationStudioResolvedControlIntent } from "fluxiq/automation";
import type { JsonObject } from "fluxiq/core";
import { outputTargetFromPayload } from "../../../../output-nodes";
import { isJsonRecord } from "../../untrusted-json";
import type { WebPlanElementIdentity } from "../element-identity";
import { webPlanSameTargetIdentity } from "../same-target-identity";
import { sameWebPlanControlIntent } from "./same";

type Captured = {
  selector: string;
  frameId: number | undefined;
  frameUrlPath: string | undefined;
  element: WebPlanElementIdentity;
  shared: boolean;
  controlIntent: AutomationStudioResolvedControlIntent | undefined;
  intentConflict: boolean;
  intentSource: { location: string; key: string };
};

/** A host absolute target receives only an exact retained control's annotation; an actual pre-act source can distinguish identical later views. */
export function webPlanAbsoluteControlIntent(parameters: JsonObject, targets: Iterable<Captured>, location: string | undefined, acted: Iterable<Captured> = []):
  | { status: "absent" }
  | { status: "ambiguous" }
  | { status: "found"; controlIntent: AutomationStudioResolvedControlIntent } {
  let source = parameters;
  if (isJsonRecord(parameters.target) && Object.hasOwn(parameters.target, "$state")) {
    const state = parameters.target.$state;
    if (Object.keys(parameters.target).length !== 1 || !isJsonRecord(state)
      || Object.keys(state).some((key) => key !== "path" && key !== "fallback")
      || typeof state.path !== "string" || state.path.trim() === "" || !isJsonRecord(state.fallback)) return { status: "absent" };
    const fallback = outputTargetFromPayload({ target: state.fallback as JsonObject });
    if (typeof fallback?.selector !== "string" || !isJsonRecord(fallback.element)) return { status: "absent" };
    if (Object.hasOwn(parameters, "selector") && parameters.selector !== fallback.selector) return { status: "ambiguous" };
    if (Object.hasOwn(parameters, "element")) {
      const declared = outputTargetFromPayload({ selector: fallback.selector, element: parameters.element! });
      if (!webPlanSameTargetIdentity(declared?.element, fallback.element)) return { status: "ambiguous" };
    }
    source = { ...parameters, target: state.fallback as JsonObject };
  }
  const target = outputTargetFromPayload(source);
  if (typeof target?.selector !== "string" || !isJsonRecord(target.element)) return { status: "absent" };
  const frameId = parameters.browserFrameId ?? 0;
  if (typeof frameId !== "number" || !Number.isSafeInteger(frameId) || frameId < 0) return { status: "absent" };
  // Annotation-shaped saved/model fields are never compared as identity or read as authority.
  const { controlIntent: _intent, intent: _tag, responseOnly: _response, readsWords: _read, ...identity } = target.element;
  const names = (captured: Captured): boolean => captured.selector === target.selector && (captured.frameId ?? 0) === frameId
    && (location === undefined || captured.intentSource.location === location)
    && (parameters.browserFrameUrlPath === undefined || parameters.browserFrameUrlPath === captured.frameUrlPath)
    && webPlanSameTargetIdentity(identity, captured.element as unknown as JsonObject);
  const matches = new Map<string, Captured>();
  for (const captured of targets) {
    if (!names(captured)) continue;
    if (captured.shared || captured.intentConflict) return { status: "ambiguous" };
    matches.set(captured.intentSource.key, captured);
  }
  if (matches.size > 1) {
    // A host draft keeps the exact parameters the actual act resolved. Later
    // pages can show that same header control without being the act's source.
    // Only the immutable pre-act records establish that lineage; observation,
    // model fields and a currently convenient page do not. A second acted
    // source or any retained semantic disagreement keeps the refusal closed.
    const witnesses = new Map<string, Captured>();
    for (const before of acted) {
      if (!names(before)) continue;
      if (before.shared || before.intentConflict) return { status: "ambiguous" };
      witnesses.set(before.intentSource.key, before);
    }
    const before = witnesses.size === 1 ? [...witnesses.values()][0] : undefined;
    if (before?.controlIntent === undefined || [...matches.values()].some((captured) => !sameWebPlanControlIntent(before.controlIntent, captured.controlIntent))) return { status: "ambiguous" };
    return { status: "found", controlIntent: { ...before.controlIntent } };
  }
  const only = [...matches.values()][0];
  return only?.controlIntent === undefined ? { status: "absent" } : { status: "found", controlIntent: { ...only.controlIntent } };
}
