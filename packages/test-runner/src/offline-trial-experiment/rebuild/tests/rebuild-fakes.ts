// A stand-in for Core's rebuild seam (`automationStudioProjectSingleSubflowRebuild`)
// that asks the binding the questions a script would make Core ask, in order,
// then answers with a proposal and a whole candidate of fixed digests, or
// refuses at the stage named. Like Core, it throws for a brief the record does
// not hold. What it exercises is the experiment's own wiring: pairing, the
// seam, the digest comparison and the refusal's mapping.

import type { AutomationStudioFlowCandidate, AutomationStudioNodeRegistry, AutomationStudioNodeRegistryResolution } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import type { RebuildContext, SubflowRebuild } from "../rebuild-candidate.js";

export type FakeQuestion = { nodeDefinitionId: string; parameters: JsonObject };

export type FakeRebuildScript = {
  questions: readonly FakeQuestion[];
  subflowDigest: string;
  wholeDigest: string;
  /** Refuse at this stage instead of answering. */
  refuse?: "plan" | "subflow" | "assembly";
};

type Binding = { resolvePlanNodeParameters(input: FakeQuestion & { writtenByModel: boolean }): Promise<{ status: string }> };

export function fakeRebuild(byScript: Readonly<Record<string, FakeRebuildScript>>): SubflowRebuild {
  return async (input) => {
    if (!input.record.briefs.some((entry) => entry.brief.briefId === input.briefId)) throw new Error("project.brief_unknown at briefId");
    const script = byScript[input.script];
    if (!script) throw new Error("unknown script");
    if (script.refuse === "plan") return { ok: false, stage: "plan", codes: ["project.whole_trial_not_this_plan"] };
    const binding = (input.submission as unknown as { binding: Binding }).binding;
    const answers = [];
    for (const question of script.questions) answers.push(await binding.resolvePlanNodeParameters({ ...question, writtenByModel: true }).catch(() => ({ status: "failed" })));
    if (script.refuse === "subflow" || answers.some((answer) => answer.status === "refused" || answer.status === "failed")) {
      return { ok: false, stage: "subflow", codes: [answers.some((answer) => answer.status === "failed") ? "bootstrap.parameter_resolution_failed" : "web.handle.unknown"] };
    }
    const proposal = { revision: 1, digest: script.subflowDigest };
    if (script.refuse === "assembly") return { ok: false, stage: "assembly", codes: ["project.assembly_refused"], proposal };
    return { ok: true, proposal, candidate: { revision: 1, digest: script.wholeDigest } as unknown as AutomationStudioFlowCandidate };
  };
}

/** A rebuild context over a draft holding `plan` as its persisted candidate, rebuilt by `rebuild`. */
export function fakeContext(rebuild: SubflowRebuild, plan: JsonObject, wholeDigest: string): RebuildContext {
  return Object.freeze({
    rebuild,
    surroundings: { registry: {} as AutomationStudioNodeRegistry, resolution: {} as AutomationStudioNodeRegistryResolution, runsNodes: {} },
    record: { buildId: "build.b", briefs: [{ brief: { briefId: "brief-1" } }], plans: [{ plan: { digest: "plan" } }] },
    draft: { projectId: "p", flowId: "f", instructionText: "", candidate: { revision: 8, digest: wholeDigest, baseDependencyDigest: "base", buildPlan: { plan } } },
    startLocation: "http://example.test/",
  });
}
