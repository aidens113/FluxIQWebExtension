import { webNodeBuildOf, webNodeBuildSlot } from "../build-state";
import { webNodeDispatchParameters } from "../rejected-rows";
import { createWebNodeDispatchRecorder, webNodeFrozenLoweredParameters, webNodeFrozenRefreshedParameters } from "./dispatch";
import { webNodeFrozenJson } from "./json";
import { webNodeFrozenCommandScope, webNodeFrozenScope } from "./scope";
import { webNodeFrozenSubjectKind } from "./subject";
import type { WebNodeFrozenCapture, WebNodeFrozenCaptureHost, WebNodeFrozenCaptureInput, WebNodeFrozenScope } from "./types";

/** Provisional producer transaction, sealed by Core only after its outer wrappers settle. */
export async function createWebNodeFrozenCapture(host: WebNodeFrozenCaptureHost, input: WebNodeFrozenCaptureInput): Promise<WebNodeFrozenCapture | undefined> {
  const sink = host.core.capture();
  const referenceNow = input.run.request.referenceNow;
  if (sink.kind !== "capture" || input.adapterValue === undefined || typeof referenceNow !== "number" || !Number.isSafeInteger(referenceNow) || referenceNow < 0 || referenceNow > 8.64e15) return undefined;
  const observing = input.node.actionType === "web.dom.capture_snapshot";
  const kind = webNodeFrozenSubjectKind(input.node.actionType, observing ? {} : input.parameters);
  if (kind === undefined || !input.node.actionType.startsWith("web.dom.")) return undefined;
  let scope: WebNodeFrozenScope | undefined;
  if (!observing) {
    scope = await webNodeFrozenCommandScope({ sessionId: input.run.sessionId, parameters: input.parameters, before: input.before, look: input.look });
    if (scope === undefined) return undefined;
  }
  const adapterValue = webNodeFrozenJson(input.adapterValue);
  const written = webNodeFrozenJson(input.written);
  // These pins account for actual implicit scope, and only follow positive capture claims.
  const scoped = observing ? {} : { ...input.parameters, browserTabId: scope!.browserTabId, browserFrameId: scope!.browserFrameId };
  let logical = webNodeFrozenJson(webNodeFrozenLoweredParameters(input.node.actionType, scoped, referenceNow));
  let base = webNodeFrozenJson(webNodeDispatchParameters(input.node, logical));
  const subjectParameters = logical;
  const recorder = createWebNodeDispatchRecorder({ sessionId: input.run.sessionId, actionType: input.node.actionType, referenceNow, parameters: () => logical });
  let valid = true;
  let published = false;
  return {
    parameters: base,
    refreshed(parameters) {
      const refreshed = kind === "element" ? webNodeFrozenRefreshedParameters(input.node.actionType, logical, base, parameters) : undefined;
      if (refreshed === undefined) {
        valid = false;
        return;
      }
      logical = refreshed;
      base = webNodeFrozenJson(parameters);
    },
    dispatch: recorder.dispatch,
    publish(page) {
      if (published) return;
      published = true;
      const recorded = recorder.snapshot();
      const selected = recorded?.selected;
      if (observing) scope = webNodeFrozenScope(page, input.run.sessionId);
      if (!valid || recorded?.eligible !== true || scope === undefined || selected?.outcome !== "succeeded" || selected.command === undefined || selected.parameters === undefined || selected.receipt === undefined) return;
      const subject = host.subject(scope, kind, subjectParameters);
      const capsule = host.retain(Object.freeze({
        definitionId: input.node.definitionId, definitionVersion: input.node.definition.version,
        buildSlot: webNodeBuildSlot(webNodeBuildOf(input.run.request).build), startLocation: input.run.request.startLocation,
        referenceNow, value: webNodeFrozenJson(input.value), adapterValue, written, parameters: selected.parameters,
        command: selected.command, scope, subject, subjectKind: kind
      }));
      sink.publish({
        owner: host.owner, generation: host.generation, adapterValue,
        definitionId: input.node.definitionId, definitionVersion: input.node.definition.version,
        // This direct node-run path has parameters, not executable node-port/row inputs.
        parameters: selected.parameters, effectiveInputs: {}, referenceNow, subject, capsule,
        dispatch: recorded.dispatch
      });
    }
  };
}
