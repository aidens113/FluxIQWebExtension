import type { AutomationStudioResolvedControlIntent } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { outputTargetFromPayload } from "../../../../output-nodes";
import { isJsonRecord } from "../../untrusted-json";
import type { WebPlanElementIdentity } from "../element-identity";
import { webPlanSameTargetIdentity } from "../same-target-identity";

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

/** A host absolute target receives only the annotation of one exactly matching retained actual control. */
export function webPlanAbsoluteControlIntent(parameters: JsonObject, targets: Iterable<Captured>, location: string | undefined):
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
  const matches = new Map<string, Captured>();
  for (const captured of targets) {
    if (captured.selector !== target.selector || (captured.frameId ?? 0) !== frameId
      || (location !== undefined && captured.intentSource.location !== location)
      || (parameters.browserFrameUrlPath !== undefined && parameters.browserFrameUrlPath !== captured.frameUrlPath)
      || !webPlanSameTargetIdentity(identity, captured.element as unknown as JsonObject)) continue;
    if (captured.shared || captured.intentConflict) return { status: "ambiguous" };
    matches.set(captured.intentSource.key, captured);
  }
  if (matches.size > 1) return { status: "ambiguous" };
  const only = [...matches.values()][0];
  return only?.controlIntent === undefined ? { status: "absent" } : { status: "found", controlIntent: { ...only.controlIntent } };
}
