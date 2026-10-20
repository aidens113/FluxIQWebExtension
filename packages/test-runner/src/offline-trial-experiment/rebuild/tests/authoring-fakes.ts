// A stand-in for Core's authoring path (`../core-authoring.ts`) that asks the
// binding the questions a script would make Core ask, in order, then answers
// with a proposal and a whole candidate of fixed digests. What it exercises is
// the experiment's own wiring: pairing, the seam, the digest comparison.

import type { AutomationStudioFlowCandidate, AutomationStudioNodeRegistry, AutomationStudioNodeRegistryResolution } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import type { CoreAuthoring } from "../core-authoring.js";
import type { RebuildContext } from "../rebuild-candidate.js";

export type FakeQuestion = { nodeDefinitionId: string; parameters: JsonObject };

export type FakeAuthoringScript = {
  questions: readonly FakeQuestion[];
  subflowDigest: string;
  wholeDigest: string;
  /** Refuse at this stage instead of answering. */
  refuse?: "subflow" | "assembly";
};

type Binding = { resolvePlanNodeParameters(input: FakeQuestion & { writtenByModel: boolean }): Promise<{ status: string }> };

export function fakeAuthoring(byScript: Readonly<Record<string, FakeAuthoringScript>>): CoreAuthoring {
  return Object.freeze({
    dispatchScope: (_record: unknown, brief: unknown) => ({ scope: { buildId: "build.b", briefId: (brief as { briefId: string }).briefId, planDigest: "plan", subflowKey: "collect", predecessors: [] }, siblings: [], subflowName: "Collect" }),
    scopedController: ({ submission }: { submission: object }) => ({
      async submit(result: JsonObject) {
        const script = byScript[result.flow as string];
        if (!script) throw new Error("unknown script");
        const binding = (submission as { binding: Binding }).binding;
        const answers = [];
        for (const question of script.questions) answers.push(await binding.resolvePlanNodeParameters({ ...question, writtenByModel: true }).catch(() => ({ status: "failed" })));
        if (script.refuse === "subflow" || answers.some((answer) => answer.status === "refused" || answer.status === "failed")) {
          return { ok: false as const, revision: 0, check: { issueCodes: [answers.some((answer) => answer.status === "failed") ? "bootstrap.parameter_resolution_failed" : "web.handle.unknown"], feedback: {} } };
        }
        return { ok: true as const, proposal: { scope: {}, revision: 1, digest: script.subflowDigest, subflows: [], changedPaths: [], script: result.flow } };
      },
    }),
    assembleLatest: async (input) => {
      const script = byScript[(input.inHand as { script?: string } | undefined)?.script ?? ""];
      if (!script || script.refuse === "assembly") return { ok: false as const, kind: "assembly" as const, issues: [{ code: "project.assembly_refused" }] };
      return { ok: true as const, again: false, candidate: { revision: 1, digest: script.wholeDigest } as unknown as AutomationStudioFlowCandidate };
    },
    extractionConditions: (where: unknown) => ({ ok: true as const, where: Array.isArray(where) ? where : [where] }),
  });
}

/** A rebuild context over a draft holding `plan` as its persisted candidate. */
export function fakeContext(authoring: CoreAuthoring, plan: JsonObject, wholeDigest: string): RebuildContext {
  return Object.freeze({
    authoring,
    surroundings: { registry: {} as AutomationStudioNodeRegistry, resolution: {} as AutomationStudioNodeRegistryResolution, runsNodes: {} },
    record: { buildId: "build.b", briefs: [{ brief: { briefId: "brief-1" } }], plans: [{ plan: { digest: "plan" } }] },
    draft: { projectId: "p", flowId: "f", instructionText: "", candidate: { revision: 8, digest: wholeDigest, baseDependencyDigest: "base", buildPlan: { plan } } },
    startLocation: "http://example.test/",
  });
}
