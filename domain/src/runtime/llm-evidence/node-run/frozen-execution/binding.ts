import { automationStudioLlmRerunCapture, automationStudioLlmRerunExecution } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { webNodeBuildOf, webNodeBuildSlot } from "../build-state";
import { webRunnableNode } from "../catalog";
import { createWebNodeFrozenCapture } from "./capture";
import { webNodeFrozenKey } from "./key";
import { webNodeFrozenJson } from "./json";
import { webNodeFrozenSubjectKey } from "./subject";
import { createWebNodeSelectedExecution } from "./selected";
import type { WebNodeFrozenCall, WebNodeFrozenCoreAccess, WebNodeFrozenExecution } from "./types";

/** One runtime binding owns its capsules and identities; neither is reconstructed from JSON. */
export function createWebNodeFrozenExecution(core: WebNodeFrozenCoreAccess = { capture: automationStudioLlmRerunCapture, execution: automationStudioLlmRerunExecution }): WebNodeFrozenExecution {
  const owner = Object.freeze({});
  const generation = Object.freeze({});
  const capsules = new WeakMap<object, WebNodeFrozenCall>();
  const subjects = new Map<string, object>();
  const host = {
    owner, generation, core,
    subject(scope: WebNodeFrozenCall["scope"], kind: WebNodeFrozenCall["subjectKind"], parameters: JsonObject): object {
      const semantic = webNodeFrozenSubjectKey(kind, parameters);
      const key = webNodeFrozenKey({ resource: scope.resetResource, document: scope.timeOrigin, location: scope.location, kind, semantic });
      let subject = subjects.get(key);
      if (subject === undefined) {
        subject = Object.freeze({});
        subjects.set(key, subject);
      }
      return subject;
    },
    retain(call: WebNodeFrozenCall): object {
      const capsule = Object.freeze({});
      capsules.set(capsule, call);
      return capsule;
    }
  };
  return {
    entry(value) {
      if (core.capture().kind !== "capture") return { kind: "unavailable", reason: "inactive" };
      try {
        return { kind: "captured", value: webNodeFrozenJson(value) };
      } catch {
        return { kind: "unavailable", reason: "adapter_value_unreadable" };
      }
    },
    select(run) {
      const access = core.execution({ owner, generation, value: run.request.value });
      if (access.kind === "ordinary") return access;
      if (access.kind === "refused") return { kind: "refused" };
      const call = capsules.get(access.capsule);
      if (call === undefined || call.scope.sessionId !== run.sessionId || call.buildSlot !== webNodeBuildSlot(webNodeBuildOf(run.request).build) || call.startLocation !== run.request.startLocation || call.referenceNow !== run.request.referenceNow) return { kind: "refused" };
      const node = webRunnableNode(call.definitionId);
      if (node === undefined || node.definitionId !== call.definitionId || node.definition.version !== call.definitionVersion || node.actionType !== call.command.actionType) return { kind: "refused" };
      return createWebNodeSelectedExecution(call, access);
    },
    capture: (input) => createWebNodeFrozenCapture(host, input)
  };
}
